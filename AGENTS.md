# Repository Guidelines

## Project Overview

AI-powered English speaking practice app built with Expo SDK 56 and React Native. Users describe a real-life scene (e.g., "ordering coffee at Starbucks"), the app generates a dialogue via OpenAI GPT-4o, then acts as a teleprompter—listening to the user's speech, matching spoken words to the script in real time, highlighting progress, and offering correction tips for missed words.

**Key features:**
- Scene-to-dialogue generation via OpenAI API
- Real-time speech recognition (`expo-speech-recognition`)
- Fuzzy word matching with Levenshtein similarity
- Auto-scrolling teleprompter with spoken/current/upcoming word states
- Auto-continue: generates more dialogue when the user nears the end
- Animal Crossing / NookPhone-inspired UI theme

**Platforms:** iOS, Android, Web (static output)

---

## Architecture & Data Flow

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  index.tsx  │────▶│  openai.ts      │────▶│  OpenAI GPT-4o   │
│ (scene input)│     │ (generateDialogue)│    │  JSON mode       │
└─────────────┘     └─────────────────┘     └──────────────────┘
        │                                              │
        │           DialogueSegment[]                  │
        ▼                                              │
┌─────────────────────────────────────────────────────────────┐
│                      AppContext                              │
│  { apiKey, scene, segments[], isGenerating, generationError }│
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────────┐
│ teleprompter.tsx │────▶│ useSpeechRecognition │
│ (practice screen)│     │ (expo-speech-recogn) │
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

**State management:** Single React Context (`src/contexts/app-context.tsx`). No external state library. All screen-level state lives in `AppContext`; local UI state (pressed states, inputs) uses `useState` in components.

**Data flow patterns:**
- `index.tsx` captures scene → calls `generateDialogue()` → stores `segments` in context → navigates to `/teleprompter`
- `teleprompter.tsx` reads `segments` from context, derives `Word[]` via `useMemo`, passes to `useWordMatcher`, feeds speech results into `updateProgress()`
- `useWordMatcher` returns `currentWordIndex` and `corrections[]`, which drive rendering and auto-scroll
- Auto-continue: when `totalWords - currentWordIndex <= 8`, `teleprompter.tsx` calls `generateDialogue(scene, apiKey, existingSegments)` and `appendSegments()`

---

## Key Directories

|Directory|Purpose|
|---|---|
|`src/app/`|Expo Router file-based routes. `_layout.tsx` = root Stack navigator. `index.tsx` = scene input. `teleprompter.tsx` = practice screen. `settings.tsx` = modal settings.|
|`src/components/`|Reusable UI components. `themed-text.tsx`, `themed-view.tsx` = theme-aware wrappers. `teleprompter-display.tsx` = dialogue bubble renderer. `animated-icon.tsx` / `.web.tsx` = platform-split splash animation.|
|`src/components/ui/`|Lower-level UI primitives (e.g., `collapsible.tsx`).|
|`src/hooks/`|Custom hooks. `use-speech-recognition.ts` wraps `expo-speech-recognition`. `use-word-matcher.ts` implements fuzzy matching. `use-theme.ts` / `use-color-scheme.ts` = theme resolution.|
|`src/contexts/`|React Context providers. `app-context.tsx` = single global state.|
|`src/services/`|API layer. `openai.ts` = OpenAI chat completions client.|
|`src/types/`|TypeScript interfaces. `dialogue.ts` = `DialogueSegment`, `Word`, `Correction`.|
|`src/constants/`|Design tokens. `theme.ts` = Colors, Fonts, Spacing, Radius, Shadows, NookPalette.|
|`assets/images/`|App icons, splash screen, tab bar icons, branding images.|
|`scripts/`|Utility scripts. `reset-project.js` = moves starter code to `/example`, creates blank `app/`.|

---

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server (Expo CLI)
npm start          # or: npx expo start

# Platform-specific
npm run ios        # iOS simulator
npm run android    # Android emulator
npm run web        # Web dev server

# Linting
npm run lint       # ESLint via expo lint

