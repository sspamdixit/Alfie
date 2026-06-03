---
name: Render free-tier optimisations
description: What was tuned in alfie/bot.ts and server/index.ts to run well on Render's 512 MB / 0.1 CPU free tier.
---

## Rules applied

### makeCache (Discord.js)
`Options.cacheWithLimits({...})` added to every `new Client({...})` call.

Zero-out everything the bot never receives (no MessageContent intent):
- `MessageManager: 0`
- `UserManager: 0`
- `GuildEmojiManager: 0`, `GuildStickerManager: 0`, `GuildBanManager: 0`
- `GuildScheduledEventManager: 0`, `PresenceManager: 0`
- `ReactionManager: 0`, `StageInstanceManager: 0`
- `ThreadManager: 0`, `ThreadMemberManager: 0`
- Keep `GuildMemberManager: 200` — voice-channel member checks still need it.

**Why:** Smaller heap → faster GC → Discord heartbeats fire on time → no shard disconnects → no music drops.

### REST timeout
`rest: { timeout: 10_000, retries: 1 }` on the Client.

**Why:** Default is 15 s × 3 retries = 60 s max stall. On Render's throttled CPU a 60 s stall in the event loop will miss multiple heartbeats and kill the shard.

### Keep-alive interval
`server/index.ts` changed from 10 min → 5 min.

**Why:** 3× safety margin against Render's 15-min spin-down window.

## Recommended Render env vars (not in code)
- `NODE_OPTIONS=--max-old-space-size=400` — caps heap at 400 MB, prevents OOM on 512 MB instance.
- `RENDER_EXTERNAL_URL` — required for keep-alive self-ping.
- `PROGRESS_UPDATES=off` — optional; disables 7 s Discord message edits to save CPU.
