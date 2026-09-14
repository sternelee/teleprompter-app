import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAssessmentPrompt,
  latestAssessmentGuidance,
  validateAssessment,
} from "./assessment.ts";
import type { AssessmentProposal } from "../types/assessment.ts";
import type { PracticeSession } from "../types/session.ts";

const SESSION: Pick<PracticeSession, "segments"> = {
  segments: [
    { id: "s0", speaker: "ai", text: "Hi there, welcome to the cafe." },
    {
      id: "s1",
      speaker: "user",
      text: "Could I get a large latte with oat milk please?",
    },
  ],
};

function proposal(
  overrides: Partial<AssessmentProposal> = {},
): AssessmentProposal {
  return {
    suggestedLevel: 3,
    outcome: "partial",
    capability: "polite requests",
    nextGoal: "Practise clarifying orders with follow-up questions.",
    words: [
      {
        form: "latte",
        lemma: "latte",
        meaning: "拿铁",
        quote: "a large latte with oat milk",
      },
    ],
    ...overrides,
  };
}

describe("validateAssessment", () => {
  it("passes a grounded proposal through unchanged", () => {
    const result = validateAssessment(proposal(), SESSION);

    assert.ok(result);
    assert.equal(result.suggestedLevel, 3);
    assert.equal(result.outcome, "partial");
    assert.equal(result.words.length, 1);
    assert.equal(result.words[0].meaning, "拿铁");
    assert.ok(result.assessedAt > 0);
  });

  it("rejects unknown outcome values and non-numeric levels", () => {
    assert.equal(
      validateAssessment(proposal({ outcome: "amazing" }), SESSION),
      null,
    );
    assert.equal(
      validateAssessment(proposal({ suggestedLevel: "high" }), SESSION),
      null,
    );
  });

  it("clamps out-of-range levels into 0-5", () => {
    assert.equal(
      validateAssessment(proposal({ suggestedLevel: 9 }), SESSION)
        ?.suggestedLevel,
      5,
    );
    assert.equal(
      validateAssessment(proposal({ suggestedLevel: -2 }), SESSION)
        ?.suggestedLevel,
      0,
    );
  });

  it("drops words whose quote is not from the real dialogue", () => {
    const result = validateAssessment(
      proposal({
        words: [
          // Hallucinated: quote does not appear in the script.
          {
            form: "espresso",
            lemma: "espresso",
            meaning: "意式浓缩",
            quote: "an espresso with extra sugar",
          },
          // Grounded.
          ...proposal().words,
        ],
      }),
      SESSION,
    );

    assert.ok(result);
    assert.equal(result.words.length, 1);
    assert.equal(result.words[0].form, "latte");
  });

  it("drops words whose quote does not contain the form", () => {
    const result = validateAssessment(
      proposal({
        words: [
          {
            form: "latte",
            lemma: "latte",
            meaning: "拿铁",
            quote: "welcome to the cafe",
          },
        ],
      }),
      SESSION,
    );

    assert.ok(result);
    assert.equal(result.words.length, 0);
  });

  it("drops words with empty lemma or meaning and too-short forms", () => {
    const result = validateAssessment(
      proposal({
        words: [
          {
            form: "oat",
            lemma: "",
            meaning: "燕麦",
            quote: "with oat milk please",
          },
          { form: "I", lemma: "I", meaning: "我", quote: "Could I get" },
          {
            form: "oat",
            lemma: "oat",
            meaning: "燕麦（奶）",
            quote: "with oat milk please",
          },
        ],
      }),
      SESSION,
    );

    assert.ok(result);
    assert.equal(result.words.length, 1);
    assert.equal(result.words[0].form, "oat");
  });

  it("dedupes repeated forms and caps the word list at 12", () => {
    // Every form is a real word from the dialogue with a matching quote.
    const line0 = [
      "hi",
      "there",
      "welcome",
      "cafe",
    ].map((form) => ({
      form,
      lemma: form,
      meaning: `词-${form}`,
      quote: "Hi there, welcome to the cafe.",
    }));
    const line1 = [
      "could",
      "get",
      "large",
      "latte",
      "with",
      "oat",
      "milk",
      "please",
    ].map((form) => ({
      form,
      lemma: form,
      meaning: `词-${form}`,
      quote: "Could I get a large latte with oat milk please?",
    }));
    const words = [...line0, ...line1];
    // A duplicate of the first form must be dropped, not double-counted.
    words.push({
      form: "hi",
      lemma: "hi",
      meaning: "词-hi-副本",
      quote: "Hi there, welcome to the cafe.",
    });

    const result = validateAssessment(proposal({ words }), SESSION);

    assert.ok(result);
    assert.equal(result.words.length, 12);
    assert.equal(result.words[0].form, "hi");
    assert.equal(result.words[0].meaning, "词-hi");
  });

  it("truncates oversized free-text fields", () => {
    const result = validateAssessment(
      proposal({
        capability: "x".repeat(400),
        nextGoal: "y".repeat(400),
      }),
      SESSION,
    );

    assert.ok(result);
    assert.equal(result.capability.length, 160);
    assert.equal(result.nextGoal.length, 300);
  });

  it("survives missing optional text fields", () => {
    const result = validateAssessment(
      proposal({ capability: "", nextGoal: undefined as unknown as string }),
      SESSION,
    );

    assert.ok(result);
    assert.equal(result.capability, "");
    assert.equal(result.nextGoal, "");
  });
});

describe("buildAssessmentPrompt", () => {
  it("includes dialogue, missed words and progress", () => {
    const prompt = buildAssessmentPrompt({
      scene: "Ordering coffee",
      segments: SESSION.segments,
      corrections: [{ expected: "latte" }],
      spokenCount: 6,
      totalWords: 18,
    });

    assert.ok(prompt.includes("Partner: Hi there, welcome to the cafe."));
    assert.ok(prompt.includes("User: Could I get a large latte"));
    assert.ok(prompt.includes("missed or skipped: latte"));
    assert.ok(prompt.includes("6 of 18 words"));
  });
});

describe("latestAssessmentGuidance", () => {
  const assessed = (level: number, updatedAt: number): PracticeSession => ({
    id: `s-${level}-${updatedAt}`,
    scene: "scene",
    segments: [],
    currentWordIndex: -1,
    corrections: [],
    createdAt: updatedAt,
    updatedAt,
    assessment: {
      suggestedLevel: level,
      outcome: "partial",
      capability: "",
      nextGoal: `goal-${level}`,
      words: [],
      assessedAt: updatedAt,
    },
  });

  it("uses the most recent assessed session", () => {
    const guidance = latestAssessmentGuidance([
      assessed(2, 1000),
      assessed(4, 3000),
      assessed(1, 2000),
    ]);

    assert.deepEqual(guidance, { level: 4, nextGoal: "goal-4" });
  });

  it("returns null when no session carries an assessment", () => {
    const session: PracticeSession = {
      id: "s",
      scene: "scene",
      segments: [],
      currentWordIndex: -1,
      corrections: [],
      createdAt: 1,
      updatedAt: 1,
    };

    assert.equal(latestAssessmentGuidance([session]), null);
    assert.equal(latestAssessmentGuidance([]), null);
  });
});
