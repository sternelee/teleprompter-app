import { useState, useCallback, useRef } from 'react';
import { Word, Correction } from '@/types/dialogue';

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[.,!?;:"'()\[\]{}]/g, '');
}

function wordSimilarity(a: string, b: string): number {
  const na = normalizeWord(a);
  const nb = normalizeWord(b);
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

const MATCH_THRESHOLD = 0.6;
const LOOKAHEAD = 20;
const BACKTRACK = 3;

interface UseWordMatcherResult {
  currentWordIndex: number;
  corrections: Correction[];
  updateProgress: (spokenText: string) => void;
  resetProgress: () => void;
}

export function useWordMatcher(words: Word[]): UseWordMatcherResult {
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const lastIndexRef = useRef(-1);
  const lastSpokenRef = useRef('');

  const updateProgress = useCallback(
    (spokenText: string) => {
      if (words.length === 0) return;
      if (spokenText === lastSpokenRef.current) return;
      lastSpokenRef.current = spokenText;

      const spokenWords = tokenize(spokenText);
      if (spokenWords.length === 0) return;

      const searchStart = Math.max(0, lastIndexRef.current - BACKTRACK);
      const searchEnd = Math.min(words.length, lastIndexRef.current + LOOKAHEAD + spokenWords.length);

      let bestIndex = lastIndexRef.current;
      let bestScore = 0;

      for (let i = searchStart; i < searchEnd; i++) {
        let score = 0;
        let consecutive = 0;
        let matchedCount = 0;

        for (let j = 0; j < spokenWords.length && i + j < words.length; j++) {
          const sim = wordSimilarity(spokenWords[j], words[i + j].text);
          if (sim > MATCH_THRESHOLD) {
            consecutive++;
            score += consecutive * sim;
            matchedCount++;
          } else {
            consecutive = 0;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestIndex = i + matchedCount - 1;
        }
      }

      if (bestIndex > lastIndexRef.current) {
        // Detect errors in skipped words
        const newCorrections: Correction[] = [];
        for (let k = lastIndexRef.current + 1; k <= bestIndex; k++) {
          if (k >= 0 && k < words.length) {
            const expected = normalizeWord(words[k].text);
            if (expected.length < 2) continue;

            let found = false;
            for (const sw of spokenWords) {
              if (wordSimilarity(sw, words[k].text) > MATCH_THRESHOLD) {
                found = true;
                break;
              }
            }
            if (!found) {
              newCorrections.push({
                wordIndex: k,
                expected: words[k].text,
                actual: '(missed)',
                timestamp: Date.now(),
              });
            }
          }
        }

        if (newCorrections.length > 0) {
          setCorrections((prev) => [...prev, ...newCorrections]);
        }

        lastIndexRef.current = bestIndex;
        setCurrentWordIndex(bestIndex);
      }
    },
    [words]
  );

  const resetProgress = useCallback(() => {
    setCurrentWordIndex(-1);
    setCorrections([]);
    lastIndexRef.current = -1;
    lastSpokenRef.current = '';
  }, []);

  return { currentWordIndex, corrections, updateProgress, resetProgress };
}
