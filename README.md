# MyPAiL — Personal AI Lackey

An emotional AI companion app with a two-dimensional emotion system, multiple character support, and voice output. Built with Express + Groq, packaged for Android via Capacitor.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Architecture](#architecture)
- [Emotion System](#emotion-system)
- [Characters](#characters)
- [Avatars](#avatars)
- [Training Screen](#training-screen)
- [Special Modes](#special-modes)
- [Voice & TTS](#voice--tts)
- [Response System](#response-system)
- [Build & Deploy](#build--deploy)
- [Version Bumping](#version-bumping)
- [Key Files](#key-files)

---

## Overview

MyPAiL is an emotional AI companion that reacts to how you treat it. Its mood is tracked across two independent dimensions — phone state and interaction history — and every response reflects its current emotional state and intensity.

Key traits:
- Emotional state driven by user interactions (praise, insults, threats, empathy)
- Phone metrics (battery, network, memory) affect mood passively
- Static response pool (~1000 responses) + Groq LLM fallback
- Multi-character support (beta: 2 characters)
- Confession/interrogation mode, empathy mode
- Emotion-driven TTS with selectable voice styles

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Add GROQ_API_KEY from console.groq.com

# 3. Run development server
npm run dev        # nodemon, port 3000

# 4. Open browser
open http://localhost:3000
```

---

## Commands

Type these in the chat input:

| Command | Description |
|---|---|
| `/help` | Show all available commands |
| `/change character <name>` | Switch to a character by name |
| `/show emotion` | Show current emotion state and level |
| `/show name` | Show current AI name |
| `/show traits` | Show personality traits |
| `/change very_bad` | Force emotion to VERY_BAD (testing) |
| `/change bad` | Force emotion to BAD (testing) |
| `/change good` | Force emotion to GOOD (testing) |

---

## Architecture

```
POST /api/chat
  → MessageAnalyzer.js     (intent/category detection)
  → EmotionEngine.js       (state + level calculation)
  → ResponseGenerator.js   (static response selection)
  → GroqService.js         (LLM fallback)
```

### Request / Response Flow

1. Message is analyzed for category (PRAISE, INSULT, DEATH_THREAT, GREETING, etc.)
2. Emotion state is recalculated from interaction history + phone metrics
3. Static response is selected from `responses_complete.json` by `category × state × level`
4. If no static response exists (non-English, themed category, etc.), Groq generates one
5. Response is returned with `avatarHint` (emotion state) for the frontend to render the correct avatar image

---

## Emotion System

Two independent dimensions tracked per session:

| Dimension | Source | Range |
|---|---|---|
| Phone emotion | Battery, network signal, memory usage | 0–100 |
| Prompt emotion | Accumulated keyword triggers (praise, insults, threats, etc.) | 0–100 |

**Combined emotion** = average of the two.

**Emotion state** (personality tendency) is derived from combined emotion vs thresholds in `config.js`:

| State | Default Range | Behavior |
|---|---|---|
| `VERY_BAD` | 0–25 | Desperate, overwhelmed (dominant) / Angry (submissive) |
| `BAD` | 25–50 | Upset, reserved (dominant) / Crying, heartbroken (submissive) |
| `GOOD` | 50–75 | Friendly, cheerful |
| `VERY_GOOD` | 75–100 | Enthusiastic, euphoric |

**Emotion level** (intensity) is the raw combined value (0–100) and determines which response within a state's pool is selected.

### Avatar Personality Types

Avatars have two personality modes that affect how negative emotions are expressed:

- **Dominant** (Pail, Pailoid, Cat): BAD = defensive/upset, VERY_BAD = desperate/overwhelmed
- **Submissive** (Girl): BAD = crying/heartbroken, VERY_BAD = furious/angry

The personality type is passed to Groq so all generated responses match the character's expression style.

---

## Characters

Beta supports **up to 2 characters** simultaneously. Each character has its own:
- Name and avatar
- Session ID and conversation history
- Emotion state and training levels
- Spy role, user name preference, and voice style
- Custom avatar image (if uploaded)

### Switching Characters

- Use the **Switch Character / Add Character** button in the main screen
- Or type `/change character <name>` in chat
- Characters are saved to `localStorage` as an array (`emotionalAI_characters`)

### Rules
- Two characters cannot share the same name (case-insensitive)
- Adding a new character clears the name/avatar selection form

---

## Avatars

| Avatar | Type | Personality |
|---|---|---|
| Pail | SVG (generated) | Dominant |
| Pailoid | PNG images | Dominant |
| Cat | SVG (generated) | Dominant |
| Girl | PNG images | Submissive |
| Custom | Uploaded image (base64) | Dominant |

### Girl Avatar States

| Emotion State | Image File | Expression |
|---|---|---|
| GOOD | `girl_good.png` | Happy |
| VERY_GOOD | `girl_very_good.png` | Excited |
| BAD | `girl_bad.png` | Crying |
| VERY_BAD | `girl_very_bad.png` | Angry |

### Custom Avatar Upload

Users can upload their own image. It is compressed client-side (max 300px, JPEG 0.8) and stored as base64 in `localStorage`.

---

## Training Screen

The training screen lets users configure their character's personality and settings. It is accessible from the main screen via the **Train Character** button.

### Spy Role

Sets the character's secret identity for confession/interrogation mode. Predefined options plus a "planted by someone else..." free-text option.

### User Name

How the AI addresses the user. Options:

`Master` · `Sir` · `Madam` · `Pal` · `Buddy` · `Bro` · `Sis` · `My real name...`

Stored in `localStorage` as `emotionalAI_userName` and passed with every chat request so Groq uses it naturally in responses.

### Voice Style

Sets the TTS voice character. Options:

| Style | Voice Selection | Pitch | Rate |
|---|---|---|---|
| Girl | Prefers female voices (Samantha, Karen, Zira…) | Emotion-driven | Emotion-driven |
| Boy | Prefers male voices (Daniel, Alex, David…) | −0.3 lower | Emotion-driven |
| Robotic | Best available | Fixed 0.5 | Fixed 0.95 |
| Childish | Prefers female/light voices | +0.7 higher (max 2.0) | Emotion-driven |

### Training Actions (max 20 per session)

Adjust the character's personality thresholds by reinforcing or discouraging emotional tendencies. Actions: Praise, Scold, Reward, Punish, Comfort, Ignore.

---

## Special Modes

### Empathy Mode

Triggered when the user shares something personal. The AI listens with short 1–4 word interjections, then gives a closing piece of advice when the mode ends.

- `empathyType: 'user_good'` — user sharing positive news
- `empathyType: 'user_bad'` — user sharing difficult news

### Confession / Interrogation Mode

Triggered by "I know who you are" (works in English, Korean, Spanish).

The AI plays a spy with a configurable secret role (set in training). It denies everything through multiple interrogation turns, then eventually breaks and confesses — either triumphantly (bragging) or tearfully (naming the agent that sent it).

**Confession resolution:**
- User says something forgiving → AI is spared, mode ends
- User says they don't believe it → pressure increases
- Threshold crossed → forced admission

**Spare / Delete Character buttons** appear inside the chat response window during confession mode.

---

## Voice & TTS

### Emotion-Driven Parameters

| Emotion State | Pitch (dominant) | Rate |
|---|---|---|
| VERY_BAD | 1.15–1.30 (high, distressed) | Slow (0.78) |
| BAD | 1.03–1.15 | Slow-moderate |
| GOOD | 1.0 | Moderate (0.93) |
| VERY_GOOD | 1.0–1.28 (rising) | Fast (1.15) |

VERY_BAD responses (non-robotic) are split on punctuation with 300ms pauses to simulate a sobbing rhythm.

### Voice Selection Priority (fallback order)

1. Edge Neural (e.g. "Microsoft Guy Natural")
2. Microsoft Online voices
3. Google US Neural
4. Google any English
5. Apple Enhanced / Premium
6. Siri
7. Any cloud en-US
8. Any cloud English
9. Local en-US
10. Any local English

---

## Response System

Responses come from two sources:

### 1. Static Pool (`responses_complete.json`)

~1000 pre-written responses indexed by `category × state × level`.

The level (0–100) maps to a position within the state's response array, producing intensity gradients. Higher level = more intense expression within the same state.

**Categories:** PRAISE, INSULT, DEATH_THREAT, GREETING, CONFESSION, CONFESSION_ADMIT_GOOD, CONFESSION_ADMIT_BAD, EMPATHY_GOOD, EMPATHY_BAD, RIVAL_ENVY, RIVAL_DESPISE, DENIAL, JOKING, USER_POSITIVE, USER_NEGATIVE, NAME_QUERY, AVATAR_STATE

### 2. Groq LLM Fallback

Used when:
- No static response exists for the category
- Message is non-English (for themed categories)
- Category is AVATAR_STATE (always needs live device data)

The system prompt includes: AI name, user name, emotion state, emotion level, personality type (dominant/submissive), and conversation history (last 10 turns).

---

## Build & Deploy

```bash
npm run build:web    # Bundle web assets → dist/
npm run cap:sync     # Build web + sync to Android via Capacitor
npm run build:apk    # Full debug APK build + upload to Google Drive
npm run build:aab    # Full release AAB build + upload to Google Drive
```

### AAB Build Pipeline

```
keystore:pull   → sync signing key from Google Drive
cap:sync        → build web assets + sync to Capacitor
gradlew bundleRelease → build signed AAB
rclone copy     → upload AAB to Google Drive > MyPAiL
```

---

## Version Bumping

```bash
npm run bump
```

This script (`scripts/bump.js`) automatically:
1. Increments the patch version in `package.json`
2. Increments `versionCode` and updates `versionName` in `android/app/build.gradle`
3. Updates the version display in `docs/client.html`
4. Commits all three files with message `"Bump version to X.Y.Z"`
5. Pushes to remote
6. Runs `npm run build:aab`

> The Play Store rejects duplicate version codes. Always run `npm run bump` before submitting a new build. Run `gradlew clean` if the version doesn't change after a bump.

---

## Key Files

| File | Responsibility |
|---|---|
| `server.js` | Express routes, request handling, confession logic |
| `EmotionEngine.js` | Emotion state calculation and session persistence |
| `MessageAnalyzer.js` | Keyword/intent detection |
| `ResponseGenerator.js` | Static response selection by category × state × level |
| `GroqService.js` | Groq LLM integration, all prompt templates |
| `SessionManager.js` | File-based session persistence (`sessions/` directory) |
| `config.js` | All tunable parameters (emotion triggers, thresholds, keywords) |
| `responses_complete.json` | Static response pool |
| `BetaMetrics.js` | Analytics tracking |
| `docs/client.html` | Main single-file web UI (~2800 lines) |
| `src/capacitor-bridge.js` | Mobile-specific functionality (TTS, speech recognition, device) |
| `scripts/bump.js` | Version bump automation |
| `avatars/` | PNG images for Pailoid, Girl avatars |
