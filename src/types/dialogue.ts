export interface DialogueSegment {
  id: string;
  speaker: 'ai' | 'user';
  text: string;
}

export interface Word {
  text: string;
  globalIndex: number;
  segmentIndex: number;
  localIndex: number;
  isSpoken: boolean;
}

export interface Correction {
  wordIndex: number;
  expected: string;
  actual: string;
  timestamp: number;
}
