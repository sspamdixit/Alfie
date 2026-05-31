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
  removeTrack,
  moveTrack,
  clearQueue,
  seekTrack,
  parseSeekTime,
  getQueue,
  formatDuration,
  setAutoplay,
  isAutoplayEnabled,
  type QueueTrack,
  type GuildQueue,
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
import { speakInVoice } from "../server/tts";
import { storage } from "../server/storage";

export interface AlfieBotStatus {
  online: boolean;
  tag: string | null;
  avatarUrl: string | null;
  guildCount: number;
  uptimeStart: number | null;
  status: string;
  lastError: string | null;
}

let botState: AlfieBotStatus = {
  online: false,
  tag: null,
  avatarUrl: null,
  guildCount: 0,
  uptimeStart: null,
  status: "offline",
  lastError: null,
};

export function getAlfieBotStatus(): AlfieBotStatus {
  return { ...botState };
}

let client: Client | null = null;
let loginRetryTimer: NodeJS.Timeout | null = null;
const backgroundTimers = new Set<NodeJS.Timeout>();

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
    const response = await fetch(url);
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
  const pending = fetchItunesAlbumArt(track).then((r) => {
    if (!r) albumArtCache.delete(key);
    return r;
  });
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
  return `[ ${formatDuration(position)} ] ${filled}🔘${remaining} [ ${formatDuration(track.duration)} ]`;
}

function buildEmbedWithImageUrl(track: QueueTrack, queue: GuildQueue, imageUrl: string | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(truncateDiscordText(track.title, 256))
    .setURL(track.uri)
    .setDescription(`\n${formatSpotifyProgressBar(track, queue)}\n`)
    .setFooter({ text: truncateDiscordText(track.author || "Unknown artist", 2048) });
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
          embeds: [await buildNowPlayingEmbed(queue.current!, queue)],
          components: [buildMusicButtons(queue.player.paused)],
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

export function buildMusicButtons(paused: boolean): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("music_back").setEmoji("⏮").setLabel("Back").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_pause").setEmoji(paused ? "▶️" : "⏸").setLabel(paused ? "Resume" : "Pause").setStyle(paused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("music_skip").setEmoji("⏭").setLabel("Skip").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_stop").setEmoji("⏹").setLabel("Stop").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("music_like").setEmoji("❤️").setLabel("Like").setStyle(ButtonStyle.Secondary),
  );
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
  new SlashCommandBuilder().setName("ping").setDescription("check if alfie is alive"),
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
    .setDescription("say something in the voice channel via TTS")
    .addStringOption((o) => o.setName("text").setDescription("text to speak").setRequired(true)),
];

