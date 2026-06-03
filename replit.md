# Project Overview

**Alessa** is a Discord music bot with a React web dashboard. Built with Node.js, TypeScript, Discord.js v14, Lavalink/Shoukaku, Express, Socket.IO, Drizzle ORM, and PostgreSQL.

# Replit Configuration

- Runtime: Node.js 20
- Main development command: `NODE_ENV=development node_modules/.bin/tsx server/index.ts`
- Web server port: `5000`
- Production build command: `npm run build`
- Production run command: `node ./dist/index.cjs`
- Database schema sync command: `npm run db:push`

# Required Environment Variables / Secrets

- `ALESSA_TOKEN` — Discord bot token for Alessa (required for bot to come online); falls back to `ALFIE_TOKEN` for backward compatibility
- `ENABLE_ALESSA` — Set to `true` to auto-start Alessa on server boot; also accepts `ENABLE_ALFIE=true` for backward compatibility
- `DISCORD_CLIENT_ID` — Discord application client ID (for OAuth login and invite URL)
- `DISCORD_CLIENT_SECRET` — Discord application client secret (for OAuth login)
- `DASHBOARD_PASSWORD` — Password for the admin dashboard at `/admin`
- `LAVALINK_URL` — Lavalink server address, e.g. `mynode.example.com:2333`
- `LAVALINK_PASSWORD` (or `LAVALINK_AUTH`) — Lavalink server password
- `LAVALINK_SECURE` — set to `true` if the node uses WSS/HTTPS
- `LAVALINK_NODES` — optional JSON array of additional nodes (see Render notes below)

# Architecture Notes

## Core Structure
- Server code: `server/`
- Bot code: `alessa/bot.ts`
- Client code: `client/`
- Shared schema/types: `shared/`
- Static production assets: `dist/public` (after build)
- API routes mounted under `/api`, protected by dashboard auth where appropriate
- Secrets (Discord token, etc.) read from environment variables — never committed

## Bot (`alessa/bot.ts`)
- Discord.js v14 client
- Auto-starts when `ENABLE_ALESSA=true` (or legacy `ENABLE_ALFIE=true`) and `ALESSA_TOKEN` is set
- Falls back to `ALFIE_TOKEN` then `DISCORD_TOKEN` if `ALESSA_TOKEN` is not set
- Commands: `/play`, `/skip`, `/queue`, `/nowplaying`, `/pause`, `/resume`, `/volume`, `/shuffle`, `/loop`, `/seek`, `/lyrics`, `/history`, `/autoplay`, `/savequeue`, `/playlist`, `/rave`, `/ravestop`, `/speak`, `/stop`, `/disconnect`
- Vote-skip (majority required if 3+ in voice)
- Auto-disconnect when alone in VC (2-minute grace period)

## Music System (`server/music.ts`)
- Lavalink via Shoukaku
- Now-playing embeds with Spotify album art and live progress bar
- Autoplay, node-health watchdog, stuck/exception recovery
- Saved playlists per user per guild (stored in PostgreSQL)

## DJ / Rave Mode (`server/dj.ts`)
- `/rave <genre> [minutes]` — infinite auto-DJ rave session
- Phase system: warmup → peak → afterhours → cooldown
- Vibe-shift voting via Discord reactions
- Session recap posted on stop

## TTS (`server/tts.ts`)
- `/speak <text>` — StreamElements Brian voice via Lavalink

## Dashboard
- React frontend in `client/`
- Public: Landing, Servers list, Server info (commands reference)
- Admin (`/admin`): Bot status, DJ sessions, Lavalink status — password protected
- Discord OAuth for server management access

## Database Schema (`shared/schema.ts`)
- `users` — dashboard user accounts
- `bot_meta` — key-value store for bot metadata
- `saved_playlists` — user-saved music playlists (userId, guildId, name)
- `playlist_tracks` — tracks belonging to saved playlists

## API Routes
- `GET /api/oauth/discord` — Discord OAuth login redirect
- `GET /api/oauth/discord/callback` — OAuth callback
- `GET /api/oauth/me` — Current logged-in user
- `POST /api/oauth/logout` — Logout
- `GET /api/public/guilds` — Managed guilds (requires Discord OAuth)
- `GET /api/public/guilds/:guildId/info` — Guild info + Alessa presence
- `GET /api/public/invite-url` — Bot invite URL
- `POST /api/auth` — Admin dashboard login
- `GET /api/alessa/status` — Alessa bot status (admin only)
- `GET /api/dj/status` — DJ/rave sessions + Lavalink status (admin only)
- `GET /api/service/health` — Server uptime (admin only)

## Invite URL Permissions
Bot invite URL uses permission set `36826176`:
- View Channel, Send Messages, Embed Links, Attach Files, Read Message History,
  Add Reactions, Manage Messages, Connect, Speak, Use VAD

# Render Free-Tier Deployment Notes

Set these additional environment variables in Render's dashboard for best performance:

- `NODE_OPTIONS=--max-old-space-size=400` — caps Node.js heap at 400 MB, leaving ~100 MB for the OS and Shoukaku WS buffers on Render's 512 MB instance; prevents OOM kills
- `PROGRESS_UPDATES=off` — optional; disables the 7-second progress-bar edits to cut Discord API calls if you want to conserve CPU
- `RENDER_EXTERNAL_URL` — set to your Render service URL (e.g. `https://alessa.onrender.com`); required for the keep-alive self-ping to work
- `LAVALINK_NODES` — JSON array of extra Lavalink nodes for redundancy. No node credentials are hardcoded in the source; everything is configured via env vars. Format:
  ```json
  [{"name":"node-2","url":"host:port","auth":"password","secure":false}]
  ```
  Public community node lists (regularly verified): https://lavalink.darrennathanael.com · https://nodes.lavalink.rf.gd

## What was optimised for Render

| Area | Change | Why |
|---|---|---|
| Discord.js cache | `makeCache` limits — messages/presences/emojis/reactions/threads set to 0 | Tiny heap → fast GC → Discord heartbeats always fire → no shard drops → no music stops |
| Discord.js cache | `GuildMemberManager: 200` | Enough for active music sessions; voice-channel member checks still work |
| Discord REST | `timeout: 10 000 ms, retries: 1` | Prevents slow Discord edge nodes from blocking the event loop for 60 s |
| Keep-alive | 10 min → 5 min ping interval | 3× safety margin inside Render's 15-min spin-down window |

# User Preferences
