# focus

A floating, frosted-glass AI focus monitor that periodically screenshots your screen and checks whether you're actually working on what you said you'd work on. If you're not, it roasts you.

## What it does

- Sits in the top-right corner as a minimal always-on-top widget
- Takes a screenshot every N seconds and sends it to Gemini to verify you're on task
- Notifies you (and verbally roasts you via ElevenLabs TTS) when you're off task
- Tracks streaks, history, task queue, and session stats
- Lets you correct false positives so the AI learns what's acceptable for your task

## Setup

```bash
npm install
npm start
```

Then click the gear icon to add your API keys.

## Requirements

- **Gemini API key** — used for screenshot analysis ([get one here](https://aistudio.google.com/app/apikey))
- **ElevenLabs API key** (optional) — for voice roasts instead of macOS `say` ([get one here](https://elevenlabs.io))
- macOS (screenshot capture uses `screencapture`, TTS playback uses `afplay`)

## How it works

1. Set your current task by clicking the task name
2. The app checks your screen every 30s (configurable) using Gemini 2.0 Flash
3. If you're off task twice in a row, it fires a notification + audio roast
4. Click **"actually this is fine"** on a false positive to whitelist that activity for the current task
5. Hit ✓ when done — it'll pull the next task from your queue

## Settings

| Setting | Description |
|---|---|
| Gemini API key | Required for screenshot analysis |
| ElevenLabs API key | Optional, enables voice roasts |
| Check interval | How often to check (seconds) |
| Strict mode | All screens must be on task (vs. at least one) |
| Auto-delete screenshots | Delete screenshots immediately after analysis |
