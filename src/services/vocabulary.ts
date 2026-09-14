import type { PracticeSession } from "../types/session";

/**
 * Vocabulary recall projection, adapted from Mural's `LearningEngine.project`
 * (facebook.com/Chuloo/mural, MIT). Instead of an append-only event log, the
 * projection is derived purely from the saved practice sessions — each session
 * already carries the script, the spoken-through word index and the matcher's
 * corrections, which is all the evidence we need:
 *
 * - a word spoken correctly in a session  → "independent" recall evidence
 * - a word the matcher recorded as missed  → "lapse" evidence
 * - the session's scene                    → the recall context
 *
 * Recall strength is expressed as 0–3 bars, mirroring Mural's heuristics:
 * - 1 bar: recalled independently at least once
 * - 2 bars: recalled on ≥ 2 different days
 * - 3 bars: recalled on ≥ 3 different days, in ≥ 2 different scenes,
 *           spanning at least a week
 * Words decay one bar when their review interval lapses, and a lapse after
 * the last independent recall caps the word at one bar.
 *
 * These are product heuristics for practice scheduling, not calibrated
 * forgetting probabilities.
 */

export type RecallLabel = "new" | "fragile" | "growing" | "steady";

export interface VocabularyEntry {
  /** Normalized word form, e.g. "espresso". */
  key: string;
  /** 0–3 recall strength bars. */
  bars: number;
  label: RecallLabel;
  /** Times the word was read correctly. */
  independentCount: number;
  /** Times the matcher recorded the word as missed. */
  lapseCount: number;
  lastSeenAt: number;
  /** When the word should resurface in a new dialogue. */
  dueAt: number;
  isDue: boolean;
  /** Scene titles where the word was recalled independently. */
  contexts: string[];
  /** Chinese gloss from the latest validated AI assessment, if any. */
  meaning?: string;
  /** Dictionary lemma from the latest validated AI assessment, if any. */
  lemma?: string;
}

type EvidenceKind = "independent" | "lapse";

interface WordEvidence {
  key: string;
  kind: EvidenceKind;
  at: number;
  context: string;
}

/** Review interval per bar level, in days (Mural's spacing table). */
const REVIEW_INTERVAL_DAYS = [1, 1, 4, 14];
const DAY_MS = 86_400_000;
/** Review words injected into a single generated dialogue. */
export const REVIEW_WORD_LIMIT = 8;
/** Words shorter than this are not worth tracking (matches the matcher). */
const MIN_WORD_LENGTH = 2;
/** Cap a context label so stored entries stay small. */
const CONTEXT_LABEL_LIMIT = 36;

const LABELS: RecallLabel[] = ["new", "fragile", "growing", "steady"];

/**
 * Normalize a word for identity and review matching: lowercase, strip
 * punctuation but keep internal apostrophes/hyphens ("don't", "check-in").
 */
export function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z'’-]/g, "")
    .replace(/^['’-]+|['’-]+$/g, "");
}

interface SessionWord {
  text: string;
  globalIndex: number;
  speaker: "ai" | "user";
}

function sessionWords(session: PracticeSession): SessionWord[] {
  let index = 0;
  const words: SessionWord[] = [];

  for (const segment of session.segments) {
    for (const text of segment.text.split(/\s+/).filter(Boolean)) {
      words.push({ text, globalIndex: index++, speaker: segment.speaker });
    }
  }

  return words;
}

function contextLabel(scene: string): string {
  const trimmed = scene.trim();
  return trimmed.length <= CONTEXT_LABEL_LIMIT
    ? trimmed
    : `${trimmed.slice(0, CONTEXT_LABEL_LIMIT - 1).trimEnd()}…`;
}

