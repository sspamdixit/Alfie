import {
  Client,
  GatewayIntentBits,
  ActivityType,
  ChannelType,
  TextChannel,
  Message,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Options,
  type VoiceBasedChannel,
} from "discord.js";
import { log } from "../server/index";
import {
  initMusic,
  setNowPlayingCallback,
  setTextNotifyCallback,
  resolveTrack,
  resolvePlaylist,
  searchTracks,
  acCacheStore,
  acCacheLookup,
  joinAndPlay,
  joinAndPlayMultiple,
  addToFront,
  skipTrack,
  stopMusic,
  disconnectMusic,
  reconnectMusic,
  pauseMusic,
  resumeMusic,
  setMusicVolume,
  shuffleQueue,
  cycleLoop,
  setLoop,
  removeTrack,
  moveTrack,
  clearQueue,
  seekTrack,
  parseSeekTime,
  getQueue,
  formatDuration,
  setAutoplay,
  isAutoplayEnabled,
  setGuildFilter,
  getGuildFilter,
  skipToPosition,
  removeDuplicates,
  replayTrack,
  setQueueStopCallback,
  setCrossfadeSeconds,
  getCrossfadeSeconds,
  setCustomEqBand,
  fetchSpotifyPlaylistTracks,
  debugReset,
  searchAsQueueTracks,
  type QueueTrack,
  type GuildQueue,
  type FilterPreset,
  type SearchResult,
} from "../server/music";
import {
  djSessions,
  getDjStatus,
  onDjTrackStart,
  onDjStop,
  refillDjQueue,
  cancelDjFades,
  setRaveClient,
} from "../server/dj";
import { speakInVoice, setTTSClient, disconnectTTS } from "../server/tts";
import { storage } from "../server/storage";

export interface AlessaBotStatus {
  online: boolean;
  tag: string | null;
  avatarUrl: string | null;
  guildCount: number;
  uptimeStart: number | null;
  status: string;
  lastError: string | null;
}

let botState: AlessaBotStatus = {
  online: false,
  tag: null,
  avatarUrl: null,
  guildCount: 0,
  uptimeStart: null,
  status: "offline",
  lastError: null,
};

export function getAlessaBotStatus(): AlessaBotStatus {
  return { ...botState };
}

let client: Client | null = null;
let loginRetryTimer: NodeJS.Timeout | null = null;
const backgroundTimers = new Set<NodeJS.Timeout>();

// ── Ambient TTS sessions ───────────────────────────────────────────────────────
// Key: guildId — value: the user + channel pair currently being listened to.
// When active, every message the user sends in textChannelId is spoken via TTS.
interface TTSSession { userId: string; voiceChannelId: string; textChannelId: string; }
const activeTTSSessions = new Map<string, TTSSession>();

// ── Track history ─────────────────────────────────────────────────────────────
const HISTORY_LIMIT = 20;
const trackHistory = new Map<string, Array<{
  title: string;
  author: string;
  duration: number;
  uri: string;
  requestedBy: string;
  playedAt: number;
}>>();

// ── Presence management ───────────────────────────────────────────────────────
const activeNowPlaying = new Map<string, { track: QueueTrack; paused: boolean }>();
let presenceClient: Client | null = null;
let idlePresenceIdx = 0;
let idlePresenceTimer: NodeJS.Timeout | null = null;
const IDLE_PRESENCE = [
  "/play a song~ ♡",
  "type /help for commands~ ♡",
  "waiting to vibe~ ehehe ♡",
  "music on demand~ /play ♡",
  "always here for u~ ♡",
];

function presenceTrunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function updateBotPresence(): void {
  const c = presenceClient;
  if (!c?.user) return;
  const total = activeNowPlaying.size;
  if (total === 0) {
    const msg = IDLE_PRESENCE[idlePresenceIdx % IDLE_PRESENCE.length];
    c.user.setPresence({ activities: [{ name: msg, type: ActivityType.Listening }], status: "online" });
    return;
  }
  if (total === 1) {
    const [guildId, state] = [...activeNowPlaying.entries()][0];
    const djSession = djSessions.get(guildId);
    let name: string;
    if (djSession) {
      name = `🎉 ${presenceTrunc(djSession.genre, 60)} rave`;
    } else if (state.paused) {
      name = `⏸ ${presenceTrunc(state.track.title, 100)}`;
    } else {
      name = presenceTrunc(`${state.track.title} — ${state.track.author}`, 120);
    }
    c.user.setPresence({ activities: [{ name, type: ActivityType.Listening }], status: "online" });
    return;
  }
  c.user.setPresence({ activities: [{ name: `music in ${total} servers~ ♡`, type: ActivityType.Listening }], status: "online" });
}

function markGuildPaused(guildId: string): void {
  const state = activeNowPlaying.get(guildId);
  if (state) { activeNowPlaying.set(guildId, { ...state, paused: true }); updateBotPresence(); }
}

function markGuildResumed(guildId: string): void {
  const state = activeNowPlaying.get(guildId);
  if (state) {
    activeNowPlaying.set(guildId, { ...state, paused: false });
    updateBotPresence();
  } else {
    const q = getQueue(guildId);
    if (q?.current) { activeNowPlaying.set(guildId, { track: q.current, paused: false }); updateBotPresence(); }
  }
}

function markGuildStopped(guildId: string): void {
  if (activeNowPlaying.delete(guildId)) updateBotPresence();
}

// ── DJ role & 24/7 mode ───────────────────────────────────────────────────────
const djRoles = new Map<string, string>();   // guildId → roleId
const guilds247 = new Set<string>();         // guildIds with 24/7 mode enabled

// ── Sleep timers ──────────────────────────────────────────────────────────────
interface SleepTimer { timer: ReturnType<typeof setTimeout>; endsAt: number }
const sleepTimers = new Map<string, SleepTimer>();

// ── Request channels (song request via plain message) ─────────────────────────
const requestChannels = new Map<string, string>(); // guildId → channelId

// ── Jukebox sessions ──────────────────────────────────────────────────────────
interface JukeboxSession {
  options: SearchResult[];
  votes: Map<string, number>;     // userId → option index
  voteCounts: number[];
  messageId: string;
  channelId: string;
  guildId: string;
  voiceChannelId: string;
  timer: ReturnType<typeof setTimeout>;
}
const jukeboxSessions = new Map<string, JukeboxSession>();

function checkDjPermission(interaction: any, guildId: string): boolean {
  const roleId = djRoles.get(guildId);
  if (!roleId) return true;
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  if (!member) return false;
  if (member.permissions?.has("Administrator")) return true;
  return member.roles.cache.has(roleId);
}

function djRoleName(guildId: string, guild: any): string {
  const roleId = djRoles.get(guildId);
  if (!roleId) return "DJ";
  return guild?.roles?.cache?.get(roleId)?.name ?? "DJ";
}

// ── Lyrics fetcher ────────────────────────────────────────────────────────────
async function fetchLyrics(artist: string, title: string): Promise<string | null> {
  const cleanArtist = artist.replace(/\s*[\(\[]feat\..*?[\)\]]/gi, "").replace(/\s*ft\..*$/i, "").trim();
  const cleanTitle  = title.replace(/\s*\(.*?\)/g, "").replace(/\s*\[.*?\]/g, "").trim();
  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (res.ok) {
      const data = await res.json() as { plainLyrics?: string; syncedLyrics?: string; statusCode?: number };
      if (data.statusCode !== 404) {
        const text = data.plainLyrics?.trim() ?? data.syncedLyrics?.trim();
        if (text) return text;
      }
    }
  } catch { /* fall through */ }
  return null;
}

// ── Album art ─────────────────────────────────────────────────────────────────
interface AlbumArtResult { imageUrl: string }

const ALBUM_ART_CACHE_LIMIT = 200;
const albumArtCache = new Map<string, Promise<AlbumArtResult | null>>();
const nowPlayingUpdateTimers = new Map<string, NodeJS.Timeout>();

const EMBED_COLOR = 0x5865F2;
const SPOTIFY_PROGRESS_SEGMENTS = 12;

const PROGRESS_UPDATES_DISABLED = /^(off|false|0|no)$/i.test(process.env.PROGRESS_UPDATES ?? "");
const SPOTIFY_PROGRESS_UPDATE_MS = (() => {
  const raw = parseInt(process.env.PROGRESS_UPDATE_MS ?? "", 10);
  return Number.isFinite(raw) && raw >= 1000 ? raw : 7_000;
})();

function truncateDiscordText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function cleanSearchText(value: string): string {
  return value
    .replace(/\([^)]*(official|video|audio|lyrics?|visualizer|remaster|remastered|live)[^)]*\)/gi, " ")
    .replace(/\[[^\]]*(official|video|audio|lyrics?|visualizer|remaster|remastered|live)[^\]]*\]/gi, " ")
    .replace(/\s+(official\s+)?(music\s+)?video$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ARTIST_NOISE_RE = /\s*[-–—]?\s*(topic|vevo|official|records|music|channel)\s*$/i;

function normalizeForMatch(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/\b(feat|ft|with|prod(?:\.|uced)? by)\.?\s+[^,&-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let hits = 0;
  for (const t of a) if (setB.has(t)) hits += 1;
  return hits / a.length;
}

async function fetchItunesAlbumArt(track: QueueTrack): Promise<AlbumArtResult | null> {
  const title = cleanSearchText(track.title);
  const rawArtist = cleanSearchText(track.author).replace(ARTIST_NOISE_RE, "").trim();
  const term = rawArtist ? `${rawArtist} ${title}` : title;

  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "10");
  url.searchParams.set("term", term);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) return null;

    const data = await response.json() as {
      results?: Array<{ artworkUrl100?: string; trackName?: string; artistName?: string }>;
    };

    const candidates = (data.results ?? []).filter((r) => r.artworkUrl100);
    if (!candidates.length) return null;

    const wantTitle = normalizeForMatch(title);
    const wantArtist = normalizeForMatch(rawArtist);

    let best: { score: number; artworkUrl100: string } | null = null;
    for (const r of candidates) {
      const gotTitle  = normalizeForMatch(r.trackName ?? "");
      const gotArtist = normalizeForMatch(r.artistName ?? "");
      const score = tokenOverlap(wantTitle, gotTitle) * 0.6 + (wantArtist.length === 0 ? 0.5 : tokenOverlap(wantArtist, gotArtist)) * 0.4;
      if (!best || score > best.score) best = { score, artworkUrl100: r.artworkUrl100! };
    }

    if (!best || best.score < 0.5) return null;
    return { imageUrl: best.artworkUrl100.replace("100x100bb", "600x600bb") };
  } catch {
    return null;
  }
}

function getAlbumArt(track: QueueTrack): Promise<AlbumArtResult | null> {
  const key = `${track.title.toLowerCase()}::${track.author.toLowerCase()}`;
  const cached = albumArtCache.get(key);
  if (cached) {
    albumArtCache.delete(key);
    albumArtCache.set(key, cached);
    return cached;
  }
  const pending = fetchItunesAlbumArt(track);
  albumArtCache.set(key, pending);
  if (albumArtCache.size > ALBUM_ART_CACHE_LIMIT) {
    const oldest = albumArtCache.keys().next().value;
    if (oldest !== undefined) albumArtCache.delete(oldest);
  }
  return pending;
}

