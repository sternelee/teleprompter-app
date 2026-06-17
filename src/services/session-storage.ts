import AsyncStorage from "@react-native-async-storage/async-storage";

import type { PracticeSession } from "@/types/session";

const SESSIONS_KEY = "practice_sessions";
const MAX_SESSIONS = 20;

export async function loadSessions(): Promise<PracticeSession[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as PracticeSession[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (s): s is PracticeSession =>
          typeof s === "object" &&
          s !== null &&
          typeof s.id === "string" &&
          typeof s.scene === "string" &&
          Array.isArray(s.segments),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.warn("Failed to load practice sessions:", error);
    return [];
  }
}

export async function saveSessions(sessions: PracticeSession[]): Promise<void> {
  try {
    const trimmed = sessions
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_SESSIONS);
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.warn("Failed to save practice sessions:", error);
  }
}

export async function saveSession(session: PracticeSession): Promise<void> {
  const sessions = await loadSessions();
  const index = sessions.findIndex((s) => s.id === session.id);

  const nextSession: PracticeSession = {
    ...session,
    updatedAt: Date.now(),
    title: session.title || deriveTitle(session.scene),
  };

  if (index >= 0) {
    sessions[index] = nextSession;
  } else {
    sessions.unshift(nextSession);
  }

  await saveSessions(sessions);
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await loadSessions();
  const filtered = sessions.filter((s) => s.id !== id);
  await saveSessions(filtered);
}

export function deriveTitle(scene: string): string {
  const trimmed = scene.trim();
  if (!trimmed) return "Untitled practice";
  if (trimmed.length <= 36) return trimmed;
  return `${trimmed.slice(0, 33).trimEnd()}…`;
}
