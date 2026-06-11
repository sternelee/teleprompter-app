# 🌿 Speaking Practice — Animal Crossing Style English Teleprompter

An English speaking practice app with AI-powered dialogue generation and real-time speech recognition. Styled after Animal Crossing's cozy, pastoral UI.

## Features

- 🎭 **Scene-based dialogue** — Enter any scene (e.g., "ordering coffee at Starbucks") and DeepSeek generates natural English dialogue
- 🎤 **Real-time speech recognition** — Reads your spoken words via `expo-speech-recognition` and highlights progress word-by-word
- 📜 **Auto-scrolling teleprompter** — Follows your reading position automatically
- 🌱 **Auto-continuation** — When near the end of dialogue, AI automatically generates the next segment
- 🐻 **Oral correction** — Detects skipped/mispronounced words and shows practice tips
- 🎨 **Animal Crossing UI** — Warm cream backgrounds, mint teal accents, pill-shaped buttons with 3D press shadows, NookPhone-inspired colorful dialogue bubbles

## Tech Stack

- Expo SDK 56 (React Native 0.85 + React 19)
- `expo-router` file-based routing
- `expo-speech-recognition` for voice input
- DeepSeek `deepseek-chat` for dialogue generation
- Nunito rounded font

## Get Started

```bash
npm install
npm start        # Start Expo dev server
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web dev server
```

## Usage

1. Enter your DeepSeek API key in Settings
2. Describe a speaking scene
3. Tap "Start Practice" — AI generates dialogue
4. Tap "Start Speaking" and read aloud
5. Watch words highlight green as you speak, with auto-scroll and auto-continuation

## Project Structure

```
src/
  app/
    _layout.tsx         # Stack navigator root
    index.tsx           # Scene input screen
    settings.tsx        # API key settings
    teleprompter.tsx    # Main teleprompter screen
  components/
    teleprompter-display.tsx  # Word-level highlighting dialogue bubbles
    themed-text.tsx           # Theme-aware text (Nunito font, AC colors)
    themed-view.tsx           # Theme-aware view
  hooks/
    use-speech-recognition.ts # Speech recognition wrapper
    use-word-matcher.ts       # Levenshtein-based word matching
  services/
    openai.ts                 # DeepSeek dialogue generation
  contexts/
    app-context.tsx           # Global state (API key, scene, segments)
  constants/
    theme.ts                  # Animal Crossing design tokens
```

## Design System

Inspired by [animal-island-ui](https://github.com/guokaigdg/animal-island-ui):

- **Colors**: Warm parchment `#f8f8f0`, brown text `#794f27`, mint teal `#19c8b9`
- **Shapes**: Pill buttons (`border-radius: 50px`), minimum `12px` radius everywhere
- **3D Depth**: Bottom thick shadow `0 5px 0 0 #bdaea0`, press down `translateY(2px)` on active
- **Typography**: Nunito rounded, weight 600+, letter-spacing 0.01–0.02em
- **Animation**: `0.15–0.35s` transitions, `cubic-bezier(0.4, 0, 0.2, 1)`