function collectEvidence(session: PracticeSession): WordEvidence[] {
  const words = sessionWords(session);
  const corrections = new Map(
    session.corrections.map((correction) => [
      correction.wordIndex,
      correction,
    ]),
  );
  const isRoleMode = session.practiceMode === "role";
  const spokenThrough = session.currentWordIndex;
  const context = contextLabel(session.scene);
  const evidence: WordEvidence[] = [];
  const seen = new Set<string>();

  for (const word of words) {
    // In role mode only the learner's own lines are practised; partner lines
    // are read aloud by TTS and are not recall evidence.
    if (isRoleMode && word.speaker !== "user") continue;

    const key = normalizeWord(word.text);
    if (key.length < MIN_WORD_LENGTH) continue;
    // One evidence event per word per session, first occurrence wins.
    if (seen.has(key)) continue;
    seen.add(key);

    if (corrections.has(word.globalIndex)) {
      evidence.push({ key, kind: "lapse", at: session.updatedAt, context });
    } else if (word.globalIndex <= spokenThrough) {
      evidence.push({
        key,
        kind: "independent",
        at: session.updatedAt,
        context,
      });
    }
  }

  return evidence;
}

function startOfDay(timestamp: number): number {
  return Math.floor(timestamp / DAY_MS);
}

export function projectVocabulary(
  sessions: PracticeSession[],
  now: number = Date.now(),
): VocabularyEntry[] {
  // Latest validated AI glossary wins per word form.
  const glossaryByKey = new Map<string, { lemma: string; meaning: string }>();
  for (const session of [...sessions].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  )) {
    for (const word of session.assessment?.words ?? []) {
      const key = normalizeWord(word.form);
      if (key && !glossaryByKey.has(key)) {
        glossaryByKey.set(key, { lemma: word.lemma, meaning: word.meaning });
      }
    }
  }

  const evidenceByKey = new Map<string, WordEvidence[]>();

  const sorted = [...sessions].sort((a, b) => a.updatedAt - b.updatedAt);
  for (const session of sorted) {
    for (const event of collectEvidence(session)) {
      const bucket = evidenceByKey.get(event.key);
      if (bucket) {
        bucket.push(event);
      } else {
        evidenceByKey.set(event.key, [event]);
      }
    }
  }

  const entries: VocabularyEntry[] = [];
  for (const [key, events] of evidenceByKey) {
    const last = events[events.length - 1];
    const independent = events.filter((e) => e.kind === "independent");
    const lastIndependentAt = independent.length
      ? independent[independent.length - 1].at
      : 0;

    const days = new Set(independent.map((e) => startOfDay(e.at))).size;
    const contexts = [...new Set(independent.map((e) => e.context))];
    const spanMs = independent.length
      ? independent[independent.length - 1].at - independent[0].at
      : 0;

    let bars = independent.length > 0 ? 1 : 0;
    if (days >= 2) bars = 2;
    if (days >= 3 && contexts.length >= 2 && spanMs >= 7 * DAY_MS) bars = 3;

    const interval = REVIEW_INTERVAL_DAYS[bars] * DAY_MS;
    const anchor = lastIndependentAt || last.at;
    const dueAt = anchor + interval;

    // Overdue words decay one bar; a lapse after the last independent
    // recall caps the word at one bar.
    if (now > dueAt && bars > 1) bars = Math.max(1, bars - 1);
    if (last.kind === "lapse" && last.at > lastIndependentAt) {
      bars = Math.min(bars, 1);
    }

    const gloss = glossaryByKey.get(key);

    entries.push({
      key,
      bars,
      label: LABELS[Math.min(3, Math.max(0, bars))],
      independentCount: independent.length,
      lapseCount: events.length - independent.length,
      lastSeenAt: last.at,
      dueAt,
      isDue: now >= dueAt,
      contexts,
      meaning: gloss?.meaning,
      lemma: gloss?.lemma,
    });
  }

  // Due words first (most overdue at top), then most recently practised.
  entries.sort((a, b) => {
    if (a.isDue !== b.isDue) return a.isDue ? -1 : 1;
    if (a.isDue && b.isDue) return a.dueAt - b.dueAt;
    return b.lastSeenAt - a.lastSeenAt;
  });

  return entries;
}

/**
 * Pick the words that should be woven into the next generated dialogue:
 * overdue words first, weakest recall first.
 */
export function selectReviewWords(
  entries: VocabularyEntry[],
  limit: number = REVIEW_WORD_LIMIT,
): string[] {
  const due = entries
    .filter((entry) => entry.isDue)
    .sort((a, b) => a.bars - b.bars || a.dueAt - b.dueAt);

  const words: string[] = [];
  const seen = new Set<string>();

  for (const entry of due) {
    if (words.length >= limit) break;
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    words.push(entry.key);
  }

  return words;
}
