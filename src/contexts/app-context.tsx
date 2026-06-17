import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { clearApiKey, loadApiKey, saveApiKey } from "@/services/secure-storage";
import {
  deleteSession,
  deriveTitle,
  loadSessions,
  saveSession,
} from "@/services/session-storage";
import type { DialogueSegment } from "@/types/dialogue";
import type { PracticeSession } from "@/types/session";

interface AppState {
  apiKey: string;
  scene: string;
  segments: DialogueSegment[];
  isGenerating: boolean;
  generationError: string | null;
  isLoadingApiKey: boolean;
  isLoadingSessions: boolean;
  sessions: PracticeSession[];
  currentSessionId: string | null;
  setApiKey: (key: string) => void;
  clearStoredApiKey: () => void;
  setScene: (scene: string) => void;
  setSegments: (segments: DialogueSegment[]) => void;
  appendSegments: (segments: DialogueSegment[]) => void;
  resetSession: () => void;
  setIsGenerating: (v: boolean) => void;
  setGenerationError: (e: string | null) => void;
  loadSession: (session: PracticeSession) => void;
  startNewSession: (scene: string, segments: DialogueSegment[]) => void;
  saveCurrentSession: (
    progress: Pick<
      PracticeSession,
      "currentWordIndex" | "corrections"
    >,
  ) => void;
}

const AppContext = createContext<AppState | null>(null);

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState("");
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(true);
  const [scene, setSceneState] = useState("");
  const [segments, setSegmentsState] = useState<DialogueSegment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [sessions, setSessionsState] = useState<PracticeSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadApiKey().then((key) => {
      if (!cancelled) {
        setApiKeyState(key);
        setIsLoadingApiKey(false);
      }
    });

    void loadSessions().then((loaded) => {
      if (!cancelled) {
        setSessionsState(loaded);
        setIsLoadingSessions(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    void saveApiKey(key);
  }, []);

  const clearStoredApiKey = useCallback(() => {
    setApiKeyState("");
    void clearApiKey();
  }, []);

  const setScene = useCallback((s: string) => setSceneState(s), []);
  const setSegments = useCallback(
    (s: DialogueSegment[]) => setSegmentsState(s),
    [],
  );

  const appendSegments = useCallback((newSegments: DialogueSegment[]) => {
    setSegmentsState((prev) => [...prev, ...newSegments]);
  }, []);

  const resetSession = useCallback(() => {
    setSceneState("");
    setSegmentsState([]);
    setCurrentSessionId(null);
    setGenerationError(null);
  }, []);

  const loadSession = useCallback((session: PracticeSession) => {
    setCurrentSessionId(session.id);
    setSceneState(session.scene);
    setSegmentsState(session.segments);
    setGenerationError(null);
  }, []);

  const startNewSession = useCallback(
    (nextScene: string, nextSegments: DialogueSegment[]) => {
      const id = generateSessionId();
      setCurrentSessionId(id);
      setSceneState(nextScene);
      setSegmentsState(nextSegments);
      setGenerationError(null);

      const session: PracticeSession = {
        id,
        scene: nextScene,
        segments: nextSegments,
        currentWordIndex: -1,
        corrections: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        title: deriveTitle(nextScene),
      };

      void saveSession(session);
      setSessionsState((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        return [session, ...filtered];
      });
    },
    [],
  );

  const saveCurrentSession = useCallback(
    (progress: Pick<PracticeSession, "currentWordIndex" | "corrections">) => {
      if (!currentSessionId) return;

      const session: PracticeSession = {
        id: currentSessionId,
        scene,
        segments,
        currentWordIndex: progress.currentWordIndex,
        corrections: progress.corrections,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        title: deriveTitle(scene),
      };

      void saveSession(session);
      setSessionsState((prev) => {
        const filtered = prev.filter((s) => s.id !== session.id);
        return [session, ...filtered];
      });
    },
    [currentSessionId, scene, segments],
  );

  const removeSession = useCallback((id: string) => {
    void deleteSession(id);
    setSessionsState((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return (
    <AppContext.Provider
      value={{
        apiKey,
        scene,
        segments,
        isGenerating,
        generationError,
        isLoadingApiKey,
        isLoadingSessions,
        sessions,
        currentSessionId,
        setApiKey,
        clearStoredApiKey,
        setScene,
        setSegments,
        appendSegments,
        resetSession,
        setIsGenerating,
        setGenerationError,
        loadSession,
        startNewSession,
        saveCurrentSession,
        removeSession,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
