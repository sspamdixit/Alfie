---
name: Alfie cleanup
description: Fred→Alfie migration decisions — what was removed, what was kept, and how the bot wires together.
---

## What was removed (all Fred-specific)
All Fred AI/personality files deleted: bot.ts, ai-settings.ts, gemini.ts, groq-sdk.d.ts, guild-memory.ts, semantic-memory.ts, episodic-memory.ts, fred-state.ts, mood-engine.ts, emotional-state.ts, radio.ts, radio-producer.ts, qotd.ts, search.ts, guild-settings.ts, radio_assets/, render.yaml.

## What was kept (Alfie music bot)
- `alfie/bot.ts` — main bot (Discord.js v14, Shoukaku/Lavalink)
- `server/music.ts`, `server/dj.ts`, `server/tts.ts` — music pipeline
- `server/storage.ts` — IStorage: users, botMeta, saved playlists/tracks only (userMemory removed)
- `shared/schema.ts` — tables: users, botMeta, savedPlaylists, playlistTracks (qotdLog, userMemory, guildMemory, guildSettings removed)

## Key wiring decisions
- `alfie/bot.ts` exports `getAlfieGuilds()` (added) — used by routes.ts `/api/public/guilds` to check hasAlfie.
- Invite URL permissions changed from Fred's `277025770560` to Alfie music bot `36826176` (View, Send, Embed, Attach, ReadHistory, Reactions, ManageMsg, Connect, Speak, VAD).
- Bot auto-starts when `ENABLE_ALFIE=true` AND `ALFIE_TOKEN` (or `DISCORD_TOKEN`) is set.
- Cookie renamed `fred.sid` → `alfie.sid`; sessionStorage keys renamed `fred-*` → `alfie-*`.
- Dashboard admin routes all require `DASHBOARD_AUTH_HEADER` token (post `/api/auth` to get it).
- `/api/public/guilds` and `/api/public/guilds/:guildId/info` require Discord OAuth session.
- `/servers/:guildId` page simplified — no AI settings (music bot has none); shows command list only.

## Why
Fred was a full AI chatbot. Alfie is a music-only bot. All AI personality/memory/radio features removed to match Alfie's scope.