# Reset project (moves src/scripts to example, creates fresh app/)
npm run reset-project
```

No test runner is configured. To add tests, follow Expo's Jest guide.

---

## Code Conventions & Common Patterns

### File Organization
- **File-based routing:** `src/app/*.tsx` maps directly to routes (`/`, `/teleprompter`, `/settings`)
- **Platform splitting:** Use `.web.tsx` suffix for web-specific component variants (e.g., `animated-icon.tsx` vs `animated-icon.web.tsx`)
- **Path aliases:** `@/*` → `./src/*`, `@/assets/*` → `./assets/*`

### Naming
- Components: PascalCase (`TeleprompterDisplay`, `ThemedText`)
- Hooks: camelCase prefixed with `use` (`useWordMatcher`, `useSpeechRecognition`)
- Services: camelCase functions (`generateDialogue`, `buildPrompt`)
- Types/Interfaces: PascalCase (`DialogueSegment`, `Correction`)
- Constants: PascalCase (`Colors`, `Spacing`, `NookPalette`)

### Theming
- All visual components use `ThemedText` and `ThemedView` wrappers instead of raw `Text`/`View`
- Colors, spacing, radius, and shadows imported from `src/constants/theme.ts`
- Light/dark themes defined in `Colors.light` / `Colors.dark`
- `useTheme()` returns the active color set based on `useColorScheme()`
- Animal Crossing aesthetic: warm browns, mint teal primary (`#19c8b9`), 3D button shadows, rounded corners

### State Management
- Global state: single `AppContext` with `useState` + `useCallback` setters
- Local UI state: `useState` in components (e.g., `buttonPressed`, `inputScene`)
- Refs for mutable values that shouldn't trigger re-renders: `accumulatedRef`, `lastIndexRef`, `fetchingRef`

### Async Patterns
- `generateDialogue()` is a plain `async` function with `fetch()`
- Error handling: try/catch in screen components, errors stored in `generationError` context field
- Speech recognition events handled via `useSpeechRecognitionEvent` callbacks from `expo-speech-recognition`

### Pressable Button Pattern
All buttons use `Pressable` with `onPressIn`/`onPressOut` toggling a `pressed` state, applied to `ThemedView` style arrays for 3D press effect:
```tsx
<Pressable onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}>
  <ThemedView style={[styles.button, pressed && styles.buttonActive]}>
    <ThemedText>...</ThemedText>
  </ThemedView>
</Pressable>
```
Active state uses `transform: [{ translateY: 2 }]` + `Shadows.btnActive` for a pressed-down look.

### Styling
- `StyleSheet.create()` for all component styles
- `Spacing`, `Radius`, `Shadows` tokens used consistently
- `MaxContentWidth = 800` caps content width on large screens
- Inline colors occasionally hardcoded in styles (e.g., `#794f27`, `#c4b89e`)—prefer theme tokens for new code

---

## Important Files

|File|Role|
|---|---|
|`src/app/_layout.tsx`|Root layout: ThemeProvider, AppProvider, Stack navigator with 3 screens|
|`src/app/index.tsx`|Entry screen: scene input, API key configuration, dialogue generation trigger|
|`src/app/teleprompter.tsx`|Main practice screen: speech recognition, word matching, auto-scroll, auto-continue|
|`src/app/settings.tsx`|Modal settings screen: API key input with `secureTextEntry`|
|`src/contexts/app-context.tsx`|Global state: apiKey, scene, segments, generation flags|
|`src/services/openai.ts`|OpenAI client: `generateDialogue(scene, apiKey, previousSegments?)` → `DialogueSegment[]`|
|`src/hooks/use-word-matcher.ts`|Fuzzy word matching: Levenshtein similarity, lookahead=20, backtrack=3, threshold=0.6|
|`src/hooks/use-speech-recognition.ts`|Wraps `expo-speech-recognition`: permission request, event handling, auto-restart on `end`|
|`src/components/teleprompter-display.tsx`|Renders dialogue as colored speech bubbles with spoken/current/error word states|
|`src/constants/theme.ts`|Design tokens: Colors, Fonts, Spacing, Radius, Shadows, NookPalette|
|`package.json`|Scripts, dependencies, entry point: `expo-router/entry`|
|`app.json`|Expo manifest: scheme `teleprompterapp`, plugins, experiments (`typedRoutes`, `reactCompiler`)|
|`tsconfig.json`|Extends `expo/tsconfig.base`, strict mode, path aliases|
|`eslint.config.js`|Flat config using `eslint-config-expo`|

---

## Runtime/Tooling Preferences

|||
|---|---|
|**Framework**|Expo SDK 56 (~56.0.5)|
|**React Native**|0.85.3|
|**React**|19.2.3|
|**Package manager**|npm (lockfile present)|
|**TypeScript**|~6.0.3, strict mode enabled|
|**Linting**|ESLint 9 with flat config (`eslint-config-expo`)|
|**Router**|expo-router (~56.2.7), file-based routing|
|**Animation**|react-native-reanimated (4.3.1), react-native-worklets (0.8.3)|
|**Speech**|expo-speech-recognition (^56.0.0)|
|**Web font**|Nunito (loaded via `expo-font`, declared in `src/global.css`)|

**Expo experiments enabled:**
- `typedRoutes: true` — generates typed route definitions
- `reactCompiler: true` — experimental React Compiler

**No custom build tooling** (no Babel, Metro, Webpack, or Tailwind configs). Relies on Expo's managed workflow.

**Critical doc reference:** Before writing any Expo-specific code, consult the exact versioned docs at `https://docs.expo.dev/versions/v56.0.0/`.

---

## Testing & QA

- **No test runner is currently configured.**
- To add tests, follow Expo's Jest setup guide.
- Linting is available via `npm run lint` (ESLint flat config).
- Manual QA workflow: run `npm run web` or `npm run ios`, enter a scene, verify dialogue generation, start speech recognition, speak words, confirm highlighting and auto-scroll.
