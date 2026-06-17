import { type Correction, type DialogueSegment } from "./dialogue";

export interface PracticeSession {
  id: string;
  scene: string;
  segments: DialogueSegment[];
  currentWordIndex: number;
  corrections: Correction[];
  createdAt: number;
  updatedAt: number;
  title?: string;
}
