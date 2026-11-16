import type { Astrologer, AstrologerAvailability, ConsultMode } from '@prisma/client';
import { clock } from '../../lib/clock';
import { prisma } from '../../lib/prisma';
import { placeView } from '../catalog/catalog.routes';
import { currentRates, MODES, rateCap, type RateMap } from './rates.service';
import { scheduleDrives, scheduleState, type Slot } from './schedule';
import { uploadView, viewLink } from './uploads.service';

/**
 * Online per mode: not away, the mode was granted and has a rate, and it is switched on. For modes on
 * the weekly schedule (X4-4), "switched on" means inside the hours, unless a manual switch still wins.
 */
export function onlineModes(
  a: Pick<Astrologer, 'capabilities' | 'status'>,
  av: AstrologerAvailability | null,
  rates: RateMap,
  slots: Slot[],
) {
  const now = clock.now();
  const away = !!av?.awayUntil && av.awayUntil > now;
  const { inHours } = scheduleState(slots, now);
  const out = {} as Record<ConsultMode, boolean>;
  for (const m of MODES) {
    const on = scheduleDrives(av, m, now) ? inHours : !!av?.[m];
    out[m] =
      a.status === 'approved' && !away && on && a.capabilities.includes(`consult_${m}`) && rates[m] !== undefined;
  }
  return out;
}

export const statusWord = (online: Record<ConsultMode, boolean>) =>
  MODES.some((m) => online[m]) ? 'online' : 'offline';

/** The X1-4 timeline: Submitted → Documents checked → Video interview → Go live. */
async function timeline(a: Astrologer) {
  const events = await prisma.astrologerEvent.findMany({
    where: { astrologerId: a.id },
    orderBy: { createdAt: 'asc' },
  });
  const last = (types: string[]) => [...events].reverse().find((e) => types.includes(e.type))?.createdAt ?? null;
  return {
    steps: [
      { key: 'submitted', doneAt: last(['submitted', 'resubmitted']) },
      { key: 'documents_checked', doneAt: last(['documents_checked']) },
      {
        key: 'interview',
        doneAt: a.interviewAt && a.interviewAt <= clock.now() ? a.interviewAt : null,
        scheduledAt: a.interviewAt,
      },
      { key: 'live', doneAt: a.approvedAt },
    ],
    events: events.map((e) => ({ type: e.type, note: e.note, at: e.createdAt })),
  };
}

/** What the astrologer app shows during onboarding (X1) and on the status screen (X1-4). */
export async function applicationView(a: Astrologer) {
  const [kyc, requested, approvedRates, fixes, uploads, place] = await Promise.all([
    prisma.astrologerKyc.findUnique({ where: { astrologerId: a.id } }),
    prisma.astrologerRate.findMany({ where: { astrologerId: a.id, status: 'requested' } }),
    currentRates(prisma, a.id),
    prisma.applicationFix.findMany({ where: { astrologerId: a.id, resolvedAt: null }, orderBy: { createdAt: 'asc' } }),
    prisma.upload.findMany({
      where: {
        id: {
          in: [
            a.photoUploadId,
            a.panUploadId,
            a.idFrontUploadId,
            a.idBackUploadId,
            a.proofUploadId,
            a.introVideoUploadId,
          ].filter((x): x is string => !!x),
        },
      },
    }),
    a.placeId ? prisma.place.findUnique({ where: { id: a.placeId } }) : null,
  ]);
  const byId = (id: string | null) => (id ? uploads.find((u) => u.id === id) : undefined);
  const doc = (id: string | null) => {
    const u = byId(id);
    return u ? uploadView(u) : null;
  };

  return {
    id: a.id,
    status: a.status,
    basics: {
      legalName: a.legalName,
      displayName: a.displayName,
      gender: a.gender,
      place: place ? placeView(place) : null,
      languages: a.languages,
      experienceYears: a.experienceYears,
      photo: doc(a.photoUploadId),
      photoUrl: await viewLink(byId(a.photoUploadId)?.storageKey),
    },
    expertise: {
      methods: a.methods,
      primaryCategory: a.primaryCategory,
      secondaryCategories: a.secondaryCategories,
      capabilities: a.capabilitiesRequested,
      bio: a.bio,
    },
    documents: {
      idType: a.idType,
      pan: doc(a.panUploadId),
      idFront: doc(a.idFrontUploadId),
      idBack: doc(a.idBackUploadId),
      proof: doc(a.proofUploadId),
      introVideo: doc(a.introVideoUploadId),
    },
    payout: kyc
      ? {
          panLast4: kyc.panLast4,
          bankAccountLast4: kyc.bankAccountLast4,
          ifsc: kyc.ifsc,
          accountHolder: kyc.accountHolder,
          gstin: kyc.gstin,
        }
      : null,
    rates: {
      requested: Object.fromEntries(requested.map((r) => [r.mode, r.ratePaise])),
      approved: approvedRates,
      capPaise: await rateCap(a),
    },
    fixes: fixes.map((f) => ({ id: f.id, field: f.field, message: f.message, at: f.createdAt })),
    interview: a.interviewAt ? { at: a.interviewAt, link: a.interviewLink } : null,
    rejection: a.status === 'rejected' ? { reason: a.rejectReason, reapplyAfter: a.reapplyAfter } : null,
    capabilities: a.capabilities,
    timeline: await timeline(a),
  };
}

type Card = Astrologer & {
  availability: AstrologerAvailability | null;
  scheduleSlots: Slot[];
  consults: { id: string }[];
  place: { name: string; state: string | null } | null;
};

/** List card (spec §8.6): photo, name, category, rating later, experience, languages, price, status. */
export async function publicCard(a: Card, rates: RateMap, photoKey: string | null) {
  const online = onlineModes(a, a.availability, rates, a.scheduleSlots);
  const prices = MODES.map((m) => rates[m]).filter((r): r is number => r !== undefined);
  return {
    id: a.id,
    displayName: a.displayName,
    photoUrl: await viewLink(photoKey),
    gender: a.gender,
    city: a.place ? { name: a.place.name, state: a.place.state } : null,
    primaryCategory: a.primaryCategory,
    categories: [a.primaryCategory, ...a.secondaryCategories].filter(Boolean),
    methods: a.methods,
    languages: a.languages,
    experienceYears: a.experienceYears,
    rates,
    fromRatePaise: prices.length ? Math.min(...prices) : null,
    modes: MODES.filter((m) => a.capabilities.includes(`consult_${m}`) && rates[m] !== undefined),
    online,
    busy: a.consults.length > 0,
    status: a.consults.length > 0 && statusWord(online) === 'online' ? 'busy' : statusWord(online),
    hostsLive: a.capabilities.includes('host_live'),
  };
}
