# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

Expo SDK 56 universal app (iOS, Android, Web) built with React Native 0.85 and React 19. Uses file-based routing via `expo-router`.

**Product**: English speaking practice teleprompter app with AI-generated dialogue and real-time speech recognition. UI styled after Animal Crossing (cozy pastoral aesthetic via [animal-island-ui](https://github.com/guokaigdg/animal-island-ui)).

## Development Commands

```bash
npm start          # Start Expo dev server
npm run ios        # Start with iOS simulator
npm run android    # Start with Android emulator
npm run web        # Start web dev server
npm run lint       # Run ESLint (via expo lint)
```

**No test runner is configured.**

## Architecture

### File-Based Routing (Stack Navigator)
Routes live in `src/app/` and are handled by `expo-router`:
- `src/app/_layout.tsx` — Root Stack layout. Wraps app in `ThemeProvider` + `AppProvider`.
- `src/app/index.tsx` — Home screen. Scene description input + API key configuration.
- `src/app/settings.tsx` — API key settings (modal presentation).
- `src/app/teleprompter.tsx` — Main teleprompter screen with speech recognition.

**Note**: The app uses a Stack navigator, not Tabs. The original tab components (`app-tabs.tsx`, `app-tabs.web.tsx`) and `explore.tsx` were removed.

### Platform-Specific Files
The codebase uses `.web.tsx` / `.tsx` platform splitting for components that differ across native and web:
- `src/components/animated-icon.tsx` / `animated-icon.web.tsx`
- `src/hooks/use-color-scheme.ts` / `use-color-scheme.web.ts`

### State Management
Single React Context in `src/contexts/app-context.tsx`:
- `apiKey` — OpenAI API key (in-memory only, user inputs per session)
- `scene` — Current scene description
- `segments` — `DialogueSegment[]` array, append-only as AI generates more
- `isGenerating`, `generationError` — Async state for OpenAI calls

### Core Features

**AI Dialogue Generation** (`src/services/openai.ts`):
- Calls OpenAI GPT-4o with JSON response format
- Initial prompt generates 8-12 lines of natural English dialogue
- Continuation prompt appends seamlessly when near end

**Speech Recognition** (`src/hooks/use-speech-recognition.ts`):
- Wraps `expo-speech-recognition`
- Uses `interimResults: true`, auto-restarts on `end` event for cross-platform continuous listening
- Language: `en-US`

**Word Matching** (`src/hooks/use-word-matcher.ts`):
- Levenshtein distance algorithm for fuzzy word matching
- Sliding window search with backtrack support
- Detects skipped words as oral corrections

**Teleprompter Display** (`src/components/teleprompter-display.tsx`):
- Renders dialogue as colorful bubbles (NookPalette rotates per segment)
- Word-level highlighting: green = spoken, yellow = current, red underline = error
- AI lines left-aligned, user lines right-aligned

### Theming (Animal Crossing Style)

**Design tokens** in `src/constants/theme.ts`:
- **Colors**: `background: '#f8f8f0'`, `text: '#794f27'`, `primary: '#19c8b9'`, `spoken: '#6fba2c'`, `error: '#e05a5a'`
- **Shadows**: 3D bottom shadows (`Shadows.btn`, `Shadows.input`, `Shadows.card`)
- **Radius**: `sm: 12`, `base: 18`, `lg: 24`, `pill: 50`
- **Spacing**: `xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 24`
- **NookPalette**: 12 pastel colors for dialogue bubbles

**Components**:
- `ThemedText` — Nunito font, weight 600+, Animal Crossing color tokens
- `ThemedView` — Background color via `ThemeColor` type

**Web fonts** loaded via Google Fonts CDN in `src/global.css` (`Nunito` family).

### Path Aliases
- `@/*` → `./src/*`
- `@/assets/*` → `./assets/*`

## Key Configuration

- `app.json`: Configures `expo-router` plugin, splash screen, static web output, deep-link scheme (`teleprompterapp`), typed routes, and React Compiler experiment.
- `tsconfig.json`: Extends `expo/tsconfig.base`, enables strict mode.
- `.vscode/settings.json`: Enables `fixAll`, `organizeImports`, and `sortMembers` on save.

## Expo Documentation Reference

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.
