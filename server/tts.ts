import { log } from "./index";
import { resolveTrack, addToFront, type QueueTrack } from "./music";

const MAX_TTS_CHARS = 450;

function buildTTSUrl(text: string): string {
  const cleaned = text
    .replace(/<@!?\d+>/g, "")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TTS_CHARS);

  const base = (
    process.env.RENDER_EXTERNAL_URL ??
    process.env.PUBLIC_BASE_URL ??
    `http://localhost:${process.env.PORT ?? 5000}`
  ).replace(/\/$/, "");

  return `${base}/tts-audio?text=${encodeURIComponent(cleaned)}`;
}

export async function resolveTTSTrack(text: string, requestedBy = "tts"): Promise<QueueTrack | null> {
  try {
    const url = buildTTSUrl(text);
    const track = await resolveTrack(url, requestedBy);
    if (track) {
      track.title = `[TTS] ${text.slice(0, 80)}`;
      track.author = "Alfie TTS";
    }
    return track;
  } catch (err: any) {
    log(`[TTS] Failed to resolve TTS track: ${err.message}`, "discord");
    return null;
  }
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
      reason: "couldn't resolve TTS audio — StreamElements may be unavailable or Lavalink doesn't support HTTP sources",
    };
  }

  try {
    // addToFront handles both cases: joins voice if not already in, or inserts at front of existing queue
    await addToFront(guildId, voiceChannelId, textChannelId, track, shardId);
    log(`[TTS] Queued/playing TTS for guild ${guildId}.`, "discord");
    return { ok: true };
  } catch (err: any) {
    log(`[TTS] Failed to play TTS in guild ${guildId}: ${err.message}`, "discord");
    return { ok: false, reason: err.message };
  }
}
