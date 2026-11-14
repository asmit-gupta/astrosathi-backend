import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { app } from './helpers';

describe('CORS', () => {
  it('answers preflight for an allowed origin', async () => {
    const res = await request(app)
      .options('/v1/auth/otp/send')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('adds the allow-origin header to normal responses', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('ignores origins not on the list', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('request log', () => {
  it('logs one line per request with status and error code, without the body', async () => {
    const { logger } = await import('../src/lib/logger');
    const lines: Array<{ obj: Record<string, unknown>; msg: string }> = [];
    const spy = (level: 'info' | 'warn') =>
      vi.spyOn(logger, level).mockImplementation(((obj: Record<string, unknown>, msg: string) => {
        lines.push({ obj, msg });
      }) as never);
    const info = spy('info'), warn = spy('warn');
    await request(app).post('/v1/auth/otp/send').send({ mobile: '9876543210' });
    await request(app).get('/v1/categories');
    info.mockRestore();
    warn.mockRestore();

    const bad = lines.find((l) => l.msg.startsWith('POST /v1/auth/otp/send 400'));
    expect(bad?.obj).toMatchObject({ status: 400, code: 'VALIDATION_FAILED', method: 'POST' });
    expect(JSON.stringify(bad)).not.toContain('9876543210');
    expect(lines.some((l) => l.msg.startsWith('GET /v1/categories 200'))).toBe(true);
  });
});
