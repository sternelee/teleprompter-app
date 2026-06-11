import React, { createContext, useContext, useState, useCallback } from "react";
import { DialogueSegment } from "@/types/dialogue";

interface AppState {
  apiKey: string;
  scene: string;
  segments: DialogueSegment[];
  isGenerating: boolean;
  generationError: string | null;
  setApiKey: (key: string) => void;
  setScene: (scene: string) => void;
  setSegments: (segments: DialogueSegment[]) => void;
  appendSegments: (segments: DialogueSegment[]) => void;
  resetSession: () => void;
  setIsGenerating: (v: boolean) => void;
  setGenerationError: (e: string | null) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState("");
  const [scene, setSceneState] = useState("");
  const [segments, setSegmentsState] = useState<DialogueSegment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const setApiKey = useCallback((key: string) => setApiKeyState(key), []);
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
    setGenerationError(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        apiKey,
        scene,
        segments,
        isGenerating,
        generationError,
        setApiKey,
        setScene,
        setSegments,
        appendSegments,
        resetSession,
        setIsGenerating,
        setGenerationError,
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
