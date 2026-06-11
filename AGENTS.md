# Repository Guidelines

## Project Overview

AI-powered English speaking practice app built with Expo SDK 56 and React Native. Users describe a real-life scene, the app generates a dialogue via DeepSeek (`deepseek-chat`), then acts as a teleprompter -- listening to the user's speech, matching spoken words to the script in real time, highlighting progress, and offering correction tips for missed words.

**Platforms:** iOS, Android, Web (static output)

---

## Architecture & Data Flow

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│  index.tsx  │────▶│  openai.ts      │────▶│      DeepSeek        │
│ (scene input)│     │ (generateDialogue)│    │  (deepseek-chat)    │
└─────────────┘     └─────────────────┘     └──────────────────────┘
        │                                              │
        │           DialogueSegment[]                  │
        ▼                                              │
┌────────────────────────────────────────────────────────────┐
│                      AppContext                             │
│  { apiKey, scene, segments[], isGenerating, generationError }│
└────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────────┐
│ teleprompter.tsx│────▶│ useSpeechRecognition│
│ (practice screen)│     │ (expo-speech-recogn)│
└─────────────────┘     └─────────────────────┘
        │                          │
        │ spoken text              │
        ▼                          │
┌─────────────────┐                │
│ useWordMatcher  │◀───────────────┘
│ (Levenshtein +  │
│  lookahead)     │
└─────────────────┘
        │
        ▼ { currentWordIndex, corrections }
┌─────────────────────┐
│ teleprompter-display │
│ (bubble UI, auto-    │
│  scroll, progress)   │
└─────────────────────┘
```

**State management:** Single React Context (`src/contexts/app-context.tsx`). No external state library. Global state lives in `AppContext`; local UI state uses `useState`.

**Data flow:**
- `index.tsx` captures scene → calls `generateDialogue()` → stores `segments` in context → navigates to `/teleprompter`
- `teleprompter.tsx` reads `segments` from context, derives `Word[]` via `useMemo`, passes to `useWordMatcher`
- `useWordMatcher` returns `currentWordIndex` and `corrections[]`, driving rendering and auto-scroll
- Auto-continue: when `totalWords - currentWordIndex <= 8`, calls `generateDialogue()` again and `appendSegments()`

---

## Development Commands

```bash
npm install          # Install dependencies
npx expo start       # Start dev server
npm run web          # Web dev server
npm run ios          # iOS simulator
npm run android      # Android emulator
npm run lint         # ESLint (flat config, expo lint)
npx eslint <file>    # Lint a single file
npm run reset-project # DESTRUCTIVE: moves src/app to /example, creates blank app/
```

**No test runner is configured.** If added, use Expo's Jest guide.

---

## API: DeepSeek (NOT OpenAI)

**Critical gotcha:** Despite the filename `src/services/openai.ts`, this codebase calls **DeepSeek**, not OpenAI.

| Detail | Value |
|---|---|
| Endpoint | `https://api.deepseek.com/chat/completions` |
| Model | `deepseek-chat` |
| Auth | `Bearer {apiKey}` header |
| Extra params | `response_format: { type: 'json_object' }` |
| Response format | JSON mode response, parsed from `choices[0].message.content` |

The `apiKey` is user-provided per session via the Settings screen, stored in AppContext (in-memory only, never committed).

---

## Key Directories

|Directory|Purpose|
|---|---|
|`src/app/`|Expo Router file-based routes. `_layout.tsx` = root Stack navigator with 3 screens.|
|`src/components/`|Reusable UI. `themed-text.tsx`, `themed-view.tsx` = theme wrappers. `teleprompter-display.tsx` = dialogue bubble renderer.|
|`src/hooks/`|Custom hooks. `use-speech-recognition.ts`, `use-word-matcher.ts`, `use-theme.ts`|
|`src/contexts/`|`app-context.tsx` = single global state provider|
|`src/services/`|`openai.ts` = DeepSeek client (legacy filename!)|
|`src/types/`|`dialogue.ts` = `DialogueSegment`, `Word`, `Correction`|
|`src/constants/`|`theme.ts` = Colors, Fonts, Spacing, Radius, Shadows, NookPalette|

---

## Code Conventions

