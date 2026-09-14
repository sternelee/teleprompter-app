import type { DialogueSegment } from "../types/dialogue";
import type { PracticeSession } from "../types/session";
import type {
  AssessmentOutcome,
  AssessmentProposal,
  AssessmentWord,
  PracticeAssessment,
} from "../types/assessment";

// Keep in sync with normalizeWord in ./vocabulary.ts — duplicated instead of
// imported so this module stays loadable from plain `node:test` (Node ESM
// needs explicit .ts extensions that Metro rejects).
function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z'’-]/g, "")
    .replace(/^['’-]+|['’-]+$/g, "");
}

// Keep in sync with services/openai.ts (not imported to keep this module
// importable from plain node:test).
const API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

const OUTCOMES: AssessmentOutcome[] = ["success", "partial", "breakdown"];
const MAX_WORDS = 12;
const MAX_NEXT_GOAL = 300;
const MAX_CAPABILITY = 160;
const MAX_LEMMA = 100;
const MAX_MEANING = 180;
const MIN_FORM_LENGTH = 2;

export interface AssessmentInput {
  scene: string;
  segments: DialogueSegment[];
  corrections: { expected: string }[];
  /** Words spoken through, for progress context. */
  spokenCount: number;
  totalWords: number;
}

export function buildAssessmentPrompt(input: AssessmentInput): string {
  const dialogue = input.segments
    .map((s) => `${s.speaker === "ai" ? "Partner" : "User"}: ${s.text}`)
    .join("\n");
  const missed = [...new Set(input.corrections.map((c) => c.expected))].slice(
    0,
    30,
  );
  const missedLine =
    missed.length > 0
      ? `\nWords the learner missed or skipped: ${missed.join(", ")}.`
      : "\nThe learner missed no words.";

  return `You are assessing one round of English speaking practice for a language learner.

Scene: ${input.scene}

Dialogue script:
${dialogue}
${missedLine}
Progress: ${input.spokenCount} of ${input.totalWords} words spoken through.

Assess the round. Choose up to ${MAX_WORDS} useful words from THIS dialogue for the learner's glossary — prefer words the learner missed and words worth remembering. For each word give the exact form as it appears in the dialogue, its dictionary lemma, a short Chinese meaning, and a short exact quote from the dialogue containing the form.

Return ONLY a JSON object in this exact format:
{
  "suggestedLevel": 0-5,
  "outcome": "success" | "partial" | "breakdown",
  "capability": "one short observed strength, in English",
  "nextGoal": "one sentence of teaching focus for the next dialogue, in English",
  "words": [
    { "form": "...", "lemma": "...", "meaning": "中文释义", "quote": "..." }
  ]
}`;
}

/**
 * Validate a model proposal against the actual session evidence, adapted
 * from Mural's `LearningEngine.validate`: nothing the model claims is
 * trusted until it can be traced back to the dialogue that was really
 * practised. Returns a sanitized assessment, or null when the proposal is
 * unusable.
 */
export function validateAssessment(
  proposal: AssessmentProposal,
  session: Pick<PracticeSession, "segments">,
): PracticeAssessment | null {
  if (!proposal || typeof proposal !== "object") return null;
  if (!OUTCOMES.includes(proposal.outcome)) return null;

  const suggestedLevel = Number(proposal.suggestedLevel);
  if (!Number.isFinite(suggestedLevel)) return null;

  const dialogueText = session.segments
    .map((segment) => segment.text.toLowerCase())
    .join("\n");

  const seenForms = new Set<string>();
  const words: AssessmentWord[] = [];

  for (const raw of Array.isArray(proposal.words) ? proposal.words : []) {
    if (words.length >= MAX_WORDS) break;
    if (!raw || typeof raw !== "object") continue;

    const form = String(raw.form ?? "").trim();
    const lemma = String(raw.lemma ?? "").trim();
    const meaning = String(raw.meaning ?? "").trim();
    const quote = String(raw.quote ?? "").trim();

    const key = normalizeWord(form);
    if (key.length < MIN_FORM_LENGTH) continue;
    if (!lemma || lemma.length > MAX_LEMMA) continue;
    if (!meaning || meaning.length > MAX_MEANING) continue;
    if (!quote) continue;
    // The quote must come from the real dialogue and contain the form —
    // this is what anchors every glossary word to actual evidence.
    if (!dialogueText.includes(quote.toLowerCase())) continue;
    if (!quote.toLowerCase().includes(form.toLowerCase())) continue;
    if (seenForms.has(key)) continue;

    seenForms.add(key);
    words.push({ form, lemma, meaning, quote });
  }

  return {
    suggestedLevel: Math.min(5, Math.max(0, Math.round(suggestedLevel))),
    outcome: proposal.outcome,
    capability: String(proposal.capability ?? "").slice(0, MAX_CAPABILITY),
    nextGoal: String(proposal.nextGoal ?? "").slice(0, MAX_NEXT_GOAL),
    words,
    assessedAt: Date.now(),
  };
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, "");
  }
  return trimmed;
}

/** Fetch and validate one assessment round; null when validation fails. */
export async function requestAssessment(
  input: AssessmentInput,
  apiKey: string,
): Promise<PracticeAssessment | null> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a careful English speaking-practice assessor. Only reference words that appear in the provided dialogue.",
        },
        { role: "user", content: buildAssessmentPrompt(input) },
      ],
      temperature: 0.4,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  let parsed: AssessmentProposal;
  try {
    parsed = JSON.parse(extractJson(content)) as AssessmentProposal;
  } catch {
    return null;
  }

  return validateAssessment(parsed, { segments: input.segments });
}

/**
 * Guidance for the next dialogue, taken from the most recent validated
 * assessment: adaptive difficulty and a teaching focus line.
 */
export function latestAssessmentGuidance(
  sessions: PracticeSession[],
): { level: number; nextGoal: string } | null {
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  for (const session of sorted) {
    const assessment = session.assessment;
    if (assessment && Number.isFinite(assessment.suggestedLevel)) {
      return {
        level: Math.min(5, Math.max(0, assessment.suggestedLevel)),
        nextGoal: assessment.nextGoal,
      };
    }
  }

  return null;
}
