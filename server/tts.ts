import { log } from "./index";
import { resolveTrack, addToFront, type QueueTrack } from "./music";

const MAX_TTS_CHARS = 450;
const MAX_GOOGLE_CHARS = 200; // Google unofficial TTS caps around 200 chars

function cleanTTSText(text: string): string {
  return text
    .replace(/<@!?\d+>/g, "")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TTS_CHARS);
}

export async function resolveTTSTrack(text: string, requestedBy = "tts"): Promise<QueueTrack | null> {
  const cleaned = cleanTTSText(text);
  if (!cleaned) return null;

  // Fire Google and StreamElements in parallel — use whichever resolves first.
  // Google's unofficial TTS hits their CDN (very fast, no auth).
  // StreamElements (Brian voice) handles longer text and is a solid fallback.
  const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleaned.slice(0, MAX_GOOGLE_CHARS))}&tl=en&client=tw-ob&ttsspeed=1`;
  const seUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(cleaned)}`;

  const attempt = (url: string) =>
    resolveTrack(url, requestedBy).then((t) => {
      if (!t) throw new Error("no track");
      return t;
    });

  try {
    const track = await Promise.any([attempt(googleUrl), attempt(seUrl)]);
    track.title = `[TTS] ${text.slice(0, 80)}`;
    track.author = "Alessa TTS";
    return track;
  } catch {
    log(`[TTS] Both Google and StreamElements failed for guild TTS.`, "discord");
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
    return { ok: false, reason: "couldn't speak~ TTS is unavailable right now" };
  }

  try {
    await addToFront(guildId, voiceChannelId, textChannelId, track, shardId);
    log(`[TTS] Queued TTS for guild ${guildId}.`, "discord");
    return { ok: true };
  } catch (err: any) {
    log(`[TTS] Failed to play TTS in guild ${guildId}: ${err.message}`, "discord");
    return { ok: false, reason: err.message };
  }
}