function toSquareImageUrl(url: string): string {
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=300&h=300&fit=cover&a=center`;
}

function formatSpotifyProgressBar(track: QueueTrack, queue: GuildQueue): string {
  if (track.isStream || track.duration <= 0) return "[ LIVE ] ━━━━━🔘────── [ LIVE ]";
  const rawPosition = Number(queue.player.position);
  const position = Number.isFinite(rawPosition) ? Math.max(0, Math.min(Math.floor(rawPosition), track.duration)) : 0;
  const markerIndex = Math.max(0, Math.min(SPOTIFY_PROGRESS_SEGMENTS - 1, Math.round((position / track.duration) * (SPOTIFY_PROGRESS_SEGMENTS - 1))));
  const filled = "━".repeat(markerIndex);
  const remaining = "─".repeat(SPOTIFY_PROGRESS_SEGMENTS - markerIndex - 1);
  const posLabel = position === 0 ? "0:00" : formatDuration(position);
  return `[ ${posLabel} ] ${filled}🔘${remaining} [ ${formatDuration(track.duration)} ]`;
}

function buildEmbedWithImageUrl(track: QueueTrack, queue: GuildQueue, imageUrl: string | null): EmbedBuilder {
  const paused = queue.player.paused;
  const dur = track.isStream ? "🔴 LIVE" : formatDuration(track.duration);
  const queueLen = queue.tracks.length;
  const loop: string = (queue.loop as string) ?? "none";
  const loopLabel = loop === "track" ? "🔂 track" : loop === "queue" ? "🔁 queue" : "off";
  const footerParts: string[] = [
    `🔊 ${queue.volume ?? 100}%`,
    `📋 ${queueLen} in queue`,
    `loop: ${loopLabel}`,
  ];
  if (queue.autoplay) footerParts.push("✨ autoplay");

  const embed = new EmbedBuilder()
    .setColor(paused ? 0x4f545c : EMBED_COLOR)
    .setAuthor({ name: paused ? "⏸  Paused" : "💿  Now Playing", ...(imageUrl ? { iconURL: imageUrl } : {}) })
    .setTitle(truncateDiscordText(track.title, 256))
    .setURL(track.uri)
    .setDescription(formatSpotifyProgressBar(track, queue))
    .addFields(
      { name: "Artist", value: truncateDiscordText(track.author || "Unknown artist", 256), inline: true },
      { name: "Duration", value: dur, inline: true },
    )
    .setFooter({ text: footerParts.join("  •  ") });

  if (imageUrl) embed.setThumbnail(imageUrl);
  return embed;
}

export async function buildNowPlayingEmbed(track: QueueTrack, queue: GuildQueue): Promise<EmbedBuilder> {
  const art = await getAlbumArt(track);
  const raw = art?.imageUrl ?? track.artworkUrl ?? null;
  const imageUrl = raw ? toSquareImageUrl(raw) : null;
  return buildEmbedWithImageUrl(track, queue, imageUrl);
}

function buildNowPlayingEmbedFast(track: QueueTrack, queue: GuildQueue): EmbedBuilder {
  const imageUrl = track.artworkUrl ? toSquareImageUrl(track.artworkUrl) : null;
  return buildEmbedWithImageUrl(track, queue, imageUrl);
}

function scheduleNowPlayingProgressUpdates(message: Message, guildId: string, track: QueueTrack): void {
  const existing = nowPlayingUpdateTimers.get(message.id);
  if (existing) clearTimeout(existing);
  if (PROGRESS_UPDATES_DISABLED || track.isStream) return;
  if (track.duration > 0 && track.duration < SPOTIFY_PROGRESS_UPDATE_MS * 2) return;

  const scheduleNext = () => {
    const t = setTimeout(async () => {
      const queue = getQueue(guildId);
      if (!queue?.current || queue.current.encoded !== track.encoded) {
        nowPlayingUpdateTimers.delete(message.id);
        return;
      }
      const remainingMs = queue.current.duration - Number(queue.player.position || 0);
      if (Number.isFinite(remainingMs) && queue.current.duration > 0 && remainingMs < SPOTIFY_PROGRESS_UPDATE_MS) {
        nowPlayingUpdateTimers.delete(message.id);
        return;
      }
      try {
        await message.edit({
          embeds: [buildNowPlayingEmbedFast(queue.current!, queue)],
          components: buildMusicButtons(queue.player.paused, queue),
          allowedMentions: { parse: [] },
        });
      } catch {
        nowPlayingUpdateTimers.delete(message.id);
        return;
      }
      scheduleNext();
    }, SPOTIFY_PROGRESS_UPDATE_MS);
    t.unref?.();
    nowPlayingUpdateTimers.set(message.id, t);
  };
  scheduleNext();
}

export function buildMusicButtons(paused: boolean, queue?: GuildQueue): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("music_back").setEmoji("⏮").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_pause")
      .setEmoji(paused ? "▶️" : "⏸")
      .setLabel(paused ? "Resume" : "Pause")
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("music_skip").setEmoji("⏭").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_stop").setEmoji("⏹").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("music_like").setEmoji("❤️").setStyle(ButtonStyle.Secondary),
  );

  const loop: string = (queue?.loop as string) ?? "none";
  const autoplay = queue?.autoplay ?? false;

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("music_shuffle").setEmoji("🔀").setLabel("Shuffle").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_loop")
      .setEmoji(loop === "track" ? "🔂" : "🔁")
      .setLabel(loop === "none" ? "Loop" : loop === "track" ? "Loop: Track" : "Loop: Queue")
      .setStyle(loop !== "none" ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_autoplay")
      .setEmoji("✨")
      .setLabel(autoplay ? "Autoplay: On" : "Autoplay")
      .setStyle(autoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_queue").setEmoji("📋").setLabel("Queue").setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}

// ── Vote-skip ─────────────────────────────────────────────────────────────────
const skipVotes = new Map<string, Set<string>>();

function clearSkipVotes(guildId: string): void {
  skipVotes.delete(guildId);
}

type SkipResultKind = "skipped" | "voted" | "already-voted" | "not-in-channel" | "nothing-playing";
interface SkipResult {
  kind: SkipResultKind;
  skippedTitle?: string;
  votes?: number;
  needed?: number;
  listeners?: number;
}

async function requestSkip(c: Client, guildId: string, userId: string): Promise<SkipResult> {
  const q = getQueue(guildId);
  if (!q?.current) return { kind: "nothing-playing" };

  const guild = c.guilds.cache.get(guildId);
  const voiceChannel = guild?.channels.cache.get(q.voiceChannelId);

  if (!voiceChannel || !("members" in voiceChannel)) {
    const skipped = await skipTrack(guildId);
    clearSkipVotes(guildId);
    return { kind: "skipped", skippedTitle: skipped?.title };
  }

  const vcMembers = (voiceChannel as VoiceBasedChannel).members;
  const member = guild!.members.cache.get(userId) ?? null;

  if (!member?.voice?.channelId || member.voice.channelId !== q.voiceChannelId) {
    return { kind: "not-in-channel" };
  }

  const listeners = vcMembers.filter((m) => !m.user.bot).size;
  if (listeners <= 2) {
    const skipped = await skipTrack(guildId);
    clearSkipVotes(guildId);
    return { kind: "skipped", skippedTitle: skipped?.title, listeners };
  }

  const needed = Math.ceil(listeners / 2);
  let votes = skipVotes.get(guildId);
  if (!votes) { votes = new Set<string>(); skipVotes.set(guildId, votes); }

  if (votes.has(userId)) return { kind: "already-voted", votes: votes.size, needed, listeners };
  votes.add(userId);

  if (votes.size >= needed) {
    const skipped = await skipTrack(guildId);
    clearSkipVotes(guildId);
    return { kind: "skipped", skippedTitle: skipped?.title, votes: votes.size, needed, listeners };
  }
  return { kind: "voted", votes: votes.size, needed, listeners };
}

function formatSkipReply(r: SkipResult): string {
  switch (r.kind) {
    case "nothing-playing":   return "nothing's playing right now~ hehe";
    case "not-in-channel":    return "you have to join the voice channel to vote~ ehehe";
    case "already-voted":     return `you already voted to skip~ **${r.votes}/${r.needed}** votes so far ♡`;
    case "voted":             return `🗳 vote counted~! **${r.votes}/${r.needed}** votes to skip ♡`;
    case "skipped":
      return r.votes != null && r.needed != null && (r.listeners ?? 0) > 2
        ? `⏭ skipped **${r.skippedTitle ?? "track"}** (${r.votes}/${r.needed} votes)~!`
        : `⏭ skipped **${r.skippedTitle ?? "track"}**~!`;
  }
}

// ── Slash commands ─────────────────────────────────────────────────────────────
const SLASH_COMMANDS = [
  new SlashCommandBuilder().setName("ping").setDescription("check if alessa is alive"),
  new SlashCommandBuilder().setName("help").setDescription("list all music commands"),
  new SlashCommandBuilder().setName("status").setDescription("show bot status"),
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("play a song or playlist in your current voice channel")
    .addStringOption((o) => o.setName("query").setDescription("search by song name or paste a url").setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder()
    .setName("playtop")
    .setDescription("add a song to the front of the queue (plays next)")
    .addStringOption((o) => o.setName("query").setDescription("search by song name or paste a url").setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName("skip").setDescription("skip the current track"),
  new SlashCommandBuilder().setName("stop").setDescription("stop music and disconnect"),
  new SlashCommandBuilder().setName("reconnect").setDescription("force a switch to a fresh lavalink node"),
  new SlashCommandBuilder().setName("debug").setDescription("diagnose and fix any connection or playback issues"),
  new SlashCommandBuilder().setName("disconnect").setDescription("disconnect from the voice channel"),
  new SlashCommandBuilder().setName("pause").setDescription("pause the current track"),
  new SlashCommandBuilder().setName("resume").setDescription("resume the paused track"),
  new SlashCommandBuilder().setName("queue").setDescription("show the current music queue"),
  new SlashCommandBuilder().setName("nowplaying").setDescription("show what's currently playing"),
  new SlashCommandBuilder()
    .setName("volume")
    .setDescription("set the playback volume (0–100)")
    .addIntegerOption((o) => o.setName("level").setDescription("volume level 0–100").setRequired(true).setMinValue(0).setMaxValue(100)),
  new SlashCommandBuilder().setName("shuffle").setDescription("shuffle the queue"),
  new SlashCommandBuilder().setName("loop").setDescription("cycle loop mode: off → track → queue → off"),
  new SlashCommandBuilder()
    .setName("seek")
    .setDescription("seek to a position in the current track")
    .addStringOption((o) => o.setName("time").setDescription("time to seek to, e.g. 1:30 or 90").setRequired(true)),
  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("remove a track from the queue by position")
    .addIntegerOption((o) => o.setName("position").setDescription("queue position (from /queue)").setRequired(true).setMinValue(1)),
  new SlashCommandBuilder()
    .setName("move")
    .setDescription("move a track to a different position in the queue")
    .addIntegerOption((o) => o.setName("from").setDescription("current position").setRequired(true).setMinValue(1))
    .addIntegerOption((o) => o.setName("to").setDescription("new position").setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName("clear").setDescription("clear the queue without stopping the current track"),
  new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("toggle autoplay — keep queueing similar tracks when the queue ends")
    .addBooleanOption((o) => o.setName("enabled").setDescription("turn autoplay on or off").setRequired(false)),
  new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("fetch lyrics for the current song or search for a song")
    .addStringOption((o) => o.setName("song").setDescription("artist - title (leave blank for current track)").setRequired(false)),
  new SlashCommandBuilder().setName("history").setDescription("show recently played tracks this session"),
  new SlashCommandBuilder()
    .setName("savequeue")
    .setDescription("save the current queue as a named playlist")
    .addStringOption((o) => o.setName("name").setDescription("playlist name").setRequired(true).setMaxLength(50)),
  new SlashCommandBuilder()
    .setName("playlist")
    .setDescription("manage saved playlists")
    .addSubcommand((s) => s.setName("list").setDescription("show your saved playlists"))
    .addSubcommand((s) => s.setName("load").setDescription("load a saved playlist").addStringOption((o) => o.setName("name").setDescription("playlist name").setRequired(true)))
    .addSubcommand((s) => s.setName("delete").setDescription("delete a saved playlist").addStringOption((o) => o.setName("name").setDescription("playlist name").setRequired(true))),
  new SlashCommandBuilder()
    .setName("rave")
    .setDescription("start an infinite genre-based rave session with DJ commentary")
    .addStringOption((o) => o.setName("genre").setDescription("genre to play (e.g. afrobeats, jazz, drum and bass)").setRequired(true))
    .addIntegerOption((o) => o.setName("minutes").setDescription("how long to rave (default: infinite)").setRequired(false).setMinValue(1).setMaxValue(480)),
  new SlashCommandBuilder().setName("ravestop").setDescription("stop the current rave session"),
  new SlashCommandBuilder()
    .setName("speak")
    .setDescription("speak text aloud in your voice channel, or start/stop an ambient TTS session")
    .addStringOption((o) =>
      o.setName("text").setDescription("text to speak immediately (omit to toggle ambient session)").setRequired(false),
    ),
  // ── Audio effects ────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("bassboost")
    .setDescription("toggle bass boost (mmmm bassy~ ♡)")
    .addStringOption((o) =>
      o.setName("level").setDescription("boost level (default: medium)").setRequired(false)
        .addChoices(
          { name: "off", value: "off" },
          { name: "low", value: "low" },
          { name: "medium", value: "medium" },
          { name: "high", value: "high" },
        ),
    ),
  new SlashCommandBuilder().setName("nightcore").setDescription("toggle nightcore mode (fast + high pitch~ ♡)"),
  new SlashCommandBuilder().setName("vaporwave").setDescription("toggle vaporwave mode (slow + dreamy~ ♡)"),
  new SlashCommandBuilder().setName("8d").setDescription("toggle 8D audio (spins around your head~ ♡)"),
  new SlashCommandBuilder().setName("karaoke").setDescription("toggle karaoke mode (vocals reduced~ ♡)"),
  new SlashCommandBuilder()
    .setName("filter")
    .setDescription("show or set an audio filter preset")
    .addStringOption((o) =>
      o.setName("preset").setDescription("filter preset to apply (leave blank to see current)").setRequired(false)
        .addChoices(
          { name: "off — clear all filters", value: "off" },
          { name: "bassboost — heavy bass", value: "bassboost" },
          { name: "nightcore — fast + pitched up", value: "nightcore" },
          { name: "vaporwave — slow + dreamy", value: "vaporwave" },
          { name: "8d — audio rotates around your head", value: "8d" },
          { name: "karaoke — reduce vocals", value: "karaoke" },
        ),
    ),
  // ── Queue extras ─────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("skipto")
    .setDescription("skip ahead to a specific track in the queue")
    .addIntegerOption((o) => o.setName("position").setDescription("queue position to jump to").setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName("removedupes").setDescription("remove duplicate tracks from the queue"),
  new SlashCommandBuilder().setName("replay").setDescription("restart the current track from the beginning"),
  new SlashCommandBuilder().setName("grab").setDescription("save the current song to your DMs ♡"),
  // ── Server settings ──────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("247").setDescription("toggle 24/7 mode — stay in VC even when everyone leaves"),
  new SlashCommandBuilder()
    .setName("djrole")
    .setDescription("manage the DJ role for this server")
    .addSubcommand((s) => s.setName("set").setDescription("set the DJ role — only holders can control music")
      .addRoleOption((o) => o.setName("role").setDescription("the role to use as the DJ role").setRequired(true)))
    .addSubcommand((s) => s.setName("clear").setDescription("remove the DJ role restriction — anyone can control music"))
    .addSubcommand((s) => s.setName("show").setDescription("show the current DJ role")),
  // ── Premium features (free) ───────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("sleep")
    .setDescription("set a sleep timer — Alessa stops playing after N minutes (0 to cancel)")
    .addIntegerOption((o) => o.setName("minutes").setDescription("minutes until stop (0 = cancel)").setRequired(true).setMinValue(0).setMaxValue(480)),
  new SlashCommandBuilder()
    .setName("requestchannel")
    .setDescription("set or clear the song-request channel")
    .addSubcommand((s) =>
      s.setName("set").setDescription("set a channel where users can type track names/URLs to queue them")
        .addChannelOption((o) => o.setName("channel").setDescription("the text channel to use").setRequired(true)))
    .addSubcommand((s) => s.setName("off").setDescription("disable the song-request channel")),
  new SlashCommandBuilder()
    .setName("eq")
    .setDescription("adjust a single equalizer band (15 bands, 0–14)")
    .addIntegerOption((o) => o.setName("band").setDescription("EQ band 0–14 (0=63Hz … 14=16kHz)").setRequired(true).setMinValue(0).setMaxValue(14))
    .addNumberOption((o) => o.setName("gain").setDescription("gain –0.25 (cut) to 1.0 (boost)").setRequired(true).setMinValue(-0.25).setMaxValue(1.0)),
  new SlashCommandBuilder()
    .setName("crossfade")
    .setDescription("set crossfade duration between tracks")
    .addIntegerOption((o) => o.setName("seconds").setDescription("crossfade seconds (0 = off, max 10)").setRequired(true).setMinValue(0).setMaxValue(10)),
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("show listening statistics")
    .addSubcommand((s) => s.setName("server").setDescription("top tracks for this server"))
    .addSubcommand((s) => s.setName("global").setDescription("global all-time play counts")),
  new SlashCommandBuilder()
    .setName("jukebox")
    .setDescription("vote queue mode — search and let the VC vote on what plays next")
    .addStringOption((o) =>
      o.setName("query").setDescription("what to search for").setRequired(true).setAutocomplete(true)),
];

// ── Bot startup ───────────────────────────────────────────────────────────────
export async function startAlessa(): Promise<void> {
  const rawToken = (process.env.ALESSA_TOKEN ?? process.env.ALFIE_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
  if (!rawToken) {
    log("[Alessa] No ALESSA_TOKEN set — Alessa will not start.", "alessa");
    return;
  }

  if (client) {
    try { client.destroy(); } catch { /* ignore */ }
    client = null;
  }

  // GuildMessages + MessageContent are privileged intents that require manual
  // activation in the Discord Developer Portal (Bot → Privileged Gateway
  // Intents).  Only request them when ENABLE_TTS=true so the bot can always
  // come online even if the operator hasn't toggled the intent yet.
  const ttsEnabled = process.env.ENABLE_TTS === "true";
  const requestChannelEnabled = process.env.ENABLE_REQUEST_CHANNEL === "true";
  const needsMsgIntents = ttsEnabled || requestChannelEnabled;
  if (!ttsEnabled) {
    log("[Alessa] ENABLE_TTS not set — /speak TTS disabled. Set ENABLE_TTS=true and enable Message Content Intent in Discord portal to activate it.", "alessa");
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      ...(needsMsgIntents
        ? [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
        : []),
    ],

    // ── Render free-tier memory optimisation ────────────────────────────────
    // GuildMessages + MessageContent are added only for the ambient /speak TTS
    // feature. All other caches are tightly limited to keep heap small:
    // less GC pressure → heartbeats fire on time → no shard disconnects → no
    // music drops.
    makeCache: Options.cacheWithLimits({
      MessageManager: 0,              // no MessageContent intent — nothing arrives
      GuildMemberManager: 200,        // keep recent members for voice-channel checks
      UserManager: 0,                 // users are accessible via member.user
      GuildEmojiManager: 0,           // never referenced in any command
      GuildStickerManager: 0,         // not used
      GuildBanManager: 0,             // not used
      GuildScheduledEventManager: 0,  // not used
      PresenceManager: 0,             // no GUILD_PRESENCES intent
      ReactionManager: 0,             // not used
      StageInstanceManager: 0,        // not used
      ThreadManager: 0,               // not used
      ThreadMemberManager: 0,         // not used
    }),

    // ── REST hardening for Render's throttled network ───────────────────────
    // Default timeout is 15 s with 3 retries (= up to 60 s blocked).
    // Cap each attempt at 10 s with 1 retry so a slow Discord edge node can't
    // stall the event loop long enough to miss a heartbeat.
    rest: {
      timeout: 10_000,
      retries: 1,
    },
  });

  client.once("ready", async (readyClient) => {
    log(`[Alessa] Logged in as ${readyClient.user.tag}`, "alessa");
    botState = {
      online: true,
      tag: readyClient.user.tag,
      avatarUrl: readyClient.user.displayAvatarURL(),
      guildCount: readyClient.guilds.cache.size,
      uptimeStart: Date.now(),
      status: "online",
      lastError: null,
    };

    presenceClient = readyClient;
    updateBotPresence();
    if (idlePresenceTimer) clearInterval(idlePresenceTimer);
    idlePresenceTimer = setInterval(() => {
      idlePresenceIdx++;
      if (activeNowPlaying.size === 0) updateBotPresence();
    }, 30_000);
    idlePresenceTimer.unref?.();

    setRaveClient(readyClient);
    initMusic(readyClient);
    setTTSClient(readyClient);

    // Load persistent guild settings (request channels, crossfade)
    try {
      const allSettings = await storage.getAllGuildSettings();
      for (const s of allSettings) {
        if (s.requestChannelId) requestChannels.set(s.guildId, s.requestChannelId);
        if (s.crossfadeSeconds != null) setCrossfadeSeconds(s.guildId, s.crossfadeSeconds);
      }
      log(`[Alessa] Loaded settings for ${allSettings.length} guild(s)`, "alessa");
    } catch (e: any) {
      log(`[Alessa] Could not load guild settings from DB: ${e.message}`, "alessa");
    }

    setNowPlayingCallback((guildId, track, queue) => {
      const session = djSessions.get(guildId);
      if (session) {
        onDjTrackStart(guildId, track, queue.volume, queue.player);
        const q = getQueue(guildId);
        if (q && q.tracks.length < 3) {
          void refillDjQueue(guildId, session);
        }
      }

      // Update bot presence to reflect the new track
      activeNowPlaying.set(guildId, { track, paused: false });
      updateBotPresence();

      const hist = trackHistory.get(guildId) ?? [];
      hist.unshift({ title: track.title, author: track.author, duration: track.duration, uri: track.uri, requestedBy: track.requestedBy, playedAt: Date.now() });
      if (hist.length > HISTORY_LIMIT) hist.pop();
      trackHistory.set(guildId, hist);

      storage.recordSongPlay(guildId, track.uri, track.title, track.author, track.requestedBy ?? "unknown").catch(() => {});

      const ch = readyClient.channels.cache.get(queue.textChannelId) as TextChannel | null;
      if (!ch) return;

      void (async () => {
        try {
          const embed = buildNowPlayingEmbedFast(track, queue);
          const sent = await ch.send({
            embeds: [embed],
            components: buildMusicButtons(false, queue),
            allowedMentions: { parse: [] },
          });
          void buildNowPlayingEmbed(track, queue).then((richEmbed) => {
            sent.edit({ embeds: [richEmbed], components: buildMusicButtons(false, queue), allowedMentions: { parse: [] } }).catch(() => {});
          });
          scheduleNowPlayingProgressUpdates(sent, guildId, track);
        } catch (err: any) {
          log(`[Alessa] Failed to post now-playing: ${err.message}`, "alessa");
        }
      })();
    });

    setTextNotifyCallback((guildId, textChannelId, message) => {
      const ch = readyClient.channels.cache.get(textChannelId) as TextChannel | null;
      ch?.send({ content: message, allowedMentions: { parse: [] } }).catch(() => {});
    });

    setQueueStopCallback((guildId) => {
      markGuildStopped(guildId);
    });

    // Register slash commands per guild
    const rest = new REST({ version: "10" }).setToken(rawToken);
    const commandData = SLASH_COMMANDS.map((c) => c.toJSON());
    for (const guild of readyClient.guilds.cache.values()) {
      try {
        await rest.put(Routes.applicationGuildCommands(readyClient.user.id, guild.id), { body: commandData });
        log(`[Alessa] Slash commands registered in ${guild.name}`, "alessa");
      } catch (err: any) {
        log(`[Alessa] Failed to register commands in ${guild.name}: ${err.message}`, "alessa");
      }
    }
  });

  // ── Autocomplete ────────────────────────────────────────────────────────────
  client.on("interactionCreate", async (interaction) => {
    if (interaction.isAutocomplete()) {
      const focused = interaction.options.getFocused();
      if (!focused || focused.length < 2) { await interaction.respond([]); return; }
      try {
        const results = await Promise.race([
          searchTracks(focused, 12),
          new Promise<[]>(res => setTimeout(() => res([]), 2500)),
        ]);
        const seen = new Set<string>();
        const dedupedItems: Array<{ uri: string; text: string; label: string }> = [];
        for (const t of results) {
          const text = truncateDiscordText(
            t.author ? `${t.author} - ${t.title}` : t.title, 90,
          );
          const key = text.toLowerCase().trim();
          if (!seen.has(key)) {
            seen.add(key);
            dedupedItems.push({
              uri: t.uri,
              text,
              label: truncateDiscordText(`${t.title} — ${t.author}`, 100),
            });
          }
          if (dedupedItems.length >= 8) break;
        }
        // Detect dominant artist — surface a discography option when 2+ results share the same artist
        const artistCounts = new Map<string, number>();
        for (const t of results) {
          if (t.author) artistCounts.set(t.author, (artistCounts.get(t.author) ?? 0) + 1);
        }
        let topArtist: string | null = null;
        let topCount = 0;
        for (const [artist, count] of artistCounts) {
          if (count > topCount) { topArtist = artist; topCount = count; }
        }
        const artistItems: Array<{ uri: string; text: string; label: string }> = [];
        if (topArtist && topCount >= 2) {
          const label = truncateDiscordText(`🎤 ${topArtist} — play discography`, 100);
          artistItems.push({ uri: `artist:${topArtist}`, text: label, label });
        }
        // Cache so /play can resolve the exact track, not a fresh re-search
        const acKey = `${interaction.guildId}:${interaction.user.id}`;
        const allItems = [...artistItems, ...dedupedItems];
        acCacheStore(acKey, allItems);
        await interaction.respond(
          allItems.map((item, i) => ({
            name: item.label,
            value: `ac:${i}|${item.text}`.slice(0, 100),
          })),
        );
      } catch { await interaction.respond([]); }
      return;
    }

    // ── Button interactions ─────────────────────────────────────────────────
    if (interaction.isMessageComponent()) {
      const { customId } = interaction;
      const guildId = interaction.guildId;
      if (!guildId) return;

      // Rave vibe votes are handled in dj.ts
      if (customId.startsWith("rave_fire_") || customId.startsWith("rave_skull_")) return;

      // Jukebox vote buttons
      if (customId.startsWith("jukebox_vote_")) {
        const optIdx = parseInt(customId.slice("jukebox_vote_".length));
        const session = jukeboxSessions.get(guildId);
        if (!session || isNaN(optIdx) || optIdx >= session.options.length) {
          await interaction.reply({ content: "that vote session has ended~", ephemeral: true });
          return;
        }
        const prevVote = session.votes.get(interaction.user.id);
        if (prevVote !== undefined) session.voteCounts[prevVote] = Math.max(0, session.voteCounts[prevVote] - 1);
        session.votes.set(interaction.user.id, optIdx);
        session.voteCounts[optIdx]++;
        const tally = session.voteCounts.map((v, i) => `${i + 1}. ${v} vote${v !== 1 ? "s" : ""}`).join(" | ");
        await interaction.reply({ content: `you voted for option **${optIdx + 1}**~ ♡ tally: ${tally}`, ephemeral: true });
        return;
      }

      const musicActions = [
        "music_pause", "music_skip", "music_stop", "music_like", "music_back",
        "music_shuffle", "music_loop", "music_autoplay", "music_queue",
      ];
      if (!musicActions.includes(customId)) return;

      const action = customId.replace("music_", "");

      const djProtected = ["pause", "skip", "stop", "back", "shuffle", "loop", "autoplay"];
      if (djProtected.includes(action) && !checkDjPermission(interaction, guildId)) {
        await interaction.reply({ content: `you need the ${djRoleName(guildId, interaction.guild)} role to control music here~ ♡`, ephemeral: true });
        return;
      }

      const q = getQueue(guildId);

      if (action === "back") {
        const hist = trackHistory.get(guildId);
        const prev = hist?.[1];
        if (!prev) {
          await interaction.reply({ content: "no history to go back to~ hehe", ephemeral: true });
          return;
        }
        if (!q) {
          await interaction.reply({ content: "nothing's playing right now~ hehe", ephemeral: true });
          return;
        }
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        if (!member?.voice?.channelId) {
          await interaction.reply({ content: "join a voice channel first~ ehehe", ephemeral: true });
          return;
        }
        await interaction.deferUpdate();
        try {
          const track = await resolveTrack(prev.uri, interaction.user.username);
          if (!track) { await interaction.followUp({ content: "couldn't find that track~ sorry ♡", ephemeral: true }); return; }
          await addToFront(guildId, q.voiceChannelId, q.textChannelId, track, interaction.guild?.shardId ?? 0);
          await skipTrack(guildId);
        } catch (err: any) {
          await interaction.followUp({ content: `back went oopsie~ ${err.message}`, ephemeral: true });
        }
        return;
      }

      if (action === "pause") {
        await interaction.deferUpdate();
        if (!q) return;
        if (q.player.paused) {
          await resumeMusic(guildId);
          markGuildResumed(guildId);
        } else {
          await pauseMusic(guildId);
          markGuildPaused(guildId);
        }
        const qAfter = getQueue(guildId);
        if (!qAfter?.current) return;
        await interaction.message.edit({
          embeds: [await buildNowPlayingEmbed(qAfter.current, qAfter)],
          components: buildMusicButtons(qAfter.player.paused, qAfter),
        }).catch(() => {});
        scheduleNowPlayingProgressUpdates(interaction.message as Message, guildId, qAfter.current);
        return;
      }

      if (action === "skip") {
        cancelDjFades(guildId);
        await interaction.deferUpdate();
        try {
          const result = await requestSkip(client!, guildId, interaction.user.id);
          if (result.kind !== "skipped") {
            await interaction.followUp({ content: formatSkipReply(result), ephemeral: true });
          }
        } catch (err: any) {
          await interaction.followUp({ content: `skip failed: ${err.message}`, ephemeral: true });
        }
        return;
      }

      if (action === "stop") {
        await stopMusic(guildId);
        await interaction.update({ content: "⏹  Stopped and disconnected.", embeds: [], components: [] });
        return;
      }

      if (action === "like") {
        if (!q?.current) { await interaction.reply({ content: "nothing is playing right now.", ephemeral: true }); return; }
        const track = q.current;
        const isSpotify = /open\.spotify\.com|spotify:/i.test(track.uri);
        const spotifyLink = isSpotify
          ? track.uri
          : `https://open.spotify.com/search/${encodeURIComponent(`${track.title} ${track.author}`)}`;

        const dmEmbed = new EmbedBuilder()
          .setTitle("❤️ Saved to your liked songs")
          .setDescription([`**${track.title}**`, `by ${track.author}`, "", `[Source](${track.uri})` + (isSpotify ? "" : ` · [🎧 Spotify](${spotifyLink})`)].join("\n"))
          .setURL(track.uri)
          .setColor(0xed4245);
        if (track.artworkUrl) dmEmbed.setThumbnail(track.artworkUrl);
        if (interaction.guild?.name) dmEmbed.setFooter({ text: `from ${interaction.guild.name}` });

        try {
          const dm = await interaction.user.createDM();
          await dm.send({ content: isSpotify ? `🎧 ${spotifyLink}` : `🔗 ${track.uri}\n🎧 ${spotifyLink}`, embeds: [dmEmbed], allowedMentions: { parse: [] } });
          await interaction.reply({ content: `❤️ saved **${track.title}** to your DMs.`, ephemeral: true });
        } catch {
          await interaction.reply({ content: "couldn't DM you — check your DMs are open for this server, then try again.", ephemeral: true });
        }
        return;
      }

      if (action === "shuffle") {
        await interaction.deferUpdate();
        shuffleQueue(guildId);
        const q2 = getQueue(guildId);
        if (!q2?.current) return;
        await interaction.message.edit({
          embeds: [buildNowPlayingEmbedFast(q2.current, q2)],
          components: buildMusicButtons(q2.player.paused, q2),
        }).catch(() => {});
        void buildNowPlayingEmbed(q2.current, q2).then((rich) =>
          interaction.message.edit({ embeds: [rich] }).catch(() => {}),
        );
        return;
      }

      if (action === "loop") {
        await interaction.deferUpdate();
        cycleLoop(guildId);
        const q2 = getQueue(guildId);
        if (!q2?.current) return;
        await interaction.message.edit({
          embeds: [buildNowPlayingEmbedFast(q2.current, q2)],
          components: buildMusicButtons(q2.player.paused, q2),
        }).catch(() => {});
        void buildNowPlayingEmbed(q2.current, q2).then((rich) =>
          interaction.message.edit({ embeds: [rich] }).catch(() => {}),
        );
        return;
      }

      if (action === "autoplay") {
        await interaction.deferUpdate();
        const q2 = getQueue(guildId);
        if (!q2?.current) return;
        setAutoplay(guildId, !q2.autoplay);
        const q3 = getQueue(guildId);
        if (!q3?.current) return;
        await interaction.message.edit({
          embeds: [buildNowPlayingEmbedFast(q3.current, q3)],
          components: buildMusicButtons(q3.player.paused, q3),
        }).catch(() => {});
        void buildNowPlayingEmbed(q3.current, q3).then((rich) =>
          interaction.message.edit({ embeds: [rich] }).catch(() => {}),
        );
        return;
      }

      if (action === "queue") {
        const q2 = getQueue(guildId);
        if (!q2 || (!q2.current && q2.tracks.length === 0)) {
          await interaction.reply({ content: "the queue is empty~", ephemeral: true });
          return;
        }
        const lines: string[] = [];
        if (q2.current) lines.push(`**▶ ${truncateDiscordText(q2.current.title, 60)}**`);
        q2.tracks.slice(0, 10).forEach((t, i) => {
          lines.push(`${i + 1}. ${truncateDiscordText(t.title, 60)}`);
        });
        if (q2.tracks.length > 10) lines.push(`…and ${q2.tracks.length - 10} more ♡`);
        await interaction.reply({ content: lines.join("\n"), ephemeral: true });
        return;
      }

      return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;
    const guildId = interaction.guildId ?? undefined;
    const replyEph = (content: string) => interaction.reply({ content, ephemeral: true, allowedMentions: { parse: [] } });

    if (commandName === "ping") {
      const start = Date.now();
      await interaction.reply({ content: "pong~! ♡", allowedMentions: { parse: [] } });
      await interaction.editReply(`pong~! roundtrip: **${Date.now() - start}ms** · ws: **${client?.ws.ping ?? -1}ms** ♡`);
      return;
    }

    if (commandName === "status") {
      const uptime = botState.uptimeStart ? Math.floor((Date.now() - botState.uptimeStart) / 1000) : null;
      const uptimeStr = uptime != null ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s` : "unknown";
      await interaction.reply({
        content: [`**alessa status~ ♡**`, `online: yes~!`, `uptime: ${uptimeStr}`, `servers: ${botState.guildCount}`].join("\n"),
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (commandName === "help") {
      await interaction.reply({
        content: [
          "**alessa — music commands~ ♡**",
          "",
          "**playback**",
          "`/play <query>` — play a song or playlist",
          "`/playtop <query>` — queue at the front",
          "`/skip` — skip current track (vote-skip with 3+ listeners)",
          "`/skipto <pos>` — jump straight to a queue position",
          "`/stop` — stop and disconnect",
          "`/pause` / `/resume` — pause or resume",
          "`/seek <time>` — seek to position, e.g. `1:30`",
          "`/replay` — restart the current track",
          "`/reconnect` — switch to a fresh lavalink node",
          "`/disconnect` — leave the voice channel",
          "",
          "**queue**",
          "`/queue` — show the queue",
          "`/nowplaying` — show what's playing~",
          "`/history` — recently played tracks",
          "`/shuffle` — shuffle the queue",
          "`/loop` — cycle loop mode (off → track → queue)",
          "`/volume <0-100>` — set volume",
          "`/remove <pos>` — remove a track",
          "`/move <from> <to>` — reorder tracks",
          "`/clear` — clear the queue",
          "`/removedupes` — remove duplicate tracks",
          "`/autoplay` — toggle autoplay",
          "",
          "**audio effects~ ✨**",
          "`/bassboost [off/low/medium/high]` — boom boom bass ♡",
          "`/nightcore` — fast + high pitch",
          "`/vaporwave` — slow + dreamy",
          "`/8d` — audio rotates around your head (use headphones!)",
          "`/karaoke` — reduce vocals",
          "`/filter [preset]` — show or set any filter preset",
          "",
          "**extras~**",
          "`/lyrics [song]` — fetch lyrics",
          "`/grab` — save current song to DMs ♡",
          "`/savequeue <name>` — save the queue as a playlist",
          "`/playlist list/load/delete` — manage playlists",
          "`/rave <genre> [minutes]` — infinite genre rave with DJ mode",
          "`/ravestop` — end the rave",
          "`/speak <text>` — TTS in voice channel",
          "",
          "**server settings~**",
          "`/djrole set/clear/show` — restrict music control to a role",
          "`/247` — toggle 24/7 mode (stay in VC always)",
          "`/requestchannel set/off` — song-request text channel (react ✅/❌)",
          "",
          "**premium features~ ✨ (free!)**",
          "`/sleep <minutes>` — auto-stop after N minutes (0 to cancel)",
          "`/eq <band> <gain>` — fine-tune EQ (bands 0–14, gain –0.25 to 1.0)",
          "`/crossfade <seconds>` — blend tracks together (0 = off, max 10)",
          "`/stats server/global` — listening stats for this server or everywhere",
          "`/jukebox <query>` — vote queue: search 3 songs, VC votes, winner plays",
          "`/play <spotify playlist URL>` — import a Spotify playlist directly",
        ].join("\n"),
        allowedMentions: { parse: [] },
      });
      return;
    }

    // All music commands require a guild
    if (!guildId) { await replyEph("music only works in servers~ sorry ♡"); return; }

    // DJ role gate — music control commands require the DJ role if one is configured
    const MUSIC_CONTROL_COMMANDS = new Set([
      "play", "playtop", "skip", "skipto", "stop", "pause", "resume", "volume",
      "shuffle", "loop", "seek", "remove", "move", "clear", "removedupes", "replay",
      "bassboost", "nightcore", "vaporwave", "8d", "karaoke", "filter",
      "rave", "ravestop", "speak", "247",
    ]);
    if (MUSIC_CONTROL_COMMANDS.has(commandName) && !checkDjPermission(interaction, guildId)) {
      await replyEph(`you need the **${djRoleName(guildId, interaction.guild)}** role to control music~ ♡`);
      return;
    }

    if (commandName === "play") {
      let query = interaction.options.getString("query", true);
      let acFallback: string | undefined;

      // Decode autocomplete cache reference: "ac:N|fallback text"
      if (query.startsWith("ac:")) {
        const pipeIdx = query.indexOf("|");
        const idx = parseInt(query.slice(3, pipeIdx === -1 ? undefined : pipeIdx));
        const fallbackText = pipeIdx !== -1 ? query.slice(pipeIdx + 1) : "";
        const cached = acCacheLookup(`${guildId}:${interaction.user.id}`, idx);
        if (cached) {
          query = cached.uri;      // resolve by the exact URI we found in autocomplete
          acFallback = cached.text; // fall back to text search if URI is blocked
        } else {
          query = fallbackText;    // cache expired — use embedded fallback text
        }
      }

      const member = interaction.guild?.members.cache.get(interaction.user.id);
      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel) { await replyEph("join a voice channel first~ ehehe"); return; }

      // Artist discography mode — queue top tracks by the selected artist
      if (query.startsWith("artist:")) {
        const artistName = query.slice("artist:".length).trim();
        await interaction.deferReply();
        try {
          await interaction.editReply({ content: `🎤 fetching **${artistName}** discography~`, allowedMentions: { parse: [] } });
          const artistResults = await searchAsQueueTracks(`ytmsearch:${artistName}`, 25, interaction.user.username);
          // Prefer tracks whose author closely matches the artist name
          const q2 = artistName.toLowerCase();
          const filtered = artistResults.filter((t) => {
            const a = (t.author ?? "").toLowerCase();
            return a.includes(q2) || q2.includes(a);
          });
          const tracksToQueue = (filtered.length >= 5 ? filtered : artistResults).slice(0, 20);
          if (!tracksToQueue.length) {
            await interaction.editReply({ content: `couldn't find any tracks by **${artistName}**~ try a different spelling?`, allowedMentions: { parse: [] } });
            return;
          }
          const result = await joinAndPlayMultiple(guildId, voiceChannel.id, interaction.channelId, tracksToQueue, interaction.guild?.shardId ?? 0);
          await interaction.editReply({ content: `${result === "playing" ? "▶ playing" : "queued"} **${tracksToQueue.length} tracks** by **${artistName}** ♡`, allowedMentions: { parse: [] } });
        } catch (err: any) {
          await interaction.editReply({ content: `artist search went oopsie~ ${err.message}`, allowedMentions: { parse: [] } });
        }
        return;
      }

      await interaction.deferReply();
      try {
        // Snapshot whether a session is actively playing RIGHT NOW, before any
        // async resolution. Track resolution can take several seconds on obscure
        // songs (trying multiple nodes/sources). If the current song ends during
        // that window, queue.current becomes null and the new track would start
        // immediately instead of queuing — overriding the listener's session.
        // Passing forceQueue=true to joinAndPlay prevents that race.
        const preResolveQueue = getQueue(guildId);
        const wasActivePlaying = !!(
          preResolveQueue &&
          !preResolveQueue.isStopped &&
          (preResolveQueue.current || preResolveQueue.player.paused || preResolveQueue.isAdvancing)
        );

        const isUrl = /^https?:\/\//i.test(query);
        // Spotify playlist / album → resolve via Spotify API, not Lavalink
        if (isUrl && !acFallback && /open\.spotify\.com\/(playlist|album)\//.test(query)) {
          await interaction.editReply({ content: "fetching spotify playlist~ this might take a moment ♡", allowedMentions: { parse: [] } });
          const spTracks = (await fetchSpotifyPlaylistTracks(query, interaction.user.username)) ?? [];
          if (!spTracks.length) { await interaction.editReply({ content: "couldn't find any tracks in that spotify playlist~", allowedMentions: { parse: [] } }); return; }
          const result = await joinAndPlayMultiple(guildId, voiceChannel.id, interaction.channelId, spTracks, interaction.guild?.shardId ?? 0);
          await interaction.editReply({ content: `${result === "playing" ? "▶ playing" : "queued"} **${spTracks.length} tracks** from that spotify playlist~ ♡`, allowedMentions: { parse: [] } });
          return;
        }
        // Autocomplete selections always resolve as single tracks even if URI looks like a URL
        if (isUrl && !acFallback) {
          const { tracks, playlistName } = await resolvePlaylist(query, interaction.user.username);
          if (!tracks.length) { await interaction.editReply({ content: "couldn't find anything there~ try a different link?", allowedMentions: { parse: [] } }); return; }
          if (tracks.length === 1) {
            const result = await joinAndPlay(guildId, voiceChannel.id, interaction.channelId, tracks[0], interaction.guild?.shardId ?? 0, wasActivePlaying);
            if (result === "playing") {
              const q = getQueue(guildId)!;
              const sent = await interaction.editReply({ embeds: [await buildNowPlayingEmbed(tracks[0], q)], components: buildMusicButtons(false, q), allowedMentions: { parse: [] } });
              scheduleNowPlayingProgressUpdates(sent, guildId, tracks[0]);
            } else {
              const dur = tracks[0].isStream ? "LIVE" : formatDuration(tracks[0].duration);
              await interaction.editReply({ content: `added **${tracks[0].title}** by ${tracks[0].author} [${dur}] to the queue~! ♡`, allowedMentions: { parse: [] } });
            }
          } else {
            const result = await joinAndPlayMultiple(guildId, voiceChannel.id, interaction.channelId, tracks, interaction.guild?.shardId ?? 0);
            await interaction.editReply({ content: result === "playing" ? `playing playlist **${playlistName ?? "untitled"}**~ ${tracks.length} tracks loaded yay~! ♡` : `queued playlist **${playlistName ?? "untitled"}**~ ${tracks.length} tracks added ♡`, allowedMentions: { parse: [] } });
          }
        } else {
          // Single-track path: text query OR autocomplete URI (with fallback)
          const track = await resolveTrack(query, interaction.user.username, acFallback);
          if (!track) { await interaction.editReply({ content: "couldn't find that~ try something else?", allowedMentions: { parse: [] } }); return; }
          const result = await joinAndPlay(guildId, voiceChannel.id, interaction.channelId, track, interaction.guild?.shardId ?? 0, wasActivePlaying);
          if (result === "playing") {
            const q = getQueue(guildId)!;
            const sent = await interaction.editReply({ embeds: [await buildNowPlayingEmbed(track, q)], components: buildMusicButtons(false, q), allowedMentions: { parse: [] } });
            scheduleNowPlayingProgressUpdates(sent, guildId, track);
          } else {
            const dur = track.isStream ? "LIVE" : formatDuration(track.duration);
            await interaction.editReply({ content: `added **${track.title}** by ${track.author} [${dur}] to the queue~! ♡`, allowedMentions: { parse: [] } });
          }
        }
      } catch (err: any) {
        log(`[Alessa/slash:play] ${err.message}`, "alessa");
        await interaction.editReply({ content: `oopsie~ music went boom: ${err.message}`, allowedMentions: { parse: [] } });
      }
      return;
    }

    if (commandName === "playtop") {
      const query = interaction.options.getString("query", true);
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel) { await replyEph("join a voice channel first~ ehehe"); return; }
      await interaction.deferReply();
      try {
        const track = await resolveTrack(query, interaction.user.username);
        if (!track) { await interaction.editReply({ content: "couldn't find that~ try something else?", allowedMentions: { parse: [] } }); return; }
        const result = await addToFront(guildId, voiceChannel.id, interaction.channelId, track, interaction.guild?.shardId ?? 0);
        if (result === "playing") {
          const q = getQueue(guildId)!;
          const sent = await interaction.editReply({ embeds: [await buildNowPlayingEmbed(track, q)], components: buildMusicButtons(false, q), allowedMentions: { parse: [] } });
          scheduleNowPlayingProgressUpdates(sent, guildId, track);
        } else {
          const dur = track.isStream ? "LIVE" : formatDuration(track.duration);
          await interaction.editReply({ content: `added **${track.title}** to the top of the queue~! ♡`, allowedMentions: { parse: [] } });
        }
      } catch (err: any) {
        await interaction.editReply({ content: `oopsie~ music went boom: ${err.message}`, allowedMentions: { parse: [] } });
      }
      return;
    }

    if (commandName === "skip") {
      cancelDjFades(guildId);
      try {
        const result = await requestSkip(client!, guildId, interaction.user.id);
        await interaction.reply({ content: formatSkipReply(result), allowedMentions: { parse: [] } });
      } catch (err: any) {
        await replyEph(`skip went oopsie~ ${err.message}`);
      }
      return;
    }

    if (commandName === "stop") {
      try {
        onDjStop(guildId);
        activeTTSSessions.delete(guildId);
        disconnectTTS(guildId);
        const stopped = await stopMusic(guildId);
        await interaction.reply({ content: stopped ? "stopped~! see you soon ♡" : "i wasn't even playing anything~ ehehe", allowedMentions: { parse: [] } });
      } catch (err: any) {
        await replyEph(`stop went oopsie~ ${err.message}`);
      }
      return;
    }

    if (commandName === "disconnect") {
      try {
        activeTTSSessions.delete(guildId);
        disconnectTTS(guildId);
        const done = await disconnectMusic(guildId);
        await interaction.reply({ content: done ? "disconnected~! byebye ♡" : "i'm not even in a voice channel~ hehe", allowedMentions: { parse: [] } });
      } catch (err: any) {
        await replyEph(`disconnect went oopsie~ ${err.message}`);
      }
      return;
    }

    if (commandName === "reconnect") {
      await interaction.deferReply();
      try {
        const result = await reconnectMusic(guildId);
        if (result.ok) {
          const where = result.trackTitle ? `resumed **${result.trackTitle}**${result.resumedAt > 0 ? ` at ${formatDuration(result.resumedAt)}` : ""}` : "queue is empty, but reconnected";
          const node = result.nodeName ? ` (now on \`${result.nodeName}\`)` : "";
          await interaction.editReply({ content: `reconnected to a fresh node${node}~ ${where} ♡`, allowedMentions: { parse: [] } });
        } else {
          await interaction.editReply({ content: `reconnect went oopsie~ ${result.message}`, allowedMentions: { parse: [] } });
        }
      } catch (err: any) {
        await interaction.editReply({ content: `reconnect went oopsie~ ${err.message}`, allowedMentions: { parse: [] } });
      }
      return;
    }

    if (commandName === "debug") {
      await interaction.deferReply();
      try {
        const actions = await debugReset(guildId);
        const lines = actions.map((a) => `• ${a}`).join("\n");
        await interaction.editReply({ content: `🔧 debug complete~\n${lines}`, allowedMentions: { parse: [] } });
      } catch (err: any) {
        await interaction.editReply({ content: `debug went oopsie~ ${err.message}`, allowedMentions: { parse: [] } });
      }
      return;
    }

    if (commandName === "pause") {
      try {
        const paused = await pauseMusic(guildId);
        if (paused) markGuildPaused(guildId);
        await interaction.reply({ content: paused ? "paused~! ♡" : "nothing to pause~ hehe", allowedMentions: { parse: [] } });
      } catch (err: any) { await replyEph(`pause went oopsie~ ${err.message}`); }
      return;
    }

    if (commandName === "resume") {
      try {
        const resumed = await resumeMusic(guildId);
        if (resumed) markGuildResumed(guildId);
        await interaction.reply({ content: resumed ? "resumed~! ♡" : "nothing to resume~ hehe", allowedMentions: { parse: [] } });
      } catch (err: any) { await replyEph(`resume went oopsie~ ${err.message}`); }
      return;
    }

    if (commandName === "queue") {
      const q = getQueue(guildId);
      if (!q || (!q.current && q.tracks.length === 0)) { await interaction.reply({ content: "the queue's empty right now~ add something ♡", allowedMentions: { parse: [] } }); return; }
      const lines: string[] = [];
      if (q.current) {
        const dur = q.current.isStream ? "LIVE" : formatDuration(q.current.duration);
        const pos = formatDuration(q.player.position);
        const loopLabel = q.loop !== "none" ? ` | loop: ${q.loop}` : "";
        lines.push(`**now playing~** ${q.current.title} [${pos}/${dur}] — req by ${q.current.requestedBy}${loopLabel}`);
      }
      if (q.tracks.length > 0) {
        lines.push("", "**up next~**");
        q.tracks.slice(0, 10).forEach((t, i) => {
          const dur = t.isStream ? "LIVE" : formatDuration(t.duration);
          lines.push(`${i + 1}. ${t.title} [${dur}] — req by ${t.requestedBy}`);
        });
        if (q.tracks.length > 10) lines.push(`…and ${q.tracks.length - 10} more~ ♡`);
      }
      await interaction.reply({ content: lines.join("\n"), allowedMentions: { parse: [] } });
      return;
    }

    if (commandName === "nowplaying") {
      const q = getQueue(guildId);
      if (!q?.current) { await interaction.reply({ content: "nothing's playing right now~ hehe", allowedMentions: { parse: [] } }); return; }
      await interaction.deferReply();
      const sent = await interaction.editReply({ embeds: [await buildNowPlayingEmbed(q.current, q)], components: buildMusicButtons(q.player.paused, q), allowedMentions: { parse: [] } });
      scheduleNowPlayingProgressUpdates(sent, guildId, q.current);
      return;
    }

    if (commandName === "volume") {
      const level = interaction.options.getInteger("level", true);
      try {
        const ok = await setMusicVolume(guildId, level);
        await interaction.reply({ content: ok ? `volume set to **${level}%**~! ♡` : "nothing's playing~ hehe", allowedMentions: { parse: [] } });
      } catch (err: any) { await replyEph(`volume went oopsie~ ${err.message}`); }
      return;
    }

    if (commandName === "shuffle") {
      const ok = shuffleQueue(guildId);
      await interaction.reply({ content: ok ? "shuffled the queue~! ehehe ♡" : "nothing to shuffle~ add some songs first!", allowedMentions: { parse: [] } });
      return;
    }

    if (commandName === "loop") {
      const mode = cycleLoop(guildId);
      await interaction.reply({ content: mode != null ? `loop is now **${mode}**~! ♡` : "nothing's playing~ hehe", allowedMentions: { parse: [] } });
      return;
    }

    if (commandName === "seek") {
      const timeStr = interaction.options.getString("time", true);
      const ms = parseSeekTime(timeStr);
      if (ms === null) { await replyEph("invalid time~ try something like `1:30` or `90`!"); return; }
      try {
        const ok = await seekTrack(guildId, ms);
        await interaction.reply({ content: ok ? `seeked to **${formatDuration(ms)}**~! ♡` : "nothing's playing~ hehe", allowedMentions: { parse: [] } });
      } catch (err: any) { await replyEph(`seek went oopsie~ ${err.message}`); }
      return;
    }

    if (commandName === "remove") {
      const pos = interaction.options.getInteger("position", true);
      const removed = removeTrack(guildId, pos - 1);
      await interaction.reply({ content: removed ? `removed **${removed.title}** from the queue~!` : "that position doesn't exist~ hehe", allowedMentions: { parse: [] } });
      return;
    }

    if (commandName === "move") {
      const from = interaction.options.getInteger("from", true);
      const to = interaction.options.getInteger("to", true);
      const ok = moveTrack(guildId, from - 1, to - 1);
      await interaction.reply({ content: ok ? `moved it from **${from}** to **${to}**~! ♡` : "those positions don't look right~ hehe", allowedMentions: { parse: [] } });
      return;
    }

    if (commandName === "clear") {
      const count = clearQueue(guildId);
      await interaction.reply({ content: count > 0 ? `cleared **${count}** track${count !== 1 ? "s" : ""} from the queue~!` : "queue was already empty~ hehe", allowedMentions: { parse: [] } });
      return;
    }

    if (commandName === "autoplay") {
      const enabled = interaction.options.getBoolean("enabled", false);
      const newState = enabled != null ? setAutoplay(guildId, enabled) : setAutoplay(guildId, !isAutoplayEnabled(guildId));
      await interaction.reply({ content: `autoplay is now **${newState ? "on" : "off"}**~! ♡`, allowedMentions: { parse: [] } });
      return;
    }

    if (commandName === "lyrics") {
      const songOpt = interaction.options.getString("song", false)?.trim();
      await interaction.deferReply();
      try {
        let artist: string;
        let title: string;
        if (songOpt) {
          const parts = songOpt.split(/\s*[-–]\s*/);
          if (parts.length >= 2) { artist = parts[0].trim(); title = parts.slice(1).join(" - ").trim(); }
          else { artist = ""; title = songOpt; }
        } else {
          const q = getQueue(guildId);
          if (!q?.current) { await interaction.editReply({ content: "nothing's playing~ try `/lyrics artist - title` to specify a song!", allowedMentions: { parse: [] } }); return; }
          artist = q.current.author;
          title = q.current.title;
        }
        const lyrics = await fetchLyrics(artist, title);
        if (!lyrics) { await interaction.editReply({ content: `couldn't find lyrics for **${title}**${artist ? ` by ${artist}` : ""}~ sorry ♡`, allowedMentions: { parse: [] } }); return; }
        const chunks = lyrics.match(/[\s\S]{1,1900}/g) ?? [];
        const header = `**${title}**${artist ? `\nby ${artist}` : ""}\n\n`;
        await interaction.editReply({ content: header + chunks[0], allowedMentions: { parse: [] } });
        for (const chunk of chunks.slice(1)) {
          await interaction.followUp({ content: chunk, allowedMentions: { parse: [] } });
        }
      } catch (err: any) {
        await interaction.editReply({ content: `lyrics went oopsie~ ${err.message}`, allowedMentions: { parse: [] } });
      }
      return;
    }

    if (commandName === "history") {
      const hist = trackHistory.get(guildId);
      if (!hist || hist.length === 0) { await interaction.reply({ content: "no history yet this session~ hehe", allowedMentions: { parse: [] } }); return; }
      const lines = hist.slice(0, 15).map((t, i) => {
        const dur = formatDuration(t.duration);
        const ago = Math.floor((Date.now() - t.playedAt) / 60_000);
        const agoStr = ago < 1 ? "just now" : `${ago}m ago`;
        return `${i + 1}. **${t.title}** — ${t.author} [${dur}] (${agoStr})`;
      });
      await interaction.reply({ content: `**recently played~**\n${lines.join("\n")}`, allowedMentions: { parse: [] } });
      return;
    }

    if (commandName === "savequeue") {
      const name = interaction.options.getString("name", true).trim();
      const q = getQueue(guildId);
      const tracks = q ? [q.current, ...q.tracks].filter(Boolean) as QueueTrack[] : [];
      if (!tracks.length) { await replyEph("the queue's empty~ nothing to save hehe"); return; }
      await interaction.deferReply();
      try {
        const existing = await storage.getPlaylist(interaction.user.id, guildId, name);
        let pl = existing;
        if (!pl) pl = await storage.createPlaylist(interaction.user.id, guildId, name);
        await storage.setPlaylistTracks(pl.id, tracks.map((t, i) => ({ position: i, encoded: t.encoded, title: t.title, author: t.author, uri: t.uri, duration: t.duration, artworkUrl: t.artworkUrl ?? null })));
        await interaction.editReply({ content: `saved **${tracks.length}** track${tracks.length !== 1 ? "s" : ""} as **${name}**~! ♡`, allowedMentions: { parse: [] } });
      } catch (err: any) {
        await interaction.editReply({ content: `savequeue went oopsie~ ${err.message}`, allowedMentions: { parse: [] } });
      }
      return;
    }

    if (commandName === "playlist") {
      const sub = interaction.options.getSubcommand();
      if (sub === "list") {
        await interaction.deferReply();
        try {
          const lists = await storage.getPlaylists(interaction.user.id, guildId);
          if (!lists.length) { await interaction.editReply({ content: "no saved playlists here yet~ hehe", allowedMentions: { parse: [] } }); return; }
          const lines = lists.map((p) => `• **${p.name}**`);
          await interaction.editReply({ content: `**your playlists~**\n${lines.join("\n")}`, allowedMentions: { parse: [] } });
        } catch (err: any) {
          await interaction.editReply({ content: `couldn't load playlists~ ${err.message}`, allowedMentions: { parse: [] } });
        }
        return;
      }

      if (sub === "load") {
        const name = interaction.options.getString("name", true).trim();
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        const voiceChannel = member?.voice?.channel;
        if (!voiceChannel) { await replyEph("join a voice channel first~ ehehe"); return; }
        await interaction.deferReply();
        try {
          const pl = await storage.getPlaylist(interaction.user.id, guildId, name);
          if (!pl) { await interaction.editReply({ content: `couldn't find a playlist called **${name}**~ hehe`, allowedMentions: { parse: [] } }); return; }
          const rows = await storage.getPlaylistTracks(pl.id);
          if (!rows.length) { await interaction.editReply({ content: `**${name}** is empty~ nothing to load hehe`, allowedMentions: { parse: [] } }); return; }
          const tracks: QueueTrack[] = rows.map((r) => ({
            encoded: r.encoded, title: r.title, author: r.author, uri: r.uri,
            duration: r.duration, isStream: false, requestedBy: interaction.user.username,
            artworkUrl: r.artworkUrl ?? null,
          }));
          const result = await joinAndPlayMultiple(guildId, voiceChannel.id, interaction.channelId, tracks, interaction.guild?.shardId ?? 0);
          await interaction.editReply({ content: result === "playing" ? `playing playlist **${name}**~ ${tracks.length} tracks loaded yay~! ♡` : `queued playlist **${name}**~ ${tracks.length} tracks added ♡`, allowedMentions: { parse: [] } });
        } catch (err: any) {
          await interaction.editReply({ content: `playlist load went oopsie~ ${err.message}`, allowedMentions: { parse: [] } });
        }
        return;
      }

      if (sub === "delete") {
        const name = interaction.options.getString("name", true).trim();
        await interaction.deferReply();
        try {
          const deleted = await storage.deletePlaylist(interaction.user.id, guildId, name);
          await interaction.editReply({ content: deleted ? `deleted **${name}** from your playlists~!` : `couldn't find a playlist called **${name}**~ hehe`, allowedMentions: { parse: [] } });
        } catch (err: any) {
          await interaction.editReply({ content: `delete went oopsie~ ${err.message}`, allowedMentions: { parse: [] } });
        }
        return;
      }
      return;
    }

    if (commandName === "rave") {
      const genre = interaction.options.getString("genre", true).trim();
      const minutes = interaction.options.getInteger("minutes", false);
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel) { await replyEph("join a voice channel first~ ehehe"); return; }
      await interaction.deferReply();
      try {
        const existing = djSessions.get(guildId);
        if (existing) {
          await interaction.editReply({ content: `there's already a **${existing.genre}** rave running~! use \`/ravestop\` first ♡`, allowedMentions: { parse: [] } });
          return;
        }
        const session = {
          genre,
          vcId: voiceChannel.id,
          tcId: interaction.channelId,
          lastTrackUri: null,
          recentUris: [],
          phase: "warmup" as const,
          totalTrackCount: 0,
          startedAt: Date.now(),
          endsAt: minutes ? Date.now() + minutes * 60_000 : null,
          playedTracks: [],
          vibeShift: false,
        };
        djSessions.set(guildId, session);
        await refillDjQueue(guildId, session);
        const durationStr = minutes ? ` for ${minutes} minute${minutes !== 1 ? "s" : ""}` : " indefinitely";
        await interaction.editReply({
          content: `🎉 rave started~! playing **${genre}**${durationStr} ♡\nvibe vote embeds will pop up as tracks play~ use \`/ravestop\` to end!`,
          allowedMentions: { parse: [] },
        });
      } catch (err: any) {
        djSessions.delete(guildId);
        await interaction.editReply({ content: `rave went oopsie~ ${err.message}`, allowedMentions: { parse: [] } });
      }
      return;
    }

    if (commandName === "ravestop") {
      onDjStop(guildId);
      const stopped = await stopMusic(guildId);
      await interaction.reply({ content: stopped ? "rave stopped~! recap's above ♡" : "no rave was running~ hehe", allowedMentions: { parse: [] } });
      return;
    }

    if (commandName === "speak") {
      const member = interaction.guild?.members.cache.get(interaction.user.id)
        ?? await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
      const voiceChannel = (member as any)?.voice?.channel;
      if (!voiceChannel) { await replyEph("join a voice channel first~ ehehe"); return; }

      const speakText = interaction.options.getString("text");

      // ── Single-shot mode: /speak <text> ───────────────────────────────────
      if (speakText) {
        await interaction.deferReply({ ephemeral: true });
        try {
          const result = await speakInVoice(guildId, speakText, voiceChannel.id, interaction.channelId, interaction.guild?.shardId ?? 0, interaction.user.username);
          if (!result.ok) {
            await interaction.editReply({ content: `TTS error~ ${result.reason ?? "all providers failed"}` });
          } else {
            await interaction.editReply({ content: `🔊 spoken: *${speakText.slice(0, 120)}${speakText.length > 120 ? "…" : ""}* ♡` });
          }
        } catch (err: any) {
          await interaction.editReply({ content: `TTS oopsie~ ${err.message}` });
        }
        return;
      }

      // ── Ambient session mode: /speak (no text) ────────────────────────────
      const existing = activeTTSSessions.get(guildId);
      if (existing && existing.userId === interaction.user.id) {
        activeTTSSessions.delete(guildId);
        disconnectTTS(guildId);
        await interaction.reply({ content: "tts session ended~ back to silence ♡", allowedMentions: { parse: [] } });
        return;
      }

      if (!ttsEnabled) {
        await replyEph(
          "ambient TTS requires `ENABLE_TTS=true` **and** Message Content Intent enabled in the Discord Developer Portal (Bot → Privileged Gateway Intents)~\n\nfor single-shot TTS without any setup, use `/speak <your text>` instead ♡"
        );
        return;
      }

      try {
        const joinResult = await speakInVoice(guildId, "ready~", voiceChannel.id, interaction.channelId, interaction.guild?.shardId ?? 0, interaction.user.username);
        if (!joinResult.ok) {
          await replyEph(`couldn't start TTS~ ${joinResult.reason ?? "unknown error"}`);
          return;
        }
      } catch (err: any) {
        await replyEph(`couldn't start TTS~ ${err.message}`);
        return;
      }

      activeTTSSessions.set(guildId, {
        userId: interaction.user.id,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channelId,
      });

      await interaction.reply({
        content: `🔊 ambient TTS on~! type anything in this channel and i'll say it ♡\nrun \`/speak\` again to stop.`,
        allowedMentions: { parse: [] },
      });
      return;
    }

    // ── Audio effects ──────────────────────────────────────────────────────────

    if (commandName === "bassboost") {
      const q = getQueue(guildId);
      if (!q?.current) { await replyEph("nothing's playing right now~ start a song first ehehe"); return; }
      const levelStr = interaction.options.getString("level", false) ?? "medium";
      const FILTER_LABELS: Record<string, string> = {
        off: "bass boost off~ back to flat ♡",
        low: "🔊 light bass boost on~! ♡",
        medium: "🔊 bass boost on~! boom boom ♡",
        high: "🔊🔊 heavy bass boost~!! your speakers okay?? ♡",
      };
      await setGuildFilter(guildId, levelStr === "off" ? "off" : "bassboost");
      await interaction.reply({ content: FILTER_LABELS[levelStr] ?? FILTER_LABELS.medium, allowedMentions: { parse: [] } });
      return;
    }

    if (commandName === "nightcore") {
      const q = getQueue(guildId);
      if (!q?.current) { await replyEph("nothing's playing right now~ start a song first ehehe"); return; }
      const newFilter: FilterPreset = getGuildFilter(guildId) === "nightcore" ? "off" : "nightcore";
      await setGuildFilter(guildId, newFilter);
      await interaction.reply({
        content: newFilter === "nightcore" ? "✨ nightcore on~! speeding up and pitching up~ ehehe ♡" : "nightcore off~ back to normal ♡",
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (commandName === "vaporwave") {
      const q = getQueue(guildId);
      if (!q?.current) { await replyEph("nothing's playing right now~ start a song first ehehe"); return; }
      const newFilter: FilterPreset = getGuildFilter(guildId) === "vaporwave" ? "off" : "vaporwave";
      await setGuildFilter(guildId, newFilter);
      await interaction.reply({
        content: newFilter === "vaporwave" ? "🌴 vaporwave on~! slowing it down, very a e s t h e t i c ♡" : "vaporwave off~ back to normal ♡",
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (commandName === "8d") {
      const q = getQueue(guildId);
      if (!q?.current) { await replyEph("nothing's playing right now~ start a song first ehehe"); return; }
      const newFilter: FilterPreset = getGuildFilter(guildId) === "8d" ? "off" : "8d";
      await setGuildFilter(guildId, newFilter);
      await interaction.reply({
        content: newFilter === "8d" ? "🎧 8D audio on~! put on your headphones for the full experience~!! ♡" : "8D off~ back to normal ♡",
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (commandName === "karaoke") {
      const q = getQueue(guildId);
      if (!q?.current) { await replyEph("nothing's playing right now~ start a song first ehehe"); return; }
      const newFilter: FilterPreset = getGuildFilter(guildId) === "karaoke" ? "off" : "karaoke";
      await setGuildFilter(guildId, newFilter);
      await interaction.reply({
        content: newFilter === "karaoke" ? "🎤 karaoke on~! vocals reduced, time to sing your heart out ♡" : "karaoke off~ vocals back ♡",
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (commandName === "filter") {
      const preset = interaction.options.getString("preset", false);
      if (!preset) {
        const current = getGuildFilter(guildId);
        const LABELS: Record<string, string> = {
          off: "none~ flat playback ♡",
          bassboost: "🔊 bassboost",
          nightcore: "✨ nightcore",
          vaporwave: "🌴 vaporwave",
          "8d": "🎧 8D audio",
          karaoke: "🎤 karaoke",
        };
        await interaction.reply({ content: `active filter: **${LABELS[current] ?? current}**`, allowedMentions: { parse: [] } });
        return;
      }
      const q = getQueue(guildId);
      if (!q?.current) { await replyEph("nothing's playing right now~ start a song first ehehe"); return; }
      await setGuildFilter(guildId, preset as FilterPreset);
      const ON_MSGS: Record<string, string> = {
        off: "filters cleared~ back to flat ♡",
        bassboost: "🔊 bassboost on~! boom boom ♡",
        nightcore: "✨ nightcore on~! speeding up~ ♡",
        vaporwave: "🌴 vaporwave on~! very aesthetic ♡",
        "8d": "🎧 8D audio on~! use headphones~ ♡",
        karaoke: "🎤 karaoke on~! sing along~ ♡",
      };
      await interaction.reply({ content: ON_MSGS[preset] ?? `filter set to **${preset}**~ ♡`, allowedMentions: { parse: [] } });
      return;
    }

    // ── Queue extras ───────────────────────────────────────────────────────────

    if (commandName === "skipto") {
      const pos = interaction.options.getInteger("position", true);
      const q = getQueue(guildId);
      if (!q?.tracks.length) { await replyEph("nothing in the queue~ add some songs first hehe"); return; }
      if (pos < 1 || pos > q.tracks.length) {
        await replyEph(`that position doesn't exist~ queue only has **${q.tracks.length}** track${q.tracks.length !== 1 ? "s" : ""} ehehe`);
        return;
      }
      const target = q.tracks[pos - 1];
      cancelDjFades(guildId);
      try {
        const ok = await skipToPosition(guildId, pos);
        await interaction.reply({ content: ok ? `⏭ jumping to **${target.title}**~! ♡` : "oopsie~ couldn't skip there, maybe nothing's playing?", allowedMentions: { parse: [] } });
      } catch (err: any) {
        await replyEph(`skipto went oopsie~ ${err.message}`);
      }
      return;
    }

    if (commandName === "removedupes") {
      const removed = removeDuplicates(guildId);
      await interaction.reply({
        content: removed > 0
          ? `removed **${removed}** duplicate track${removed !== 1 ? "s" : ""} from the queue~! nice and clean ♡`
          : "no duplicates found~ queue is already clean, ehehe ♡",
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (commandName === "replay") {
      try {
        const ok = await replayTrack(guildId);
        await interaction.reply({ content: ok ? "🔁 replaying from the start~! ♡" : "nothing's playing right now~ hehe", allowedMentions: { parse: [] } });
      } catch (err: any) {
        await replyEph(`replay went oopsie~ ${err.message}`);
      }
      return;
    }

    if (commandName === "grab") {
      const q = getQueue(guildId);
      if (!q?.current) { await replyEph("nothing's playing right now~ hehe"); return; }
      const track = q.current;
      const isSpotify = /open\.spotify\.com|spotify:/i.test(track.uri);
      const spotifyLink = isSpotify
        ? track.uri
        : `https://open.spotify.com/search/${encodeURIComponent(`${track.title} ${track.author}`)}`;
      const dmEmbed = new EmbedBuilder()
        .setTitle("❤️ Saved to your liked songs")
        .setDescription([`**${track.title}**`, `by ${track.author}`, "", `[Source](${track.uri})` + (isSpotify ? "" : ` · [🎧 Spotify](${spotifyLink})`)].join("\n"))
        .setURL(track.uri)
        .setColor(0xed4245);
      if (track.artworkUrl) dmEmbed.setThumbnail(track.artworkUrl);
      if (interaction.guild?.name) dmEmbed.setFooter({ text: `from ${interaction.guild.name} ♡` });
      try {
        const dm = await interaction.user.createDM();
        await dm.send({ content: isSpotify ? `🎧 ${spotifyLink}` : `🔗 ${track.uri}\n🎧 ${spotifyLink}`, embeds: [dmEmbed], allowedMentions: { parse: [] } });
        await interaction.reply({ content: `❤️ saved **${track.title}** to your DMs~! ♡`, ephemeral: true, allowedMentions: { parse: [] } });
      } catch {
        await replyEph("couldn't DM you~ make sure your DMs are open for this server ♡");
      }
      return;
    }

    // ── Server settings ────────────────────────────────────────────────────────

    if (commandName === "247") {
      if (guilds247.has(guildId)) {
        guilds247.delete(guildId);
        await interaction.reply({ content: "24/7 mode **off**~ i'll leave when everyone's gone ♡", allowedMentions: { parse: [] } });
      } else {
        guilds247.add(guildId);
        await interaction.reply({ content: "24/7 mode **on**~! i'll stay in VC no matter what, ehehe ♡", allowedMentions: { parse: [] } });
      }
      return;
    }

    if (commandName === "djrole") {
      const sub = interaction.options.getSubcommand();
      if (sub === "set") {
        const role = interaction.options.getRole("role", true);
        djRoles.set(guildId, role.id);
        await interaction.reply({ content: `dj role set to **${role.name}**~! only they (and admins) can control music now ♡`, allowedMentions: { parse: [] } });
        return;
      }
      if (sub === "clear") {
        djRoles.delete(guildId);
        await interaction.reply({ content: "dj role cleared~! everyone can control music now ♡", allowedMentions: { parse: [] } });
        return;
      }
      if (sub === "show") {
        const roleId = djRoles.get(guildId);
        if (!roleId) {
          await interaction.reply({ content: "no dj role set~ everyone can use music commands ♡", allowedMentions: { parse: [] } });
        } else {
          const role = interaction.guild?.roles.cache.get(roleId);
          await interaction.reply({
            content: role
              ? `current dj role: **${role.name}** ♡`
              : "the saved dj role no longer exists~ use `/djrole set` to set a new one",
            allowedMentions: { parse: [] },
          });
        }
        return;
      }
      return;
    }

    // ── Sleep timer ────────────────────────────────────────────────────────────
    if (commandName === "sleep") {
      const minutes = interaction.options.getInteger("minutes", true);
      const existing = sleepTimers.get(guildId);
      if (existing) { clearTimeout(existing.timer); sleepTimers.delete(guildId); }
      if (minutes === 0) {
        await interaction.reply({ content: "sleep timer cancelled~! i'll keep playing ♡", allowedMentions: { parse: [] } });
        return;
      }
      const endsAt = Date.now() + minutes * 60_000;
      const sleepTimer = setTimeout(async () => {
        sleepTimers.delete(guildId);
        const q = getQueue(guildId);
        const notifCh = q ? (client?.channels.cache.get(q.textChannelId) as TextChannel | null) : null;
        await stopMusic(guildId);
        notifCh?.send({ content: "sleep timer went off~ sweet dreams~ ♡ (music stopped)", allowedMentions: { parse: [] } }).catch(() => {});
      }, minutes * 60_000);
      sleepTimer.unref?.();
      sleepTimers.set(guildId, { timer: sleepTimer, endsAt });
      const offAt = `<t:${Math.floor(endsAt / 1000)}:R>`;
      await interaction.reply({ content: `sleep timer set~ i'll stop playing ${offAt} ♡`, allowedMentions: { parse: [] } });
      return;
    }

    // ── Request channel ────────────────────────────────────────────────────────
    if (commandName === "requestchannel") {
      const sub = interaction.options.getSubcommand();
      if (sub === "off") {
        requestChannels.delete(guildId);
        await storage.setRequestChannel(guildId, null).catch(() => {});
        await interaction.reply({ content: "song request channel disabled~! ♡", allowedMentions: { parse: [] } });
        return;
      }
      // sub === "set"
      const ch = interaction.options.getChannel("channel", true);
      if (!ch || ch.type !== ChannelType.GuildText) {
        await interaction.reply({ content: "please pick a text channel~ ♡", ephemeral: true, allowedMentions: { parse: [] } });
        return;
      }
      requestChannels.set(guildId, ch.id);
      await storage.setRequestChannel(guildId, ch.id).catch(() => {});
      await interaction.reply({
        content: `song request channel set to <#${ch.id}>~! users can type track names or URLs there to queue them ♡\n*(requires \`ENABLE_REQUEST_CHANNEL=true\` and Message Content Intent in Discord portal)*`,
        allowedMentions: { parse: [] },
      });
      return;
    }

    // ── EQ ─────────────────────────────────────────────────────────────────────
    if (commandName === "eq") {
      const band = interaction.options.getInteger("band", true);
      const gain = interaction.options.getNumber("gain", true);
      const ok = await setCustomEqBand(guildId, band, gain);
      if (!ok) { await replyEph("no active player to apply EQ to~ play something first ♡"); return; }
      await interaction.reply({ content: `EQ band **${band}** set to **${gain >= 0 ? "+" : ""}${gain.toFixed(2)}**~ ♡`, allowedMentions: { parse: [] } });
      return;
    }

    // ── Crossfade ──────────────────────────────────────────────────────────────
    if (commandName === "crossfade") {
      const seconds = interaction.options.getInteger("seconds", true);
      setCrossfadeSeconds(guildId, seconds);
      await storage.setGuildCrossfade(guildId, seconds).catch(() => {});
      await interaction.reply({
        content: seconds === 0
          ? "crossfade **off**~ tracks will cut cleanly ♡"
          : `crossfade set to **${seconds}s**~ tracks will blend together~! ♡`,
        allowedMentions: { parse: [] },
      });
      return;
    }

    // ── Stats ──────────────────────────────────────────────────────────────────
    if (commandName === "stats") {
      const sub = interaction.options.getSubcommand();
      await interaction.deferReply();
      try {
        if (sub === "global") {
          const s = await storage.getGlobalPlayStats();
          await interaction.editReply({
            content: [
              "**alessa — global listening stats~ ♡**",
              `🎵 **${s.totalPlays.toLocaleString()}** songs played across all servers`,
              `🎼 **${s.uniqueTracks.toLocaleString()}** unique tracks ever played`,
            ].join("\n"),
            allowedMentions: { parse: [] },
          });
        } else {
          const [s, top] = await Promise.all([
            storage.getGuildPlayStats(guildId),
            storage.getTopTracks(guildId, 10),
          ]);
          const topList = top.map((t, i) =>
            `${i + 1}. **${t.trackTitle}** by ${t.trackArtist} — ${t.playCount}×`
          ).join("\n");
          await interaction.editReply({
            content: [
              "**alessa — server listening stats~ ♡**",
              `🎵 **${s.totalPlays.toLocaleString()}** songs played in this server`,
              `🎼 **${s.uniqueTracks.toLocaleString()}** unique tracks`,
              top.length ? `\n**top ${top.length} tracks~**\n${topList}` : "",
            ].filter(Boolean).join("\n"),
            allowedMentions: { parse: [] },
          });
        }
      } catch (err: any) {
        await interaction.editReply({ content: `stats oopsie~ ${err.message}`, allowedMentions: { parse: [] } });
      }
      return;
    }

    // ── Jukebox (vote queue) ────────────────────────────────────────────────────
    if (commandName === "jukebox") {
      const jukeQuery = interaction.options.getString("query", true);
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel) { await replyEph("join a voice channel first~ ehehe"); return; }
      await interaction.deferReply();
      try {
        const results = await searchTracks(jukeQuery, 3);
        if (!results.length) { await interaction.editReply({ content: "couldn't find anything~ try again ♡", allowedMentions: { parse: [] } }); return; }
        const options = results.slice(0, 3);
        const desc = options.map((t, i) => `**${i + 1}.** ${t.title} — ${t.author} [${formatDuration(t.duration)}]`).join("\n");
        const voteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          options.map((_, i) =>
            new ButtonBuilder().setCustomId(`jukebox_vote_${i}`).setLabel(`Vote ${i + 1}`).setStyle(ButtonStyle.Secondary)
          )
        );
        const fetchedMsg = await interaction.editReply({
          content: `**🎛 jukebox vote~!** pick your song — winner plays in 20 seconds ♡\n\n${desc}`,
          components: [voteRow],
          allowedMentions: { parse: [] },
        });
        const jukeSession: JukeboxSession = {
          options,
          votes: new Map(),
          voteCounts: new Array(options.length).fill(0),
          messageId: fetchedMsg.id,
          channelId: interaction.channelId,
          guildId,
          voiceChannelId: voiceChannel.id,
          timer: setTimeout(async () => {
            jukeboxSessions.delete(guildId);
            const winner = jukeSession.voteCounts.reduce(
              (best, v, i) => v > jukeSession.voteCounts[best] ? i : best, 0
            );
            const winnerSearch = jukeSession.options[winner];
            const notifCh = client?.channels.cache.get(jukeSession.channelId) as TextChannel | null;
            try {
              const winnerTrack = await resolveTrack(winnerSearch.uri, "jukebox");
              if (!winnerTrack) throw new Error("couldn't resolve the winning track");
              const preQ = getQueue(guildId);
              const wasPlaying = !!(preQ && !preQ.isStopped && (preQ.current || preQ.player.paused));
              const result = await joinAndPlay(guildId, jukeSession.voiceChannelId, jukeSession.channelId, winnerTrack, interaction.guild?.shardId ?? 0, wasPlaying);
              notifCh?.send({
                content: `🎛 jukebox winner: **${winnerTrack.title}** (${jukeSession.voteCounts[winner]} vote${jukeSession.voteCounts[winner] !== 1 ? "s" : ""})~ ${result === "playing" ? "▶ now playing" : "added to queue"} ♡`,
                allowedMentions: { parse: [] },
              }).catch(() => {});
            } catch (err: any) {
              notifCh?.send({ content: `jukebox oopsie~ ${err.message}`, allowedMentions: { parse: [] } }).catch(() => {});
            }
            fetchedMsg.edit({ components: [] }).catch(() => {});
          }, 20_000),
        };
        jukeSession.timer.unref?.();
        jukeboxSessions.set(guildId, jukeSession);
      } catch (err: any) {
        await interaction.editReply({ content: `jukebox oopsie~ ${err.message}`, allowedMentions: { parse: [] } });
      }
      return;
    }
  });

  // ── Voice state: auto-disconnect when alone ────────────────────────────────
  const autoPausedGuilds = new Set<string>();
  const aloneDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  client.on("voiceStateUpdate", async (oldState, newState) => {
    const botId = client?.user?.id;
    if (!botId) return;
    if (oldState.id === botId || newState.id === botId) return;

    const guildId = oldState.guild?.id ?? newState.guild?.id;
    if (!guildId) return;

    const queue = getQueue(guildId);
    if (!queue) return;

    const leftChannelId = oldState.channelId;
    const joinedChannelId = newState.channelId;

    if (joinedChannelId === queue.voiceChannelId) {
      const timer = aloneDisconnectTimers.get(guildId);
      if (timer) {
        clearTimeout(timer);
        aloneDisconnectTimers.delete(guildId);
      }
      if (autoPausedGuilds.has(guildId)) {
        autoPausedGuilds.delete(guildId);
        await resumeMusic(guildId);
        markGuildResumed(guildId);
        const ch = client?.channels.cache.get(queue.textChannelId) as TextChannel | null;
        ch?.send({ content: "yay, someone's back~! resuming ♡", allowedMentions: { parse: [] } }).catch(() => {});
      }
      return;
    }

    // If the TTS session owner left their voice channel, end the session
    const ttsSession = activeTTSSessions.get(guildId);
    if (ttsSession && oldState.id === ttsSession.userId && leftChannelId === ttsSession.voiceChannelId) {
      activeTTSSessions.delete(guildId);
      disconnectTTS(guildId);
      const ttsNotifCh = client?.channels.cache.get(ttsSession.textChannelId) as TextChannel | null;
      ttsNotifCh?.send({ content: "you left the vc~ ending tts session ♡", allowedMentions: { parse: [] } }).catch(() => {});
    }

    if (leftChannelId === queue.voiceChannelId) {
      const guild = oldState.guild;
      const channel = guild.channels.cache.get(leftChannelId);
      if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) return;
      const humanCount = channel.members.filter((m) => !m.user.bot).size;
      if (humanCount > 0) return;

      if (queue.current && !queue.player.paused) {
        await pauseMusic(guildId);
        markGuildPaused(guildId);
        autoPausedGuilds.add(guildId);
      }

      // 24/7 mode: stay in VC and wait for someone to return — no disconnect timer
      if (guilds247.has(guildId)) {
        const ch247 = client?.channels.cache.get(queue.textChannelId) as TextChannel | null;
        ch247?.send({ content: "everyone left~ pausing and waiting in VC ♡ i'll resume when someone comes back!", allowedMentions: { parse: [] } }).catch(() => {});
        return;
      }

      const existing = aloneDisconnectTimers.get(guildId);
      if (existing) clearTimeout(existing);

      const ch = client?.channels.cache.get(queue.textChannelId) as TextChannel | null;
      ch?.send({ content: "everyone left~ pausing for now ♡ if no one comes back in 2 minutes i'll leave too!", allowedMentions: { parse: [] } }).catch(() => {});

      const timer = setTimeout(async () => {
        aloneDisconnectTimers.delete(guildId);
        autoPausedGuilds.delete(guildId);
        const q = getQueue(guildId);
        const notifCh = q ? (client?.channels.cache.get(q.textChannelId) as TextChannel | null) : null;
        await disconnectMusic(guildId);
        notifCh?.send({ content: "no one came back~ disconnecting, byebye ♡", allowedMentions: { parse: [] } }).catch(() => {});
      }, 2 * 60 * 1000);
      timer.unref?.();
      aloneDisconnectTimers.set(guildId, timer);
    }
  });

  // ── Ambient TTS listener ────────────────────────────────────────────────────
  // Only registered when ENABLE_TTS=true (MessageContent intent is active).
  // Without MessageContent, msg.content is always empty — no point listening.
  if (needsMsgIntents) client.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.guildId) return;

    // ── Song request channel ────────────────────────────────────────────────
    const reqChannelId = requestChannels.get(msg.guildId);
    if (reqChannelId && msg.channelId === reqChannelId) {
      const member = msg.guild?.members.cache.get(msg.author.id);
      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel || !msg.content.trim()) return;
      const reqQuery = msg.content.trim();
      try {
        const isUrl = /^https?:\/\//i.test(reqQuery);
        if (isUrl) {
          const { tracks } = await resolvePlaylist(reqQuery, msg.author.username);
          if (!tracks.length) { msg.react("❌").catch(() => {}); return; }
          const preQ = getQueue(msg.guildId);
          const wasPlaying = !!(preQ && !preQ.isStopped && (preQ.current || preQ.player.paused));
          await joinAndPlayMultiple(msg.guildId, voiceChannel.id, msg.channelId, tracks, msg.guild?.shardId ?? 0);
        } else {
          const track = await resolveTrack(reqQuery, msg.author.username);
          if (!track) { msg.react("❌").catch(() => {}); return; }
          const preQ = getQueue(msg.guildId);
          const wasPlaying = !!(preQ && !preQ.isStopped && (preQ.current || preQ.player.paused));
          await joinAndPlay(msg.guildId, voiceChannel.id, msg.channelId, track, msg.guild?.shardId ?? 0, wasPlaying);
        }
        msg.react("✅").catch(() => {});
      } catch {
        msg.react("❌").catch(() => {});
      }
      return;
    }

    // ── Ambient TTS ─────────────────────────────────────────────────────────
    if (!ttsEnabled) return;
    const session = activeTTSSessions.get(msg.guildId);
    if (!session) return;
    if (msg.author.id !== session.userId) return;
    if (msg.channelId !== session.textChannelId) return;

    const text = msg.content.trim();
    if (!text) return;

    try {
      await speakInVoice(msg.guildId, text, session.voiceChannelId, session.textChannelId, msg.guild?.shardId ?? 0, msg.author.username);
    } catch (err: any) {
      log(`[TTS] ambient speak error in guild ${msg.guildId}: ${err.message}`, "discord");
    }
  });

  client.on("guildCreate", (guild) => {
    botState.guildCount = client?.guilds.cache.size ?? botState.guildCount;
    const rest = new REST({ version: "10" }).setToken(rawToken);
    rest.put(Routes.applicationGuildCommands(client!.user!.id, guild.id), { body: SLASH_COMMANDS.map((c) => c.toJSON()) })
      .catch((e: any) => log(`[Alessa] Failed to register commands in new guild ${guild.name}: ${e.message}`, "alessa"));
  });

  client.on("guildDelete", () => {
    botState.guildCount = client?.guilds.cache.size ?? botState.guildCount;
  });

  client.on("shardDisconnect", () => {
    botState.online = false;
    botState.status = "offline";
  });

  client.on("shardReconnecting", () => { botState.status = "reconnecting"; });

  client.on("shardResume", () => {
    if (client?.user) {
      botState.online = true;
      botState.status = "online";
      botState.guildCount = client.guilds.cache.size;
      botState.lastError = null;
    }
  });

  client.on("error", (err) => {
    log(`[Alessa] Discord client error: ${err.message}`, "alessa");
    botState.lastError = err.message;
  });

  try {
    log("[Alessa] Attempting Discord login…", "alessa");
    await client.login(rawToken);
  } catch (err: any) {
    const msg: string = err.message ?? String(err);
    let friendlyError = msg;
    if (/invalid token/i.test(msg)) friendlyError = "Invalid ALESSA_TOKEN — check the value in your secrets.";
    else if (/disallowed intents/i.test(msg)) friendlyError = "Intents blocked — enable Message Content Intent in Discord Developer Portal.";

    log(`[Alessa] Login failed: ${friendlyError}`, "alessa");
    botState.lastError = friendlyError;
    botState.online = false;
    botState.status = "error";

    loginRetryTimer = setTimeout(() => startAlessa(), 30_000);
    loginRetryTimer.unref?.();
  }
}

export function getAlessaGuilds(): Array<{ id: string; name: string }> {
  if (!client) return [];
  return [...client.guilds.cache.values()].map((g) => ({ id: g.id, name: g.name }));
}

export function stopAlessa(): void {
  if (loginRetryTimer) { clearTimeout(loginRetryTimer); loginRetryTimer = null; }
  for (const t of backgroundTimers) { clearInterval(t); clearTimeout(t); }
  backgroundTimers.clear();
  for (const t of nowPlayingUpdateTimers.values()) clearTimeout(t);
  nowPlayingUpdateTimers.clear();
  if (client) { try { client.destroy(); } catch { /* ignore */ } client = null; }
  botState = { online: false, tag: null, avatarUrl: null, guildCount: 0, uptimeStart: null, status: "offline", lastError: null };
}
