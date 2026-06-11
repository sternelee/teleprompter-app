# .github/copilot-instructions.md

Purpose
- Provide concise, repo-specific guidance for Copilot-style assistants working on teleprompter-app.

Quick commands (run from repo root)
- Install: npm install
- Dev server: npm start
- Web: npm run web
- iOS: npm run ios
- Android: npm run android
- Lint: npm run lint  (runs `expo lint`)
- Reset project helper: npm run reset-project

Tests
- No test runner is configured in this repository. If tests are added, prefer Jest.
- Example single-test commands (once Jest is installed):
  - Run a single test file: npx jest path/to/file.test.ts
  - Run by test name: npx jest -t "substring of test name"

High-level architecture (big picture)
- File-based routing: src/app/* (expo-router). index.tsx is the scene input.
- Dialogue generation: src/services/openai.ts -> calls DeepSeek `deepseek-chat` (JSON) and returns DialogueSegment[].
- Global state: src/contexts/app-context.tsx stores apiKey, scene, segments[], flags.
- Teleprompter runtime: src/app/teleprompter.tsx uses use-speech-recognition and use-word-matcher (fuzzy Levenshtein) and renders via teleprompter-display.
- Auto-continue: teleprompter appends new segments when remaining words <= 8.

Key conventions (copy these patterns)
- Themed components: use ThemedText and ThemedView instead of raw Text/View. Theme tokens live in src/constants/theme.ts.
- Pressable 3D buttons: use <Pressable onPressIn/onPressOut> to toggle a `pressed` state, apply transform: [{translateY: 2}] and Shadows tokens for active look.
- Platform splits: implement web-specific variants using `.web.tsx` files (e.g., animated-icon.web.tsx).
- Path aliases: `@/*` → `./src/*` (use these when generating imports).
- Word-matching: use src/hooks/use-word-matcher.ts (Levenshtein + lookahead=20, backtrack=3, threshold ~0.6). Prefer reusing this hook over writing new string-matching logic.
- Speech wrapper: src/hooks/use-speech-recognition.ts handles permissions, interimResults, and auto-restart — reuse it for audio input.
- DeepSeek usage: prefer using src/services/openai.ts and its JSON response format; continuation appends to existing segments rather than replacing.
- State: there is a single AppContext; avoid introducing global state libraries.
- Secrets: API keys are stored in-memory via the settings screen; never hardcode or commit secrets.

Files worth checking first
- README.md, CLAUDE.md, AGENTS.md — they contain architecture and developer commands.
- src/services/openai.ts, src/contexts/app-context.tsx, src/app/teleprompter.tsx, src/hooks/use-word-matcher.ts, src/hooks/use-speech-recognition.ts

Developer workflow notes for Copilot
- Prefer small, surgical edits that reuse existing hooks/components (theme tokens, ThemedView/Text, useWordMatcher).
- When adding UI, match spacing/radius/shadow tokens from src/constants/theme.ts.
- For platform differences favor `.web.tsx` variants rather than branching inside components.
- Lint with `npm run lint`; for a targeted lint run use `npx eslint <file>`.

References
- Expo docs (v56): https://docs.expo.dev/versions/v56.0.0/
