# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (nodemon, port 3000)
npm start            # Start production server
npm test             # Run Jest test suite (verbose)
npm run test:watch   # Run Jest in watch mode
npm run build:web    # Bundle web assets to dist/ and copy avatars
npm run cap:sync     # Build web + sync to Capacitor for mobile
npm run build:apk    # Full Android APK build (requires Android SDK)
```

> **IMPORTANT — AAB builds**: Always bump the version in ALL FOUR places before running `npm run build:aab`:
> 1. `versionCode` and `versionName` in `android/app/build.gradle`
> 2. `version` in `package.json`
> 3. Version display on the start screen in `docs/client.html` (search `v0.2.`)
>
> The Play Store rejects duplicate version codes. Run `gradlew clean` if the version does not change after a bump.

Run a single test file:
```bash
npx jest __tests__/EmotionEngine.test.js
```

## Environment Setup

Copy `.env.example` to `.env` and set `GROQ_API_KEY` (from console.groq.com). Optional: `PORT`, `GROQ_MODEL`, temperature parameters.

## Architecture

MyPAiL is an Express backend serving an Emotional AI Companion. The core innovation is a two-dimensional emotion system that drives all responses.

### Emotion System

Two independent dimensions tracked per session:
- **Phone emotion**: derived from device metrics (battery, network, memory)
- **Prompt emotion**: derived from interaction history (accumulated via keyword triggers)
- **Combined emotion** = average of the two (0–100 scale)

**Emotion state** (personality tendency) is determined by combined emotion vs thresholds in `config.js`:
- `VERY_BAD` (0–25), `BAD` (25–50), `GOOD` (50–75), `VERY_GOOD` (75+)

**Emotion level** (intensity) is the raw combined value (0–100).

All tunable parameters (trigger weights, thresholds, persistence factors) live in `config.js`.

### Request/Response Flow

`POST /api/chat` → `MessageAnalyzer.js` (intent detection) → `EmotionEngine.js` (state update) → `ResponseGenerator.js` (response selection) → `GroqService.js` (fallback LLM)

**Response selection**: `responses_complete.json` (~1000 static responses) indexed by `category × emotionState × level`. If no static response exists, falls back to Groq API.

### Key Files

| File | Responsibility |
|------|---------------|
| `server.js` | Express routes, request handling |
| `EmotionEngine.js` | Emotion state calculation and persistence |
| `MessageAnalyzer.js` | Keyword/intent detection (PRAISE, INSULT, DEATH_THREAT, etc.) |
| `ResponseGenerator.js` | Selects response from static pool or triggers Groq fallback |
| `SessionManager.js` | File-based session persistence in `sessions/` directory |
| `GroqService.js` | Groq LLM API integration |
| `config.js` | All tunable parameters (emotion triggers, thresholds, keywords) |
| `responses_complete.json` | Static response pool |
| `BetaMetrics.js` | Analytics tracking |

### Frontend

`docs/client.html` is the main single-file web UI (2471 lines). Multiple themed variants exist (`pail.html`, `cat.html`, `blob.html`, `ko.html`, `es.html`). `src/capacitor-bridge.js` handles mobile-specific functionality via Capacitor.

### Special Modes

- **Empathy mode**: Short 1–4 word interjections (`empathyType: 'user_good'` or `'user_bad'`); uses static responses first, Groq as fallback
- **Confession mode**: Spy interrogation narrative triggered by "I know who you are" (multilingual); resolved by emotion thresholds
