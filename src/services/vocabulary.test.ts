import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeWord,
  projectVocabulary,
  selectReviewWords,
} from "./vocabulary.ts";
import type { PracticeSession } from "../types/session.ts";

const DAY = 86_400_000;
const BASE = Date.UTC(2026, 8, 1, 12); // 2026-09-01T12:00Z

/**
 * Default script word order (global indexes):
 *   0 Hi, 1 there, 2 welcome, 3 to, 4 the, 5 cafe,
 *   6 Could, 7 I, 8 get, 9 a, 10 large, 11 latte, 12 with,
 *   13 oat, 14 milk, 15 please,
 *   16 Sure, 17 anything, 18 else, 19 for, 20 you, 21 today,
 *   22 No, 23 thanks, 24 that, 25 will, 26 be, 27 all.
 */

interface SessionOverrides
  extends Partial<Omit<PracticeSession, "segments" | "corrections">> {
  segments?: string[];
  speakers?: ("ai" | "user")[];
  corrections?: number[];
  practiceMode?: "full" | "role";
  updatedAt?: number;
  scene?: string;
}

/**
 * Build a session from a list of line texts. `corrections` lists the
 * global word indexes the matcher flagged as missed.
 */
function makeSession(overrides: SessionOverrides = {}): PracticeSession {
  const lines = overrides.segments ?? [
    "Hi there, welcome to the cafe.",
    "Could I get a large latte with oat milk please?",
    "Sure, anything else for you today?",
    "No thanks, that will be all.",
  ];
  const speakers =
    overrides.speakers ?? lines.map((_, i) => (i % 2 === 0 ? "ai" : "user"));

  return {
    id: overrides.id ?? `s-${Math.random().toString(36).slice(2, 8)}`,
    scene: overrides.scene ?? "Ordering coffee at a cafe",
    segments: lines.map((text, i) => ({
      id: `seg-${i}`,
      speaker: speakers[i] ?? "ai",
      text,
    })),
    currentWordIndex: overrides.currentWordIndex ?? 7,
    corrections: (overrides.corrections ?? []).map((wordIndex) => ({
      wordIndex,
      expected: "word",
      actual: "(missed)",
      timestamp: overrides.updatedAt ?? BASE,
    })),
    practiceMode: overrides.practiceMode ?? "full",
    createdAt: overrides.createdAt ?? BASE,
    updatedAt: overrides.updatedAt ?? BASE,
    title: overrides.title,
  };
}

function entryFor(
  entries: ReturnType<typeof projectVocabulary>,
  key: string,
) {
  const found = entries.find((e) => e.key === key);
  assert.ok(found, `expected an entry for "${key}"`);
  return found;
}

describe("normalizeWord", () => {
  it("strips punctuation but keeps apostrophes and hyphens", () => {
    assert.equal(normalizeWord("Latte,"), "latte");
    assert.equal(normalizeWord("(milk!"), "milk");
    assert.equal(normalizeWord("don't"), "don't");
    assert.equal(normalizeWord("check-in."), "check-in");
    assert.equal(normalizeWord("—"), "");
  });
});

