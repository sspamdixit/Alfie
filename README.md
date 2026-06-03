# Alessa

> A waifu music bot for Discord. No AI chat, no memory, no drama — just the queue and the vibes.
> Mascot: Misa Amane.

---

## Features

- **Stream anything** — YouTube, SoundCloud, and Spotify links. Paste a URL or search by name.
- **Full queue control** — add, remove, move, shuffle, loop, and clear tracks without stopping playback.
- **Now playing** — Spotify-style embed with live progress bar and album art.
- **Vote skip** — majority vote required when 3+ listeners are in the channel.
- **Rave mode** — AI-assisted genre sessions with automatic track discovery and crossfade.
- **Saved playlists** — save and reload your queues across sessions (requires PostgreSQL).
- **Lyrics** — fetched from lrclib.net, auto-detected from the current track.
- **Text-to-speech** — `/speak` plays Brian TTS directly in the voice channel via Lavalink.
- **Autocomplete** — `/play` autocompletes as you type.

---

## Commands

### Playback

| Command | Description |
|---|---|
| `/play <query>` | Play a track or playlist by name or URL |
| `/playtop <query>` | Play a track next (inserts at position 1) |
| `/pause` | Pause the current track |
| `/resume` | Resume playback |
| `/skip` | Skip the current track (vote-skip when 3+ in channel) |
| `/stop` | Stop playback and disconnect |
| `/disconnect` | Leave the voice channel |
| `/reconnect` | Force-migrate to a fresh Lavalink node at the current timestamp |
| `/volume <0–100>` | Set playback volume |
| `/seek <time>` | Seek to a position, e.g. `1:30` or `90` |
| `/nowplaying` | Show what's currently playing |

### Queue

| Command | Description |
|---|---|
| `/queue` | Display the current queue |
| `/shuffle` | Shuffle the queue |
| `/loop` | Cycle loop mode: off → track → queue → off |
| `/remove <position>` | Remove a track from the queue |
| `/move <from> <to>` | Move a track to a new queue position |
| `/clear` | Clear the queue without stopping the current track |
| `/autoplay [on/off]` | Toggle autoplay when the queue runs out |
| `/history` | Show tracks played this session |

### Playlists

| Command | Description |
|---|---|
| `/savequeue <name>` | Save the current queue as a playlist |
| `/playlist list` | List your saved playlists |
| `/playlist load <name>` | Load a saved playlist into the queue |
| `/playlist delete <name>` | Delete a saved playlist |

### Rave

| Command | Description |
|---|---|
| `/rave <genre> [minutes]` | Start a genre session — e.g. `drum and bass`, `jazz`, `afrobeats` |
| `/ravestop` | End the rave session |

### Utility

| Command | Description |
|---|---|
| `/lyrics [song]` | Lyrics for the current track, or search by `artist - title` |
| `/speak <text>` | Speak text in the voice channel (Brian TTS) |
| `/ping` | Check if Alessa is alive |
| `/status` | Bot status and uptime |
| `/help` | List all commands |

---

## Self-hosting

### Prerequisites

- **Node.js** 20+
- **Lavalink** v4 node — see [Lavalink releases](https://github.com/lavalink-devs/Lavalink/releases)
- **PostgreSQL** — optional, required only for `/savequeue` and `/playlist`

### 1. Clone and install

```bash
git clone https://github.com/sspamdixit/Alfie.git
cd Alfie
npm install
```

### 2. Environment variables

Create a `.env` file or configure these in your host:

```env
# Required
ALESSA_TOKEN=your_discord_bot_token

# Lavalink — single node
LAVALINK_URL=your-lavalink-host:2333
LAVALINK_AUTH=your_lavalink_password
LAVALINK_SECURE=false

# Lavalink — multiple nodes (JSON array, overrides the above)
# LAVALINK_NODES=[{"name":"main","url":"host:2333","auth":"pass","secure":false}]

# Optional
DATABASE_URL=postgresql://user:pass@host:5432/alessa
GEMINI_API_KEY=your_gemini_key        # enables AI track discovery in rave mode
PROGRESS_UPDATES=on                   # set to "off" to disable live progress bar
PROGRESS_UPDATE_MS=7000               # progress bar refresh rate in ms
```

### 3. Create the Discord application

1. Go to [discord.com/developers](https://discord.com/developers/applications) → **New Application**.
2. Under **Bot**, create a bot and copy the token into `ALESSA_TOKEN`.
3. Enable **Server Members Intent** and **Message Content Intent**.
4. Under **OAuth2 → URL Generator**, select scopes `bot` + `applications.commands` and permissions:
   - `Send Messages`, `Embed Links`, `Add Reactions`
   - `Connect`, `Speak`
5. Use the generated URL to invite Alessa to your server.

### 4. Run Lavalink

Alessa uses [Lavalink](https://github.com/lavalink-devs/Lavalink) for all audio — it's a separate Java process that needs to be running before Alessa starts.

```bash
# Requires Java 17+
java -jar Lavalink.jar
```

Minimal `application.yml`:

```yaml
server:
  port: 2333
  address: 0.0.0.0

lavalink:
  server:
    password: "your_password"
    sources:
      youtube: true
      soundcloud: true
      http: true
      local: false
```

Set `LAVALINK_URL=your-server-ip:2333` and `LAVALINK_AUTH=your_password`.

### 5. Build and run

```bash
# Development
npm run dev

# Production
npm run build
node dist/index.cjs
```

Slash commands register automatically on startup. If they don't appear in Discord, kick and re-invite the bot with the `applications.commands` scope.

### 6. Database (playlists)

If `DATABASE_URL` is set, run this once to create the playlists table:

```bash
npm run db:push
```

Without a database, all music commands work normally — only `/savequeue` and `/playlist` are unavailable.

---

## Environment variable reference

| Variable | Required | Description |
|---|---|---|
| `ALESSA_TOKEN` | **Yes** | Discord bot token |
| `LAVALINK_URL` | **Yes*** | Lavalink node host:port |
| `LAVALINK_AUTH` | **Yes*** | Lavalink node password |
| `LAVALINK_SECURE` | No | `true` for WSS (default: `false`) |
| `LAVALINK_NAME` | No | Node display name |
| `LAVALINK_NODES` | No | JSON array — overrides individual vars when set |
| `DATABASE_URL` | No | PostgreSQL connection string (for playlists) |
| `GEMINI_API_KEY` | No | Gemini key for rave-mode AI track discovery |
| `PROGRESS_UPDATES` | No | `off` to disable progress bar (default: on) |
| `PROGRESS_UPDATE_MS` | No | Progress bar interval in ms (default: 7000) |

*\* or use `LAVALINK_NODES` for multi-node setups*

---

## Hosting recommendations

Alessa and Lavalink need to run as separate processes. They can share a host or be split across two.

| Platform | Notes |
|---|---|
| [Railway](https://railway.app) | Deploy from GitHub; add a Lavalink service in the same project |
| [Render](https://render.com) | Free tier works; add a PostgreSQL instance for playlists |
| VPS (any) | Run Alessa with `pm2` or `systemd`; run Lavalink in a `screen`/`tmux` or as a service |

Lavalink requires **Java 17+**. The Alessa Node.js process is lightweight and runs fine on free-tier plans.

---

## Stack

- **Discord.js** v14
- **Shoukaku** (Lavalink v4 client)
- **Drizzle ORM** + PostgreSQL
- **Express** (health check + dashboard API)
- **React** + Vite (web landing page and dashboard)
- **lrclib.net** — lyrics
- **StreamElements Brian** — TTS voice

---

*Alessa is a standalone bot. It does not depend on any other service or codebase at runtime.*
