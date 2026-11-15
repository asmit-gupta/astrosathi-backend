import { z } from 'zod';

/** Letters in any script (incl. Devanagari with its vowel signs), spaces, dot, apostrophe, hyphen. */
const NAME = /^[\p{L}\p{M}\s.'-]+$/u;

/** A person's name, 2 to `max` characters. Shared by users, birth profiles and astrologers. */
export const personName = (max = 60) => z.string().trim().min(2).max(max).regex(NAME, "only letters, spaces and . ' -");