describe("projectVocabulary", () => {
  it("marks spoken words as one-bar fragile recall", () => {
    const entries = projectVocabulary([makeSession()], BASE + 1000);

    const cafe = entryFor(entries, "cafe");
    assert.equal(cafe.bars, 1);
    assert.equal(cafe.label, "fragile");
    assert.equal(cafe.independentCount, 1);
    assert.equal(cafe.lapseCount, 0);
    // One-bar words are due a day later.
    assert.equal(cafe.isDue, false);
  });

  it("records missed words as lapses with zero bars", () => {
    // Word 10 in the full-script order is "large".
    const entries = projectVocabulary(
      [makeSession({ corrections: [10] })],
      BASE + 1000,
    );

    const large = entryFor(entries, "large");
    assert.equal(large.bars, 0);
    assert.equal(large.label, "new");
    assert.equal(large.lapseCount, 1);
    assert.equal(large.independentCount, 0);
    // Zero-bar words resurface after one day.
    const nextDay = projectVocabulary(
      [makeSession({ corrections: [10] })],
      BASE + DAY,
    );
    assert.equal(entryFor(nextDay, "large").isDue, true);
  });

  it("skips words never spoken through", () => {
    const entries = projectVocabulary(
      [makeSession({ currentWordIndex: 1 })],
      BASE,
    );
    // Only the first two words ("Hi", "there") are spoken.
    assert.ok(entries.find((e) => e.key === "hi"));
    assert.ok(entries.find((e) => e.key === "there"));
    assert.ok(!entries.find((e) => e.key === "cafe"));
  });

  it("awards two bars for recall on two different days", () => {
    const entries = projectVocabulary(
      [
        makeSession({ scene: "Ordering coffee", updatedAt: BASE }),
        makeSession({
          scene: "Chatting with a barista",
          updatedAt: BASE + 2 * DAY,
        }),
      ],
      BASE + 2 * DAY + 1000,
    );

    assert.equal(entryFor(entries, "cafe").bars, 2);
    assert.equal(entryFor(entries, "cafe").label, "growing");
  });

  it("awards three bars only across days, scenes and a week", () => {
    const sessions = [
      makeSession({ scene: "Ordering coffee", updatedAt: BASE }),
      makeSession({
        scene: "Chatting with a barista",
        updatedAt: BASE + 4 * DAY,
      }),
      makeSession({ scene: "Brunch with friends", updatedAt: BASE + 8 * DAY }),
    ];

    const entries = projectVocabulary(sessions, BASE + 8 * DAY + 1000);
    const cafe = entryFor(entries, "cafe");
    assert.equal(cafe.bars, 3);
    assert.equal(cafe.label, "steady");
    assert.deepEqual(cafe.contexts.slice().sort(), [
      "Brunch with friends",
      "Chatting with a barista",
      "Ordering coffee",
    ]);
  });

  it("decays an overdue steady word by one bar", () => {
    const sessions = [
      makeSession({ scene: "Ordering coffee", updatedAt: BASE }),
      makeSession({
        scene: "Chatting with a barista",
        updatedAt: BASE + 4 * DAY,
      }),
      makeSession({ scene: "Brunch with friends", updatedAt: BASE + 8 * DAY }),
    ];

    // 3-bar interval is 14 days; 20 days later the word has decayed.
    const entries = projectVocabulary(sessions, BASE + 8 * DAY + 20 * DAY);
    assert.equal(entryFor(entries, "cafe").bars, 2);
  });

  it("caps a word at one bar when a lapse follows the last recall", () => {
    const entries = projectVocabulary(
      [
        makeSession({
          scene: "Ordering coffee",
          updatedAt: BASE,
          currentWordIndex: 15, // spoken through "please"
        }),
        makeSession({
          scene: "Chatting with a barista",
          updatedAt: BASE + 2 * DAY,
          corrections: [15], // "please"
        }),
      ],
      BASE + 2 * DAY + 1000,
    );

    const please = entryFor(entries, "please");
    assert.equal(please.bars, 1);
    assert.equal(please.independentCount, 1);
    assert.equal(please.lapseCount, 1);
  });

  it("ignores partner lines in role mode", () => {
    const entries = projectVocabulary(
      [
        makeSession({
          practiceMode: "role",
          // Line 0 (partner) contains "welcome"; the learner's first user
          // words are 6..9 ("Could I get a").
          currentWordIndex: 9,
        }),
      ],
      BASE,
    );

    assert.ok(!entries.find((e) => e.key === "welcome"));
    assert.ok(entries.find((e) => e.key === "could"));
  });

  it("counts one evidence event per word per session", () => {
    const entries = projectVocabulary(
      [makeSession({ segments: ["the the the", "the the"] })],
      BASE,
    );

    const the = entryFor(entries, "the");
    assert.equal(the.independentCount, 1);
    assert.equal(the.lapseCount, 0);
  });
});

describe("selectReviewWords", () => {
  it("returns overdue weakest words first, capped at the limit", () => {
    const sessions = [
      makeSession({
        scene: "Ordering coffee",
        updatedAt: BASE,
        corrections: [10], // "large" missed
      }),
      makeSession({
        scene: "Chatting with a barista",
        updatedAt: BASE + 2 * DAY,
        corrections: [27], // "all" missed later
      }),
    ];

    const entries = projectVocabulary(sessions, BASE + 3 * DAY);
    const words = selectReviewWords(entries, 2);

    assert.equal(words.length, 2);
    // Both missed words are overdue; weakest (zero-bar) come first.
    assert.ok(words.includes("large"));
    assert.ok(words.includes("all"));
  });

  it("returns nothing when nothing is due", () => {
    const entries = projectVocabulary([makeSession()], BASE + 1000);
    assert.deepEqual(selectReviewWords(entries), []);
  });
});
