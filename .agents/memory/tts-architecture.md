---
name: TTS architecture
description: How TTS works — Lavalink-free, @discordjs/voice + 3 HTTP providers, per-guild queue.
---

## Design

TTS is completely independent of Lavalink/Shoukaku. It uses `@discordjs/voice` directly to join a voice channel and stream audio fetched from HTTP TTS providers.

**Why:** Lavalink nodes are unreliable/optional; TTS must work even with no music nodes configured.

**How to apply:** `server/tts.ts` owns all TTS logic. `setTTSClient(client)` must be called in the bot's `ready` handler before TTS will work.

## Three TTS providers (tried in parallel, first success wins)

1. **StreamElements** — `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=...` (up to 450 chars)
2. **Google Translate TTS** — `https://translate.google.com/translate_tts?...` (capped at 190 chars)
3. **ResponsiveVoice** — `https://texttospeech.responsivevoice.org/v1/text:synthesize?...&key=kvfbSITh` (public demo key)

All three are tried concurrently via `Promise.allSettled`; first fulfilled result is used.

## Per-guild queue

Each guild has a `GuildTTSState` with a `VoiceConnection`, `AudioPlayer`, and a `Buffer[]` queue. Messages are appended to the queue and drained serially (each plays after the previous finishes).

## Lifecycle

- `speakInVoice(guildId, text, voiceChannelId, ...)` — main entry point; fetches audio + queues it.
- `disconnectTTS(guildId)` — destroys the voice connection and clears state. Must be called when:
  - User runs `/speak` again (toggle off)
  - User leaves the voice channel (voiceStateUpdate)
  - `/stop` or `/disconnect` is called

## Conflict with Shoukaku/music

TTS and music are mutually exclusive at the application level — `/speak` starts a TTS session, and music should not be playing simultaneously. If music IS playing, the `@discordjs/voice` connection for TTS will fight with Shoukaku over the Discord gateway voice events.

## Discord intent requirement

`GuildMessages` + `MessageContent` intents are required for the ambient `/speak` feature (messageCreate listener). **Must be enabled in Discord Developer Portal → Bot → Privileged Gateway Intents.**
