import { type Correction, type DialogueSegment } from "./dialogue";
import type { PracticeAssessment } from "./assessment";

/**
 * `full`  — practice every word in the script (partner + your lines).
 * `role`  — partner lines are read aloud by TTS; you only practice your own lines.
 */
export type PracticeMode = "full" | "role";

export interface PracticeSession {
  id: string;
  scene: string;
  segments: DialogueSegment[];
  currentWordIndex: number;
  corrections: Correction[];
  practiceMode?: PracticeMode;
  createdAt: number;
  updatedAt: number;
  title?: string;
  /** Validated AI assessment for this round (see services/assessment.ts). */
  assessment?: PracticeAssessment;
}