// ── Bot startup ───────────────────────────────────────────────────────────────
export async function startAlfie(): Promise<void> {
  const rawToken = (process.env.ALFIE_TOKEN ?? process.env.DISCORD_TOKEN ?? "").trim();
  if (!rawToken) {
    log("[Alfie] No ALFIE_TOKEN set — Alfie will not start.", "alfie");
    return;
  }

  if (client) {
    try { client.destroy(); } catch { /* ignore */ }
    client = null;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  client.once("ready", async (readyClient) => {
    log(`[Alfie] Logged in as ${readyClient.user.tag}`, "alfie");
    botState = {
      online: true,
      tag: readyClient.user.tag,
      avatarUrl: readyClient.user.displayAvatarURL(),
      guildCount: readyClient.guilds.cache.size,
      uptimeStart: Date.now(),
      status: "online",
      lastError: null,
    };

    readyClient.user.setPresence({
      activities: [{ name: "music 🎵", type: ActivityType.Listening }],
      status: "online",
    });

    setRaveClient(readyClient);
    initMusic(readyClient);

    setNowPlayingCallback((guildId, track, queue) => {
      const session = djSessions.get(guildId);
      if (session) {
        onDjTrackStart(guildId, track, queue.volume, queue.player);
        const q = getQueue(guildId);
        if (q && q.tracks.length < 3) {
          void refillDjQueue(guildId, session);
        }
      }

      const hist = trackHistory.get(guildId) ?? [];
      hist.unshift({ title: track.title, author: track.author, duration: track.duration, uri: track.uri, requestedBy: track.requestedBy, playedAt: Date.now() });
      if (hist.length > HISTORY_LIMIT) hist.pop();
      trackHistory.set(guildId, hist);

      const ch = readyClient.channels.cache.get(queue.textChannelId) as TextChannel | null;
      if (!ch) return;

      void (async () => {
        try {
          const embed = buildNowPlayingEmbedFast(track, queue);
          const sent = await ch.send({
            embeds: [embed],
            components: [buildMusicButtons(false)],
            allowedMentions: { parse: [] },
          });
          void buildNowPlayingEmbed(track, queue).then((richEmbed) => {
            sent.edit({ embeds: [richEmbed], components: [buildMusicButtons(false)], allowedMentions: { parse: [] } }).catch(() => {});
          });
          scheduleNowPlayingProgressUpdates(sent, guildId, track);
        } catch (err: any) {
          log(`[Alfie] Failed to post now-playing: ${err.message}`, "alfie");
        }
      })();
    });

    setTextNotifyCallback((guildId, textChannelId, message) => {
      const ch = readyClient.channels.cache.get(textChannelId) as TextChannel | null;
      ch?.send({ content: message, allowedMentions: { parse: [] } }).catch(() => {});
    });

    // Register slash commands per guild
    const rest = new REST({ version: "10" }).setToken(rawToken);
    const commandData = SLASH_COMMANDS.map((c) => c.toJSON());
    for (const guild of readyClient.guilds.cache.values()) {
      try {
        await rest.put(Routes.applicationGuildCommands(readyClient.user.id, guild.id), { body: commandData });
        log(`[Alfie] Slash commands registered in ${guild.name}`, "alfie");
      } catch (err: any) {
        log(`[Alfie] Failed to register commands in ${guild.name}: ${err.message}`, "alfie");
      }
    }
  });

  // ── Autocomplete ────────────────────────────────────────────────────────────
  client.on("interactionCreate", async (interaction) => {
    if (interaction.isAutocomplete()) {
      const focused = interaction.options.getFocused();
      if (!focused || focused.length < 2) { await interaction.respond([]); return; }
      try {
        const results = await searchTracks(focused, 8);
        await interaction.respond(
          results.map((t) => ({
            name: truncateDiscordText(`${t.title} — ${t.author}`, 100),
            value: t.uri,
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

      const musicActions = ["music_pause", "music_skip", "music_stop", "music_like", "music_back"];
      if (!musicActions.includes(customId)) return;

      const action = customId.replace("music_", "");
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
        } else {
          await pauseMusic(guildId);
        }
        const qAfter = getQueue(guildId);
        if (!qAfter?.current) return;
        await interaction.message.edit({
          embeds: [await buildNowPlayingEmbed(qAfter.current, qAfter)],
          components: [buildMusicButtons(qAfter.player.paused)],
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
        content: [`**alfie status~ ♡**`, `online: yes~!`, `uptime: ${uptimeStr}`, `servers: ${botState.guildCount}`].join("\n"),
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (commandName === "help") {
      await interaction.reply({
        content: [
          "**alfie — music commands~ ♡**",
          "",
          "**playback**",
          "`/play <query>` — play a song or playlist",
          "`/playtop <query>` — queue at the front",
          "`/skip` — skip current track (vote-skip with 3+ listeners)",
          "`/stop` — stop and disconnect",
          "`/pause` / `/resume` — pause or resume",
          "`/seek <time>` — seek to position, e.g. `1:30`",
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
          "`/autoplay` — toggle autoplay",
          "",
          "**extras~**",
          "`/lyrics [song]` — fetch lyrics",
          "`/savequeue <name>` — save the queue as a playlist",
          "`/playlist list/load/delete` — manage playlists",
          "`/rave <genre> [minutes]` — infinite genre rave with DJ mode",
          "`/ravestop` — end the rave",
          "`/speak <text>` — TTS in voice channel",
        ].join("\n"),
        allowedMentions: { parse: [] },
      });
      return;
    }

    // All music commands require a guild
    if (!guildId) { await replyEph("music only works in servers~ sorry ♡"); return; }

    if (commandName === "play") {
      const query = interaction.options.getString("query", true);
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel) { await replyEph("join a voice channel first~ ehehe"); return; }
      await interaction.deferReply();
      try {
        const isUrl = /^https?:\/\//i.test(query);
        if (isUrl) {
          const { tracks, playlistName } = await resolvePlaylist(query, interaction.user.username);
          if (!tracks.length) { await interaction.editReply({ content: "couldn't find anything there~ try a different link?", allowedMentions: { parse: [] } }); return; }
          if (tracks.length === 1) {
            const result = await joinAndPlay(guildId, voiceChannel.id, interaction.channelId, tracks[0], interaction.guild?.shardId ?? 0);
            if (result === "playing") {
              const q = getQueue(guildId)!;
              const sent = await interaction.editReply({ embeds: [await buildNowPlayingEmbed(tracks[0], q)], components: [buildMusicButtons(false)], allowedMentions: { parse: [] } });
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
          const track = await resolveTrack(query, interaction.user.username);
          if (!track) { await interaction.editReply({ content: "couldn't find that~ try something else?", allowedMentions: { parse: [] } }); return; }
          const result = await joinAndPlay(guildId, voiceChannel.id, interaction.channelId, track, interaction.guild?.shardId ?? 0);
          if (result === "playing") {
            const q = getQueue(guildId)!;
            const sent = await interaction.editReply({ embeds: [await buildNowPlayingEmbed(track, q)], components: [buildMusicButtons(false)], allowedMentions: { parse: [] } });
            scheduleNowPlayingProgressUpdates(sent, guildId, track);
          } else {
            const dur = track.isStream ? "LIVE" : formatDuration(track.duration);
            await interaction.editReply({ content: `added **${track.title}** by ${track.author} [${dur}] to the queue~! ♡`, allowedMentions: { parse: [] } });
          }
        }
      } catch (err: any) {
        log(`[Alfie/slash:play] ${err.message}`, "alfie");
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
          const sent = await interaction.editReply({ embeds: [await buildNowPlayingEmbed(track, q)], components: [buildMusicButtons(false)], allowedMentions: { parse: [] } });
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
        const stopped = await stopMusic(guildId);
        await interaction.reply({ content: stopped ? "stopped~! see you soon ♡" : "i wasn't even playing anything~ ehehe", allowedMentions: { parse: [] } });
      } catch (err: any) {
        await replyEph(`stop went oopsie~ ${err.message}`);
      }
      return;
    }

    if (commandName === "disconnect") {
      try {
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

    if (commandName === "pause") {
      try {
        const paused = await pauseMusic(guildId);
        await interaction.reply({ content: paused ? "paused~! ♡" : "nothing to pause~ hehe", allowedMentions: { parse: [] } });
      } catch (err: any) { await replyEph(`pause went oopsie~ ${err.message}`); }
      return;
    }

    if (commandName === "resume") {
      try {
        const resumed = await resumeMusic(guildId);
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
      const sent = await interaction.editReply({ embeds: [await buildNowPlayingEmbed(q.current, q)], components: [buildMusicButtons(q.player.paused)], allowedMentions: { parse: [] } });
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
      const text = interaction.options.getString("text", true).trim();
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel) { await replyEph("join a voice channel first~ ehehe"); return; }
      await interaction.deferReply();
      try {
        const result = await speakInVoice(guildId, text, voiceChannel.id, interaction.channelId, interaction.guild?.shardId ?? 0, interaction.user.username);
        if (result.ok) {
          await interaction.editReply({ content: `🔊 speaking~: *"${text.slice(0, 100)}${text.length > 100 ? "…" : ""}"* ♡`, allowedMentions: { parse: [] } });
        } else {
          await interaction.editReply({ content: `oopsie, couldn't speak~ ${result.reason ?? "unknown error"}`, allowedMentions: { parse: [] } });
        }
      } catch (err: any) {
        await interaction.editReply({ content: `tts went oopsie~ ${err.message}`, allowedMentions: { parse: [] } });
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
        if (autoPausedGuilds.has(guildId)) {
          autoPausedGuilds.delete(guildId);
          await resumeMusic(guildId);
          const ch = client?.channels.cache.get(queue.textChannelId) as TextChannel | null;
          ch?.send({ content: "yay, someone's back~! resuming ♡", allowedMentions: { parse: [] } }).catch(() => {});
        }
      }
      return;
    }

    if (leftChannelId === queue.voiceChannelId) {
      const guild = oldState.guild;
      const channel = guild.channels.cache.get(leftChannelId);
      if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) return;
      const humanCount = channel.members.filter((m) => !m.user.bot).size;
      if (humanCount > 0) return;

      if (queue.current && !queue.player.paused) {
        await pauseMusic(guildId);
        autoPausedGuilds.add(guildId);
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

  client.on("guildCreate", (guild) => {
    botState.guildCount = client?.guilds.cache.size ?? botState.guildCount;
    const rest = new REST({ version: "10" }).setToken(rawToken);
    rest.put(Routes.applicationGuildCommands(client!.user!.id, guild.id), { body: SLASH_COMMANDS.map((c) => c.toJSON()) })
      .catch((e: any) => log(`[Alfie] Failed to register commands in new guild ${guild.name}: ${e.message}`, "alfie"));
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
    log(`[Alfie] Discord client error: ${err.message}`, "alfie");
    botState.lastError = err.message;
  });

  try {
    log("[Alfie] Attempting Discord login…", "alfie");
    await client.login(rawToken);
  } catch (err: any) {
    const msg: string = err.message ?? String(err);
    let friendlyError = msg;
    if (/invalid token/i.test(msg)) friendlyError = "Invalid ALFIE_TOKEN — check the value in your secrets.";
    else if (/disallowed intents/i.test(msg)) friendlyError = "Intents blocked — enable Message Content Intent in Discord Developer Portal.";

    log(`[Alfie] Login failed: ${friendlyError}`, "alfie");
    botState.lastError = friendlyError;
    botState.online = false;
    botState.status = "error";

    loginRetryTimer = setTimeout(() => startAlfie(), 30_000);
    loginRetryTimer.unref?.();
  }
}

export function getAlfieGuilds(): Array<{ id: string; name: string }> {
  if (!client) return [];
  return [...client.guilds.cache.values()].map((g) => ({ id: g.id, name: g.name }));
}

export function stopAlfie(): void {
  if (loginRetryTimer) { clearTimeout(loginRetryTimer); loginRetryTimer = null; }
  for (const t of backgroundTimers) { clearInterval(t); clearTimeout(t); }
  backgroundTimers.clear();
  for (const t of nowPlayingUpdateTimers.values()) clearTimeout(t);
  nowPlayingUpdateTimers.clear();
  if (client) { try { client.destroy(); } catch { /* ignore */ } client = null; }
  botState = { online: false, tag: null, avatarUrl: null, guildCount: 0, uptimeStart: null, status: "offline", lastError: null };
}
