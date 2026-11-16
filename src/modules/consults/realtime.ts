import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { z } from 'zod';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { authenticateToken } from '../../middleware/auth';
import { astrologerKey, startBus, stopBus, userKey } from './bus';
import * as consults from './consults.service';

/**
 * Chat socket: wss://…/v1/ws?token=<access token>. The server sends events
 * ({t: consult | message | read | typing}); the app sends:
 *   {t:'send', consultId, id, body} → {t:'ack', id, message} or {t:'error', id, code}
 *   {t:'typing', consultId} · {t:'read', consultId, seq} · {t:'ping'} → {t:'pong'}
 * After a reconnect the app fetches what it missed over REST (messages after its last seq).
 */
const incoming = z.discriminatedUnion('t', [
  z.object({ t: z.literal('send'), consultId: z.string().uuid(), id: z.string().uuid(), body: z.string() }),
  z.object({ t: z.literal('typing'), consultId: z.string().uuid() }),
  z.object({ t: z.literal('read'), consultId: z.string().uuid(), seq: z.number().int().min(0) }),
  z.object({ t: z.literal('ping') }),
]);

const sockets = new Map<string, Set<WebSocket>>();
const PING_MS = 25_000;

function deliver(to: string[], event: Record<string, unknown>) {
  const data = JSON.stringify(event);
  for (const key of to) for (const ws of sockets.get(key) ?? []) if (ws.readyState === WebSocket.OPEN) ws.send(data);
}

async function partyFor(token: string): Promise<{ party: consults.Party; key: string }> {
  const auth = await authenticateToken(token, 'any');
  if (auth.app === 'provider') {
    const party = await consults.astrologerParty(auth.userId);
    return { party, key: party.side === 'astrologer' ? astrologerKey(party.astrologerId) : '' };
  }
  return { party: { side: 'user', userId: auth.userId }, key: userKey(auth.userId) };
}

function reject(socket: Duplex, status: number) {
  socket.write(`HTTP/1.1 ${status} ${status === 401 ? 'Unauthorized' : 'Forbidden'}\r\n\r\n`);
  socket.destroy();
}

export async function attachRealtime(server: Server): Promise<() => Promise<void>> {
  await startBus(deliver);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://local');
    if (url.pathname !== '/v1/ws') return reject(socket, 403);
    partyFor(url.searchParams.get('token') ?? '').then(
      (who) => wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, who.party, who.key)),
      (err: unknown) => reject(socket, err instanceof AppError && err.status === 403 ? 403 : 401),
    );
  });

  // Drop sockets whose phone vanished without closing.
  const alive = new WeakSet<WebSocket>();
  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) {
        ws.terminate();
        continue;
      }
      alive.delete(ws);
      ws.ping();
    }
  }, PING_MS);
  timer.unref();

  function onConnection(ws: WebSocket, party: consults.Party, key: string) {
    alive.add(ws);
    ws.on('pong', () => alive.add(ws));
    const set = sockets.get(key) ?? new Set<WebSocket>();
    set.add(ws);
    sockets.set(key, set);
    void consults.touch(party).catch(() => undefined);

    ws.on('message', (raw) => {
      alive.add(ws);
      let msg: z.infer<typeof incoming>;
      try {
        msg = incoming.parse(JSON.parse(String(raw)));
      } catch {
        ws.send(JSON.stringify({ t: 'error', code: 'BAD_MESSAGE' }));
        return;
      }
      void handle(ws, party, msg).catch((err: unknown) => {
        const code = err instanceof AppError ? err.code : 'INTERNAL';
        if (!(err instanceof AppError)) logger.error({ err }, 'Socket message failed');
        ws.send(JSON.stringify({ t: 'error', code, ...('id' in msg ? { id: msg.id } : {}) }));
      });
    });
    ws.on('close', () => {
      set.delete(ws);
      if (!set.size) sockets.delete(key);
    });
  }

  return async () => {
    clearInterval(timer);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    await stopBus();
  };
}

async function handle(ws: WebSocket, party: consults.Party, msg: z.infer<typeof incoming>) {
  switch (msg.t) {
    case 'send': {
      const message = await consults.send(party, msg.consultId, msg.id, msg.body);
      ws.send(JSON.stringify({ t: 'ack', id: msg.id, message }));
      return;
    }
    case 'typing':
      return consults.typing(party, msg.consultId);
    case 'read':
      return consults.markRead(party, msg.consultId, msg.seq);
    case 'ping':
      await consults.touch(party);
      ws.send(JSON.stringify({ t: 'pong' }));
      return;
  }
}
