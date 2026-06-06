import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  StreamType,
  NoSubscriberBehavior,
  type VoiceConnection,
  type AudioPlayer,
} from "@discordjs/voice";
import { Readable } from "stream";
import { log } from "./index";

const MAX_CHARS = 450;
const MAX_GOOGLE_CHARS = 190;

let discordClient: any = null;
export function setTTSClient(client: any): void {
  discordClient = client;
}

export function cleanTTSText(text: string): string {
  return text
    .replace(/<@!?\d+>/g, "")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CHARS);
}

// ── TTS Audio Providers ───────────────────────────────────────────────────────

async function fetchStreamElements(text: string): Promise<Buffer> {
  const url = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text.slice(0, MAX_CHARS))}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AlessaBot/1.0)" },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) throw new Error(`StreamElements HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 512) throw new Error("StreamElements returned empty audio");
  return buf;
}

async function fetchGoogleTTS(text: string): Promise<Buffer> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, MAX_GOOGLE_CHARS))}&tl=en&client=tw-ob&ttsspeed=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AlessaBot/1.0)" },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 512) throw new Error("Google TTS returned empty audio");
  return buf;
}

async function fetchResponsiveVoice(text: string): Promise<Buffer> {
  // ResponsiveVoice public demo key — different provider/CDN than StreamElements/Google
  const url = `https://texttospeech.responsivevoice.org/v1/text:synthesize?text=${encodeURIComponent(text.slice(0, MAX_CHARS))}&lang=en-GB&engine=g1&name=&pitch=0.5&rate=0.5&volume=1&key=kvfbSITh&gender=male`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AlessaBot/1.0)" },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) throw new Error(`ResponsiveVoice HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 512) throw new Error("ResponsiveVoice returned empty audio");
  return buf;
}

export async function fetchTTSAudio(text: string): Promise<Buffer> {
  const results = await Promise.allSettled([
    fetchStreamElements(text),
    fetchGoogleTTS(text),
    fetchResponsiveVoice(text),
  ]);

  for (const r of results) {
    if (r.status === "fulfilled") return r.value;
  }

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => r.reason?.message ?? String(r.reason));
  throw new Error(`All TTS providers failed: ${errors.join(" | ")}`);
}

// ── Per-guild voice state ─────────────────────────────────────────────────────

interface GuildTTSState {
  connection: VoiceConnection;
  player: AudioPlayer;
  queue: Buffer[];
  playing: boolean;
  voiceChannelId: string;
}

const guildStates = new Map<string, GuildTTSState>();

function drainQueue(guildId: string): void {
  const state = guildStates.get(guildId);
  if (!state || state.playing) return;
  const next = state.queue.shift();
  if (!next) return;

  state.playing = true;
  const stream = Readable.from(next);
  const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
  state.player.play(resource);
}

function getOrCreateState(guildId: string, voiceChannelId: string): GuildTTSState {
  let state = guildStates.get(guildId);

  // If connection exists but for a different channel, destroy and reconnect
  if (state && state.voiceChannelId !== voiceChannelId) {
    try { state.connection.destroy(); } catch { /* ignore */ }
    guildStates.delete(guildId);
    state = undefined;
  }

  if (state) return state;

  const guild = discordClient?.guilds.cache.get(guildId);
  if (!guild) throw new Error("guild not in cache");

  const connection = joinVoiceChannel({
    channelId: voiceChannelId,
    guildId,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
  });

  connection.subscribe(player);

  player.on(AudioPlayerStatus.Idle, () => {
    const s = guildStates.get(guildId);
    if (!s) return;
    s.playing = false;
    drainQueue(guildId);
  });

  player.on("error", (err) => {
    log(`[TTS] Player error in guild ${guildId}: ${err.message}`, "discord");
    const s = guildStates.get(guildId);
    if (s) { s.playing = false; drainQueue(guildId); }
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      // Attempt auto-reconnect for transient drops
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      connection.destroy();
      guildStates.delete(guildId);
    }
  });

  const newState: GuildTTSState = {
    connection,
    player,
    queue: [],
    playing: false,
    voiceChannelId,
  };
  guildStates.set(guildId, newState);
  return newState;
}

export function disconnectTTS(guildId: string): void {
  const state = guildStates.get(guildId);
  if (state) {
    try { state.player.stop(true); } catch { /* ignore */ }
    try { state.connection.destroy(); } catch { /* ignore */ }
    guildStates.delete(guildId);
  }
  // Belt-and-suspenders: also clean up any @discordjs/voice connection
  try { getVoiceConnection(guildId)?.destroy(); } catch { /* ignore */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function speakInVoice(
  guildId: string,
  text: string,
  voiceChannelId: string,
  textChannelId: string,
  shardId: number,
  requestedBy = "tts",
): Promise<{ ok: boolean; reason?: string }> {
  if (!discordClient) return { ok: false, reason: "TTS not initialized" };
  if (!text.trim()) return { ok: false, reason: "empty text" };

  const cleaned = cleanTTSText(text);
  if (!cleaned) return { ok: false, reason: "empty text after cleaning" };

  let audioBuffer: Buffer;
  try {
    audioBuffer = await fetchTTSAudio(cleaned);
  } catch (err: any) {
    log(`[TTS] All providers failed for guild ${guildId}: ${err.message}`, "discord");
    return { ok: false, reason: "all TTS services are unavailable right now~" };
  }

  try {
    const state = getOrCreateState(guildId, voiceChannelId);

    // Ensure the connection is ready before queueing (with timeout)
    if (state.connection.state.status !== VoiceConnectionStatus.Ready) {
      await entersState(state.connection, VoiceConnectionStatus.Ready, 10_000);
    }

    state.queue.push(audioBuffer);
    drainQueue(guildId);

    log(`[TTS] Queued TTS (${cleaned.length} chars) for guild ${guildId} via ${requestedBy}.`, "discord");
    return { ok: true };
  } catch (err: any) {
    log(`[TTS] Voice join/play failed for guild ${guildId}: ${err.message}`, "discord");
    return { ok: false, reason: err.message };
  }
}
