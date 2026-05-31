# Project Overview

**Alfie** is a Discord music bot with a React web dashboard. Built with Node.js, TypeScript, Discord.js v14, Lavalink/Shoukaku, Express, Socket.IO, Drizzle ORM, and PostgreSQL.

# Replit Configuration

- Runtime: Node.js 20
- Main development command: `NODE_ENV=development node_modules/.bin/tsx server/index.ts`
- Web server port: `5000`
- Production build command: `npm run build`
- Production run command: `node ./dist/index.cjs`
- Database schema sync command: `npm run db:push`

# Required Environment Variables / Secrets

- `ALFIE_TOKEN` — Discord bot token for Alfie (required for bot to come online)
- `ENABLE_ALFIE` — Set to `true` to auto-start Alfie on server boot (already set)
- `DISCORD_CLIENT_ID` — Discord application client ID (for OAuth login and invite URL)
- `DISCORD_CLIENT_SECRET` — Discord application client secret (for OAuth login)
- `DASHBOARD_PASSWORD` — Password for the admin dashboard at `/admin`
- `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD` — Lavalink audio server (for music playback)

# Architecture Notes

## Core Structure
- Server code: `server/`
- Bot code: `alfie/bot.ts`
- Client code: `client/`
- Shared schema/types: `shared/`
- Static production assets: `dist/public` (after build)
- API routes mounted under `/api`, protected by dashboard auth where appropriate
- Secrets (Discord token, etc.) read from environment variables — never committed

## Bot (`alfie/bot.ts`)
- Discord.js v14 client
- Auto-starts when `ENABLE_ALFIE=true` and `ALFIE_TOKEN` is set
- Falls back to `DISCORD_TOKEN` if `ALFIE_TOKEN` is not set
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
- `GET /api/public/guilds/:guildId/info` — Guild info + Alfie presence
- `GET /api/public/invite-url` — Bot invite URL
- `POST /api/auth` — Admin dashboard login
- `GET /api/alfie/status` — Alfie bot status (admin only)
- `GET /api/dj/status` — DJ/rave sessions + Lavalink status (admin only)
- `GET /api/service/health` — Server uptime (admin only)

## Invite URL Permissions
Bot invite URL uses permission set `36826176`:
- View Channel, Send Messages, Embed Links, Attach Files, Read Message History,
  Add Reactions, Manage Messages, Connect, Speak, Use VAD

# User Preferences
