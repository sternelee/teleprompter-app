/**
 * AI assessment for one practice session, Mural-style: the model proposes,
 * the app validates (see services/assessment.ts) and only validated results
 * are stored. Local matcher evidence stays the ground truth; the model only
 * contributes lemma/meaning glosses, a capability observation, a next
 * teaching goal and a challenge-level suggestion.
 */

export type AssessmentOutcome = "success" | "partial" | "breakdown";

export interface AssessmentWord {
  /** Word form exactly as it appears in the dialogue (validated by quote). */
  form: string;
  /** Dictionary lemma, e.g. "order". */
  lemma: string;
  /** Learner-facing gloss in Chinese, e.g. "点单；订购". */
  meaning: string;
  /** Exact quote from the dialogue containing the form. */
  quote: string;
}

export interface PracticeAssessment {
  /** Suggested challenge level for the next dialogue, 0 (beginner) – 5. */
  suggestedLevel: number;
  /** Overall outcome of the practice round. */
  outcome: AssessmentOutcome;
  /** Short observed capability, e.g. "polite requests". */
  capability: string;
  /** Teaching focus for the next dialogue, one sentence. */
  nextGoal: string;
  /** Up to 12 validated glossary words from this dialogue. */
  words: AssessmentWord[];
  assessedAt: number;
}

/** Raw model proposal before validation. */
export type AssessmentProposal = Omit<PracticeAssessment, "assessedAt">;
