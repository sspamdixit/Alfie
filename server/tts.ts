import { log } from "./index";
import { resolveTrack, addToFront, type QueueTrack } from "./music";

const MAX_TTS_CHARS = 450;

function cleanTTSText(text: string): string {
  return text
    .replace(/<@!?\d+>/g, "")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TTS_CHARS);
}

function buildStreamElementsUrl(cleaned: string): string {
  return `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(cleaned)}`;
}

function buildProxyUrl(cleaned: string): string {
  const base = (
    process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.RENDER_EXTERNAL_URL ??
        process.env.PUBLIC_BASE_URL ??
        `http://localhost:${process.env.PORT ?? 5000}`
  ).replace(/\/$/, "");
  return `${base}/tts-audio?text=${encodeURIComponent(cleaned)}`;
}

export async function resolveTTSTrack(text: string, requestedBy = "tts"): Promise<QueueTrack | null> {
  const cleaned = cleanTTSText(text);
  if (!cleaned) return null;

  // Try 1: Direct StreamElements URL — Lavalink fetches HTTPS audio server-side,
  // no proxy hop needed. Works on the local node and avoids our server being
  // reachable from the Lavalink server's network.
  try {
    const track = await resolveTrack(buildStreamElementsUrl(cleaned), requestedBy);
    if (track) {
      track.title = `[TTS] ${text.slice(0, 80)}`;
      track.author = "Alfie TTS";
      log(`[TTS] Resolved via direct StreamElements URL.`, "discord");
      return track;
    }
  } catch (err: any) {
    log(`[TTS] Direct StreamElements resolve failed: ${err.message}`, "discord");
  }

  // Try 2: Proxy URL on our own server — some Lavalink nodes (especially public
  // ones) reject direct StreamElements requests. Our proxy buffers the audio and
  // serves it back with clean headers so Lavalink can load it as a track.
  try {
    const track = await resolveTrack(buildProxyUrl(cleaned), requestedBy);
    if (track) {
      track.title = `[TTS] ${text.slice(0, 80)}`;
      track.author = "Alfie TTS";
      log(`[TTS] Resolved via proxy URL.`, "discord");
      return track;
    }
  } catch (err: any) {
    log(`[TTS] Proxy URL resolve also failed: ${err.message}`, "discord");
  }

  return null;
}

export async function speakInVoice(
  guildId: string,
  text: string,
  voiceChannelId: string,
  textChannelId: string,
  shardId: number,
  requestedBy = "tts",
): Promise<{ ok: boolean; reason?: string }> {
  if (!text.trim()) return { ok: false, reason: "empty text" };

  const track = await resolveTTSTrack(text, requestedBy);
  if (!track) {
    return {
      ok: false,
      reason: "couldn't speak~ StreamElements may be rate-limited or unavailable right now",
    };
  }

  try {
    await addToFront(guildId, voiceChannelId, textChannelId, track, shardId);
    log(`[TTS] Queued/playing TTS for guild ${guildId}.`, "discord");
    return { ok: true };
  } catch (err: any) {
    log(`[TTS] Failed to play TTS in guild ${guildId}: ${err.message}`, "discord");
    return { ok: false, reason: err.message };
  }
}