### File Organization
- **File-based routing:** `src/app/*.tsx` → routes (`/`, `/teleprompter`, `/settings`)
- **Platform splitting:** `.web.tsx` suffix for web-specific variants (e.g., `animated-icon.web.tsx`, `use-color-scheme.web.ts`)
- **Path aliases:** `@/*` → `./src/*`, `@/assets/*` → `./assets/*`

### Naming
- Components: PascalCase (`TeleprompterDisplay`, `ThemedText`)
- Hooks: camelCase prefixed with `use`
- Types/Interfaces: PascalCase (`DialogueSegment`, `Correction`)
- Constants: PascalCase (`Colors`, `Spacing`)

### Theming (Animal Crossing / NookPhone style)
- **Always use `ThemedText` and `ThemedView`** instead of raw `Text`/`View`
- Design tokens in `src/constants/theme.ts`: Colors (light/dark), Spacing, Radius, Shadows
- Primary color: `#19c8b9` (mint teal). Warm browns (`#794f27`), cream backgrounds (`#f8f8f0`)
- `NookPalette`: 12 pastel colors for dialogue bubble backgrounds
- `MaxContentWidth = 800`
- Prefer theme tokens for colors; avoid inline hex values for new code

### Pressable Button Pattern
```tsx
<Pressable onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}>
  <ThemedView style={[styles.button, pressed && styles.buttonActive]}>
    <ThemedText>...</ThemedText>
  </ThemedView>
</Pressable>
```
Active state: `transform: [{ translateY: 2 }]` + `Shadows.btnActive`.

### Styling
- `StyleSheet.create()` for all component styles
- Use `Spacing`, `Radius`, `Shadows` tokens consistently

### State Management
- Single `AppContext` with `useState` + `useCallback` setters. Avoid external state libraries.
- Refs for mutable values that shouldn't trigger re-renders

### Speech Recognition
- 250ms auto-restart delay on `end` event for continuous listening
- `interimResults: true`, `continuous: true`, `lang: 'en-US'`

### Word Matching
- Levenshtein similarity with threshold `0.6`, lookahead `20`, backtrack `3`
- `useWordMatcher` returns `currentWordIndex` and `corrections[]`
- Reuse this hook -- do not write new string-matching logic

---

## Important Files

|File|Role|
|---|---|
|`src/app/_layout.tsx`|Root: ThemeProvider, AppProvider, Stack navigator with 3 screens|
|`src/app/index.tsx`|Scene input, API key config, dialogue generation trigger|
|`src/app/teleprompter.tsx`|Practice screen: speech recognition, word matching, auto-scroll|
|`src/app/settings.tsx`|Modal settings: API key input with `secureTextEntry`|
|`src/contexts/app-context.tsx`|Global state: apiKey, scene, segments, generation flags|
|`src/services/openai.ts`|**DeepSeek client** (legacy filename): `generateDialogue(scene, apiKey, previousSegments?)`|
|`src/hooks/use-word-matcher.ts`|Fuzzy matching: Levenshtein, lookahead=20, backtrack=3, threshold=0.6|
|`src/hooks/use-speech-recognition.ts`|Wraps `expo-speech-recognition`: permissions, events, auto-restart|
|`src/components/teleprompter-display.tsx`|Dialogue bubbles with spoken/current/error word states|
|`src/constants/theme.ts`|Design tokens: Colors, Fonts, Spacing, Radius, Shadows, NookPalette|

---

## Runtime

- **Framework:** Expo SDK 56 managed workflow (no custom build tooling)
- **React Native:** 0.85.3, **React:** 19.2.3, **TypeScript:** ~6.0.3 (strict mode)
- **Router:** expo-router (file-based), `typedRoutes: true` experiment enabled
- **React Compiler:** experimental (`reactCompiler: true` in app.json)
- **Font:** Nunito (Google Fonts CDN in `src/global.css`)
- **VSCode:** `fixAll`, `organizeImports`, `sortMembers` enabled on save
- **Expo docs:** `https://docs.expo.dev/versions/v56.0.0/`

---

## Related Files

- `CLAUDE.md` — references this file (`@AGENTS.md`)
- `.github/copilot-instructions.md` — Copilot-specific guidance
