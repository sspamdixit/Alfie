import { Client } from "discord.js";
import { Shoukaku, Connectors } from "shoukaku";
import type { Player } from "shoukaku";
import { log } from "./index";

interface LavalinkNodeConfig {
  name: string;
  url: string;
  auth: string;
  secure: boolean;
}

// Name used when registering a user-configured local node (via LAVALINK_URL env var).
// The qualityNodeResolver treats local and public nodes equally — this name is only
// used to identify the local node in logs and for building the node list.
const LOCAL_NODE_NAME = "local";


// Tracks when a node last closed abnormally. The resolver uses this to
// deprioritize recently-closed nodes for a cooldown period so we don't
// immediately re-land on the same flaky node after it reconnects.
const recentlyClosedNodes = new Map<string, number>(); // nodeName → timestamp
const NODE_CLOSE_COOLDOWN_MS = 20_000; // ignore a node for 20s after abnormal close

// Pure quality-based node resolver. Every node — including any configured local
// node — competes equally on Shoukaku's penalty score (which reflects CPU load,
// memory pressure, and active player count). Nodes that closed abnormally within
// the cooldown window receive a large penalty so they are selected last, giving
// them time to stabilise before handling new connections.
//
// No node receives automatic priority: if a local node is under heavy load,
// a lightly-loaded public node is correctly preferred over it.
function qualityNodeResolver(nodes: Map<string, any>, _connection?: any): any | undefined {
  if (!nodes.size) return undefined;
  const now = Date.now();
  const nodeArray = [...nodes.values()];
  const withStats = nodeArray.filter(n => n.stats);
  const pool = withStats.length ? withStats : nodeArray;
  return [...pool].sort((a, b) => {
    const aCool = (recentlyClosedNodes.get(a.name) ?? 0) + NODE_CLOSE_COOLDOWN_MS > now ? 1_000 : 0;
    const bCool = (recentlyClosedNodes.get(b.name) ?? 0) + NODE_CLOSE_COOLDOWN_MS > now ? 1_000 : 0;
    return (Number(a.penalties ?? 0) + aCool) - (Number(b.penalties ?? 0) + bCool);
  })[0];
}

// Returns all connected nodes sorted by the same quality metric used by the
// resolver. Functions that walk multiple nodes (resolveSearchAnyNode, etc.)
// use this so they probe the best node first, matching the resolver's choice.
function getNodesByQuality(): any[] {
  if (!shoukaku) return [];
  const now = Date.now();
  const all = [...(shoukaku.nodes as Map<string, any>).values()];
  const withStats = all.filter(n => n.stats);
  const pool = withStats.length ? withStats : all;
  return [...pool].sort((a, b) => {
    const aCool = (recentlyClosedNodes.get(a.name) ?? 0) + NODE_CLOSE_COOLDOWN_MS > now ? 1_000 : 0;
    const bCool = (recentlyClosedNodes.get(b.name) ?? 0) + NODE_CLOSE_COOLDOWN_MS > now ? 1_000 : 0;
    return (Number(a.penalties ?? 0) + aCool) - (Number(b.penalties ?? 0) + bCool);
  });
}

function parseBoolean(value: string | undefined): boolean {
  return /^(1|true|yes)$/i.test(value ?? "");
}

function normalizeLavalinkNode(raw: any, fallbackName: string): LavalinkNodeConfig | null {
  const name = String(raw?.name || fallbackName).trim();
  let url = String(raw?.url || raw?.host || "").trim();
  const auth = String(raw?.auth || raw?.password || "").trim();
  const secure = typeof raw?.secure === "boolean" ? raw.secure : parseBoolean(String(raw?.secure ?? ""));

  if (!name || !url || !auth) return null;

  // If no port is specified in the URL, default to 443 for secure connections
  // and 2333 (standard Lavalink port) for non-secure. Without this, Shoukaku
  // connects to port 2333 over ws:// even when secure=true, causing a 301 redirect.
  if (!url.includes(":")) {
    url = `${url}:${secure ? 443 : 2333}`;
  }

  return { name, url, auth, secure };
}

// ── Hardcoded public community Lavalink node pool ────────────────────────────
// Sourced from: lavalink.darrennathanael.com · free.lavalink.rf.gd ·
//   github.com/AjieDev/Free-Lavalink · heavencloud.in · github.com/alfari24/lavalink-lists
// These are used automatically when LAVALINK_NODES env var is not set.
// Override with LAVALINK_NODES (JSON array) to use your own list instead.
const PUBLIC_NODE_POOL: LavalinkNodeConfig[] = [
  // ── Serenetia (AjieDev) — SSL, v4 ──────────────────────────────────────────
  { name: "serenetia-v4-ssl",    url: "lavalinkv4.serenetia.com:443",      auth: "https://dsc.gg/ajidevserver", secure: true  },
  { name: "serenetia-ssl",       url: "lavalink.serenetia.com:443",        auth: "https://dsc.gg/ajidevserver", secure: true  },
  // ── HeavenCloud — SSL, multi-region, 30+ sources ───────────────────────────
  { name: "heavencloud-in",      url: "lavalink.heavencloud.in:443",       auth: "heavencloud",                 secure: true  },
  { name: "heavencloud-us",      url: "us.lavalink.heavencloud.in:443",    auth: "heavencloud",                 secure: true  },
  { name: "heavencloud-sg",      url: "sg.lavalink.heavencloud.in:443",    auth: "heavencloud",                 secure: true  },
  { name: "heavencloud-eu",      url: "eu.lavalink.heavencloud.in:443",    auth: "heavencloud",                 secure: true  },
  // ── Jirayu — SSL, v4 ───────────────────────────────────────────────────────
  { name: "jirayu-ssl",          url: "lavalink.jirayu.net:443",           auth: "youshallnotpass",             secure: true  },
  // ── NextGenCoders — SSL, v4, many plugins ──────────────────────────────────
  { name: "nextgencoders-ssl",   url: "lavalink.nextgencoders.xyz:443",    auth: "nextgencoderspvt",            secure: true  },
  // ── Millohost — SSL, v4 ────────────────────────────────────────────────────
  { name: "millohost-ssl",       url: "lava-v4.millohost.my.id:443",       auth: "https://discord.gg/mjS5J2K3ep", secure: true },
  // ── Serenetia — non-SSL, v4 (fallback) ─────────────────────────────────────
  { name: "serenetia-v4-nossl",  url: "lavalinkv4.serenetia.com:80",       auth: "https://dsc.gg/ajidevserver", secure: false },
  // ── HeavenCloud — non-SSL ──────────────────────────────────────────────────
  { name: "heavencloud-nossl",   url: "lavalink.heavencloud.in:2333",      auth: "heavencloud",                 secure: false },
  // ── Jirayu — non-SSL ───────────────────────────────────────────────────────
  { name: "jirayu-nossl",        url: "lavalink.jirayu.net:13592",         auth: "youshallnotpass",             secure: false },
  // ── Triniumhost — non-SSL, v4 ──────────────────────────────────────────────
  { name: "triniumhost",         url: "lavalink.triniumhost.com:4333",     auth: "free",                        secure: false },
  // ── G3V (UK) — non-SSL ─────────────────────────────────────────────────────
  { name: "g3v-uk",              url: "lava.g3v.co.uk:9008",               auth: "lavalinklol",                 secure: false },
];

function getLavalinkNodes(): LavalinkNodeConfig[] {
  // ── LAVALINK_NODES JSON override ─────────────────────────────────────────
  // If set, these replace the built-in public pool entirely.
  const rawNodes = process.env.LAVALINK_NODES?.trim();
  if (rawNodes) {
    try {
      const parsed = JSON.parse(rawNodes);
      const nodeList = Array.isArray(parsed) ? parsed : [parsed];
      const nodes = nodeList
        .map((node, index) => normalizeLavalinkNode(node, `node-${index + 1}`))
        .filter((node): node is LavalinkNodeConfig => Boolean(node));
      if (nodes.length) {
        log(`[Music] Using ${nodes.length} node(s) from LAVALINK_NODES override: ${nodes.map(n => n.name).join(", ")}`, "discord");
        return nodes;
      }
      log("[Music] LAVALINK_NODES was set but contained no valid nodes — falling back to public pool.", "discord");
    } catch (err: any) {
      log(`[Music] Could not parse LAVALINK_NODES JSON: ${err.message} — falling back to public pool.`, "discord");
    }
  }

  // ── Default: built-in public community node pool ─────────────────────────
  log(`[Music] Using ${PUBLIC_NODE_POOL.length} built-in public community nodes. Set LAVALINK_NODES to override.`, "discord");
  return [...PUBLIC_NODE_POOL];
}

export interface QueueTrack {
  encoded: string;
  title: string;
  author: string;
  uri: string;
  duration: number;
  isStream: boolean;
  requestedBy: string;
  artworkUrl: string | null;
}

export type LoopMode = "none" | "track" | "queue";

export interface GuildQueue {
  player: Player;
  tracks: QueueTrack[];
  current: QueueTrack | null;
  volume: number;
  loop: LoopMode;
  voiceChannelId: string;
  textChannelId: string;
  resumePositionMs?: number;
  // Autoplay state
  autoplay: boolean;
  recentSeeds: QueueTrack[];          // last few user-queued tracks (for seeding similar songs)
  recentlyPlayedUris: string[];       // URIs already played to avoid immediate repeats
  isFetchingAutoplay: boolean;        // guard against concurrent autoplay fetches
  // Stability flags
  isAdvancing: boolean;   // true while advanceQueue is running — blocks joinAndPlay from interrupting
  isStopped: boolean;     // true after stopMusic/disconnect — prevents end-event from re-queuing
  // Recovery state — used to retry the current track after a lag/stuck event before skipping.
  recoveryAttempts: number;            // number of consecutive recovery attempts on the *current* track
  recoveryWindowStartedAt: number;     // timestamp when the current recovery streak started
  isRecovering: boolean;               // true while a recovery attempt is in flight
  lastTrackStartedAt: number;          // timestamp the current track actually started playing
  // Node-health watchdog state — used to auto-migrate to a healthier node when
  // the current one is degraded (high penalties / dropped frames) for too long.
  nodeUnhealthySince: number;          // timestamp the current node first looked unhealthy, or 0
  lastAutoMigrateAt: number;           // timestamp of the last auto-migration, for cooldown
  isAutoMigrating: boolean;            // guard so watchdog doesn't fire concurrently
}

// ── Audio filter presets ──────────────────────────────────────────────────────
export type FilterPreset = "bassboost" | "nightcore" | "vaporwave" | "8d" | "karaoke" | "off";
const guildFilters = new Map<string, FilterPreset>();

async function applyFilterPreset(player: Player, preset: FilterPreset, guildId: string): Promise<void> {
  try {
    await player.clearFilters();
    switch (preset) {
      case "bassboost":
        await player.setEqualizer([
          { band: 0, gain: 0.65 }, { band: 1, gain: 0.67 }, { band: 2, gain: 0.52 },
          { band: 3, gain: 0.32 }, { band: 4, gain: 0.18 }, { band: 5, gain: 0.0 },
          { band: 6, gain: -0.05 }, { band: 7, gain: -0.05 }, { band: 8, gain: -0.05 },
          { band: 9, gain: -0.05 }, { band: 10, gain: -0.05 }, { band: 11, gain: -0.05 },
          { band: 12, gain: -0.05 }, { band: 13, gain: -0.05 }, { band: 14, gain: -0.05 },
        ]);
        break;
      case "nightcore":
        await player.setTimescale({ speed: 1.17, pitch: 1.22, rate: 1.0 });
        break;
      case "vaporwave":
        await player.setTimescale({ speed: 0.85, pitch: 0.85, rate: 1.0 });
        break;
      case "8d":
        await player.setRotation({ rotationHz: 0.2 });
        break;
      case "karaoke":
        await player.setKaraoke({ level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 });
        break;
    }
  } catch (err: any) {
    log(`[Music] Failed to apply filter "${preset}" in guild ${guildId}: ${err.message}`, "discord");
  }
}

export function getGuildFilter(guildId: string): FilterPreset {
  return guildFilters.get(guildId) ?? "off";
}

export async function setGuildFilter(guildId: string, preset: FilterPreset): Promise<void> {
  const q = queues.get(guildId);
  if (preset === "off") {
    guildFilters.delete(guildId);
  } else {
    guildFilters.set(guildId, preset);
  }
  if (!q) return;
  if (preset === "off") {
    try { await q.player.clearFilters(); } catch { /* ignore */ }
  } else {
    await applyFilterPreset(q.player, preset, guildId);
  }
}

// Recovery tuning — try this many times within the window before giving up and skipping.
const MAX_RECOVERY_ATTEMPTS = 5;
const RECOVERY_WINDOW_MS = 90_000;

// Node-health watchdog tuning.
const NODE_HEALTH_CHECK_INTERVAL_MS = 15_000;        // how often to poll node health
const NODE_UNHEALTHY_DURATION_MS = 30_000;           // node must be bad for this long before migrating
const NODE_AUTO_MIGRATE_COOLDOWN_MS = 120_000;       // don't auto-migrate the same guild more often than this
const NODE_PENALTY_BAD_THRESHOLD = 75;               // Shoukaku penalty score considered "degraded"
const NODE_PENALTY_IMPROVEMENT_THRESHOLD = 30;       // require alternative to be at least this much better
const NODE_FRAME_DEFICIT_THRESHOLD = 100;            // dropped+nulled opus frames per stats window

let shoukaku: Shoukaku | null = null;
let _musicClient: Client | null = null; // retained for pool-guardian re-init
let _poolGuardianTimer: ReturnType<typeof setInterval> | null = null;
const queues = new Map<string, GuildQueue>();
const joiningGuilds = new Set<string>();

// Debounce map: prevents duplicate advanceQueue calls within a short window
const advanceDebounce = new Map<string, number>();

// ── Frozen queue preservation ─────────────────────────────────────────────────
// When ALL recovery attempts after a node outage fail, the queue is saved here.
// Automatically restored the next time /play is called in the same guild.
// TTL: 30 minutes — after that the data is stale and discarded.
interface FrozenQueueSnapshot {
  tracks: QueueTrack[];            // current track (if any) prepended at [0]
  textChannelId: string;
  voiceChannelId: string;
  volume: number;
  loop: LoopMode;
  autoplay: boolean;
  recentSeeds: QueueTrack[];
  recentlyPlayedUris: string[];
  frozenAt: number;
}
const frozenQueues = new Map<string, FrozenQueueSnapshot>();
const FROZEN_QUEUE_TTL_MS = 30 * 60 * 1000;

// One-shot pop: returns and removes the snapshot (or null if expired/missing).
function popFrozenQueue(guildId: string): FrozenQueueSnapshot | null {
  const entry = frozenQueues.get(guildId);
  if (!entry) return null;
  frozenQueues.delete(guildId);
  if (Date.now() - entry.frozenAt > FROZEN_QUEUE_TTL_MS) return null;
  return entry;
}

type NowPlayingCallbackFn = (guildId: string, track: QueueTrack, queue: GuildQueue) => void;
type TextNotifyFn = (guildId: string, textChannelId: string, message: string) => void;
type QueueStopCallbackFn = (guildId: string) => void;

let nowPlayingCallback: NowPlayingCallbackFn | null = null;
let textNotifyCallback: TextNotifyFn | null = null;
let queueStopCallback: QueueStopCallbackFn | null = null;

export function setNowPlayingCallback(cb: NowPlayingCallbackFn): void {
  nowPlayingCallback = cb;
}

export function setTextNotifyCallback(cb: TextNotifyFn): void {
  textNotifyCallback = cb;
}

export function setQueueStopCallback(cb: QueueStopCallbackFn): void {
  queueStopCallback = cb;
}

export function initMusic(client: Client): void {
  _musicClient = client;
  const nodes = getLavalinkNodes();

  if (!nodes.length) {
    shoukaku = null;
    log("[Music] No Lavalink nodes configured. Music commands are disabled.", "discord");
    return;
  }

  log(`[Music] Initialising Lavalink with nodes: ${nodes.map((node) => node.name).join(", ")}`, "discord");

  shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
    moveOnDisconnect: false,
    resumeByLibrary: false,
    // High reconnectTries prevents Shoukaku from permanently evicting nodes after a
    // brief outage. With 5 tries the entire 14-node public pool can be exhausted in
    // minutes, leaving an empty node map and making every search throw
    // "No Lavalink nodes available." — keeping tries high means nodes keep retrying.
    reconnectTries: 999,
    reconnectInterval: 10,
    nodeResolver: qualityNodeResolver,
  });

  shoukaku.on("ready", (name) =>
    log(`[Music] Lavalink node "${name}" connected.`, "discord"),
  );
  shoukaku.on("error", (name, err) =>
    log(`[Music] Lavalink node "${name}" error: ${(err as Error).message}`, "discord"),
  );
  shoukaku.on("close", (name, code, reason) => {
    log(`[Music] Lavalink node "${name}" closed (${code}): ${reason}`, "discord");
    // Abnormal close (1006 etc.) — record for cooldown and attempt mid-song recovery.
    // Clean closes (1000 = normal, 1001 = going away) are intentional shutdowns.
    if (code !== 1000 && code !== 1001) {
      recentlyClosedNodes.set(name, Date.now());
      void handleNodeClose(name);
    }
  });
  shoukaku.on("disconnect", (name, count) => {
    log(`[Music] Lavalink node "${name}" disconnected (${count} players affected).`, "discord");
    void handleNodeDisconnect(name);
  });

  startNodeHealthWatchdog();
  startPoolGuardian();
}

// Pool guardian — runs every 90 s and re-initialises Shoukaku if all nodes have
// been dropped from the pool. With reconnectTries: 999 this should almost never
// trigger, but it is the final safety net that prevents a permanently-empty pool.
function startPoolGuardian(): void {
  if (_poolGuardianTimer) clearInterval(_poolGuardianTimer);
  _poolGuardianTimer = setInterval(() => {
    if (!shoukaku || !_musicClient) return;
    const nodeCount = (shoukaku.nodes as Map<string, any>).size;
    if (nodeCount === 0) {
      log("[Music] Pool guardian: all nodes dropped — re-initialising Shoukaku.", "discord");
      // Destroy the dead instance and start fresh.
      try { shoukaku.removeAllListeners(); } catch { /* ignore */ }
      shoukaku = null;
      initMusic(_musicClient);
    }
  }, 90_000);
  _poolGuardianTimer.unref?.();
}

// Node-health watchdog
// Periodically inspects the Lavalink node serving each active queue. If the
// node looks degraded (high penalty score, dropped/nulled opus frames) for a
// sustained window AND a meaningfully better node is available, the bot will
// auto-migrate the player to the healthier node — preserving the now-playing
// song and queue. This catches the "node is connected but laggy" case that
// neither the node-disconnect handler nor the per-track stuck/exception
// recovery would notice.

let nodeHealthWatchdogTimer: ReturnType<typeof setInterval> | null = null;

function startNodeHealthWatchdog(): void {
  if (nodeHealthWatchdogTimer) clearInterval(nodeHealthWatchdogTimer);
  nodeHealthWatchdogTimer = setInterval(() => {
    void runNodeHealthCheck();
  }, NODE_HEALTH_CHECK_INTERVAL_MS);
  nodeHealthWatchdogTimer.unref?.();
}

function getPlayerNode(player: Player): any | null {
  return (player as any)?.node ?? null;
}

function isNodeUnhealthy(node: any): boolean {
  if (!node) return false;
  const penalties = Number(node.penalties ?? 0);
  if (Number.isFinite(penalties) && penalties >= NODE_PENALTY_BAD_THRESHOLD) return true;

  const frames = node?.stats?.frameStats;
  if (frames) {
    const deficit = Number(frames.deficit ?? 0) + Number(frames.nulled ?? 0);
    if (deficit >= NODE_FRAME_DEFICIT_THRESHOLD) return true;
  }
  return false;
}

async function runNodeHealthCheck(): Promise<void> {
  if (!shoukaku || queues.size === 0) return;
  const now = Date.now();

  for (const [guildId, queue] of queues.entries()) {
    if (queue.isStopped || queue.isAutoMigrating || queue.isRecovering || queue.isAdvancing) continue;
    if (!queue.current) continue; // nothing playing — nothing to protect

    const currentNode = getPlayerNode(queue.player);
    if (!currentNode) continue;

    const unhealthy = isNodeUnhealthy(currentNode);

    if (!unhealthy) {
      // Node looks fine — clear any pending unhealthy streak.
      if (queue.nodeUnhealthySince !== 0) queue.nodeUnhealthySince = 0;
      continue;
    }

    if (queue.nodeUnhealthySince === 0) {
      queue.nodeUnhealthySince = now;
      continue;
    }

    if (now - queue.nodeUnhealthySince < NODE_UNHEALTHY_DURATION_MS) continue;
    if (now - queue.lastAutoMigrateAt < NODE_AUTO_MIGRATE_COOLDOWN_MS) continue;

    // Find a meaningfully better alternative — avoid migrating if the rest of
    // the pool is just as bad (or worse), which would only cause flapping.
    const candidate = shoukaku.getIdealNode();
    if (!candidate || candidate.name === currentNode.name) {
      // No better option right now; reset the streak so we re-evaluate fresh.
      queue.nodeUnhealthySince = now;
      continue;
    }

    const currentPenalties = Number(currentNode.penalties ?? 0);
    const candidatePenalties = Number((candidate as any).penalties ?? 0);
    if (
      Number.isFinite(currentPenalties) &&
      Number.isFinite(candidatePenalties) &&
      currentPenalties - candidatePenalties < NODE_PENALTY_IMPROVEMENT_THRESHOLD
    ) {
      queue.nodeUnhealthySince = now;
      continue;
    }

    // Trigger the auto-migration. Mark cooldown immediately so a slow migration
    // can't cause a second one to queue up behind it.
    queue.isAutoMigrating = true;
    queue.lastAutoMigrateAt = now;
    queue.nodeUnhealthySince = 0;

    const fromName = currentNode.name ?? "unknown";
    const toName = candidate.name ?? "unknown";
    log(
      `[Music] Auto-migrating guild ${guildId}: node "${fromName}" degraded (penalties ${currentPenalties.toFixed(0)}) ` +
      `→ trying "${toName}" (penalties ${candidatePenalties.toFixed(0)}).`,
      "discord",
    );
    textNotifyCallback?.(
      guildId,
      queue.textChannelId,
      `playback's getting laggy — switching to a fresher audio node real quick.`,
    );

    try {
      const result = await reconnectMusic(guildId);
      if (result.ok) {
        log(`[Music] Auto-migration succeeded for guild ${guildId} (now on "${result.nodeName ?? "unknown"}").`, "discord");
      } else {
        log(`[Music] Auto-migration failed for guild ${guildId}: ${result.message}`, "discord");
      }
    } catch (err: any) {
      log(`[Music] Auto-migration threw for guild ${guildId}: ${err.message}`, "discord");
    } finally {
      // The new queue object is what's in the map after reconnectMusic; clear
      // the flag on whichever queue is now associated with this guild.
      const post = queues.get(guildId);
      if (post) post.isAutoMigrating = false;
    }
  }
}

// Shared recovery logic: rejoin voice on the best available node, re-resolve
// the current track for a fresh encoded token, and resume from position.
async function recoverQueueOnNewNode(
  guildId: string,
  snapshot: {
    toResume: QueueTrack | null;
    upcomingTracks: QueueTrack[];
    voiceChannelId: string;
    textChannelId: string;
    volume: number;
    loop: LoopMode;
    resumePositionMs: number;
    autoplay: boolean;
    recentSeeds: QueueTrack[];
    recentlyPlayedUris: string[];
  },
): Promise<boolean> {
  if (!shoukaku) return false;

  // getIdealNode() is used for track re-resolution only — we still attempt to
  // join even if it's temporarily null (node may be reconnecting).
  const idealNode = shoukaku.getIdealNode();

  // Re-resolve the current track to get a fresh encoded token.
  // The old encoded is node-specific and expires when a node cycles.
  let freshResume = snapshot.toResume ? { ...snapshot.toResume } : null;
  if (freshResume?.uri) {
    try {
      // Pass title+author as text fallback so if the platform URI fails on the
      // new node (e.g. SoundCloud URI on a node without the SoundCloud plugin),
      // we search by the exact known metadata rather than returning null.
      const textFallback = [freshResume.author, freshResume.title].filter(Boolean).join(" ");
      const fresh = await resolveTrack(freshResume.uri, freshResume.requestedBy, textFallback || undefined);
      if (fresh?.encoded) {
        freshResume.encoded = fresh.encoded;
        log(`[Music] Re-resolved fresh encoded for "${freshResume.title}" (guild ${guildId}).`, "discord");
      }
    } catch { /* use cached encoded */ }
  }

  try {
    const newPlayer = await shoukaku.joinVoiceChannel({
      guildId,
      channelId: snapshot.voiceChannelId,
      shardId: 0,
      deaf: true,
    });

    const newQueue: GuildQueue = {
      player: newPlayer,
      tracks: freshResume ? [freshResume, ...snapshot.upcomingTracks] : snapshot.upcomingTracks,
      current: null,
      volume: snapshot.volume,
      loop: snapshot.loop,
      voiceChannelId: snapshot.voiceChannelId,
      textChannelId: snapshot.textChannelId,
      resumePositionMs: snapshot.resumePositionMs,
      autoplay: snapshot.autoplay,
      recentSeeds: [...snapshot.recentSeeds],
      recentlyPlayedUris: [...snapshot.recentlyPlayedUris],
      isFetchingAutoplay: false,
      isAdvancing: false,
      isStopped: false,
      recoveryAttempts: 0,
      recoveryWindowStartedAt: 0,
      isRecovering: false,
      lastTrackStartedAt: 0,
      nodeUnhealthySince: 0,
      lastAutoMigrateAt: Date.now(),
      isAutoMigrating: false,
    };

    attachPlayerEvents(newPlayer, guildId);
    queues.set(guildId, newQueue);
    await advanceQueue(newPlayer, guildId);
    return true;
  } catch (err: any) {
    log(`[Music] recoverQueueOnNewNode failed for guild ${guildId}: ${err.message}`, "discord");
    return false;
  }
}

// ── Recovery retry helper ─────────────────────────────────────────────────────
// Retries recoverQueueOnNewNode up to 3 times with increasing back-off before
// giving up. On total failure the snapshot is frozen so the user's queue is
// never permanently lost — it auto-restores on the next /play within 30 min.
const RECOVERY_BACKOFF_MS = [5_000, 15_000, 30_000] as const;

async function recoverWithRetry(
  guildId: string,
  snapshot: Parameters<typeof recoverQueueOnNewNode>[1],
  nodeName: string,
  reason: "close" | "disconnect",
): Promise<void> {
  const maxAttempts = RECOVERY_BACKOFF_MS.length + 1; // 4 total

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = RECOVERY_BACKOFF_MS[attempt - 1];
      log(`[Music] Recovery retry ${attempt}/${maxAttempts - 1} for guild ${guildId} in ${delay}ms…`, "discord");
      await new Promise<void>((r) => setTimeout(r, delay));
    }

    // Another event may have already recovered this guild while we waited.
    if (queues.has(guildId)) return;

    const ok = await recoverQueueOnNewNode(guildId, snapshot);
    if (ok) {
      const nodeName2 = (queues.get(guildId)?.player as any)?.node?.name ?? "unknown";
      const posMsg = snapshot.resumePositionMs > 0
        ? ` from ${formatDuration(snapshot.resumePositionMs)}`
        : "";
      const msgs: Record<"close" | "disconnect", string> = {
        close:      `node hiccup — back on **${nodeName2}**, resuming${posMsg}.`,
        disconnect: `node dropped — reconnected on **${nodeName2}**, resuming${posMsg}.`,
      };
      textNotifyCallback?.(guildId, snapshot.textChannelId, msgs[reason]);
      log(`[Music] Recovered guild ${guildId} after "${nodeName}" ${reason} (attempt ${attempt + 1}).`, "discord");
      return;
    }
  }

  // ── All attempts failed — freeze the queue so it survives the outage ──────
  const allTracks = snapshot.toResume
    ? [snapshot.toResume, ...snapshot.upcomingTracks]
    : [...snapshot.upcomingTracks];

  if (allTracks.length > 0) {
    frozenQueues.set(guildId, {
      tracks: allTracks,
      textChannelId: snapshot.textChannelId,
      voiceChannelId: snapshot.voiceChannelId,
      volume: snapshot.volume,
      loop: snapshot.loop,
      autoplay: snapshot.autoplay,
      recentSeeds: [...snapshot.recentSeeds],
      recentlyPlayedUris: [...snapshot.recentlyPlayedUris],
      frozenAt: Date.now(),
    });
    textNotifyCallback?.(
      guildId,
      snapshot.textChannelId,
      `all nodes are down — your queue (${allTracks.length} track${allTracks.length === 1 ? "" : "s"}) is frozen. use /play to restore it once nodes recover.`,
    );
    log(`[Music] Frozen ${allTracks.length} track(s) for guild ${guildId} after "${nodeName}" ${reason} — all recovery attempts exhausted.`, "discord");
  } else {
    textNotifyCallback?.(guildId, snapshot.textChannelId, "all nodes are down — reconnect once they recover.");
    log(`[Music] Could not recover guild ${guildId} after "${nodeName}" ${reason} — no nodes, empty queue.`, "discord");
  }
}

// Called on abnormal node close (e.g. 1006). Shoukaku will reconnect automatically,
// but the player session on the closed node is lost — music silently stops.
// We snapshot active queues, wait briefly for the node to stabilise, then
// rejoin voice on a *different* node (deprioritised by recentlyClosedNodes cooldown)
// and resume the track with a freshly resolved encoded token.
async function handleNodeClose(nodeName: string): Promise<void> {
  if (!shoukaku) return;

  // Snapshot affected queues immediately (position is still valid on the player object).
  type Snapshot = Parameters<typeof recoverQueueOnNewNode>[1];
  const affected = new Map<string, Snapshot>();

  for (const [guildId, queue] of queues.entries()) {
    if (queue.isStopped) continue;
    const playerNodeName = (queue.player as any)?.node?.name ?? (queue.player as any)?.options?.name;
    if (playerNodeName && playerNodeName !== nodeName) continue;

    const resumePositionMs = getResumePositionMs(queue, queue.current);
    affected.set(guildId, {
      toResume: queue.current,
      upcomingTracks: [...queue.tracks],
      voiceChannelId: queue.voiceChannelId,
      textChannelId: queue.textChannelId,
      volume: queue.volume,
      loop: queue.loop,
      resumePositionMs,
      autoplay: queue.autoplay,
      recentSeeds: [...queue.recentSeeds],
      recentlyPlayedUris: [...queue.recentlyPlayedUris],
    });

    // Mark stopped and remove so stale player events don't interfere.
    queue.isStopped = true;
    queues.delete(guildId);
  }

  if (!affected.size) return;

  log(`[Music] Node "${nodeName}" closed — recovering ${affected.size} guild(s).`, "discord");

  // Wait for the closed node to finish its reconnect cycle before we try
  // to join voice. 4 s gives more headroom for other nodes to stabilise
  // and for Shoukaku's internal reconnect bookkeeping to settle.
  // recentlyClosedNodes cooldown ensures the resolver picks a *different* node.
  await new Promise<void>((r) => setTimeout(r, 4000));

  for (const [guildId, snapshot] of affected) {
    if (queues.has(guildId)) continue;
    await recoverWithRetry(guildId, snapshot, nodeName, "close");
  }
}

// When a Lavalink node goes down permanently (all reconnect attempts exhausted),
// try to recover any still-affected queues on another node.
async function handleNodeDisconnect(nodeName: string): Promise<void> {
  if (!shoukaku) return;

  for (const [guildId, queue] of queues.entries()) {
    const playerNodeName = (queue.player as any)?.node?.name ?? (queue.player as any)?.options?.name;
    if (playerNodeName && playerNodeName !== nodeName) continue;
    if (queue.isStopped) continue;

    log(`[Music] Attempting recovery for guild ${guildId} after node "${nodeName}" disconnect.`, "discord");

    const snapshot = {
      toResume: queue.current,
      upcomingTracks: [...queue.tracks],
      voiceChannelId: queue.voiceChannelId,
      textChannelId: queue.textChannelId,
      volume: queue.volume,
      loop: queue.loop,
      resumePositionMs: getResumePositionMs(queue, queue.current),
      autoplay: queue.autoplay,
      recentSeeds: [...queue.recentSeeds],
      recentlyPlayedUris: [...queue.recentlyPlayedUris],
    };

    queue.isStopped = true;
    queues.delete(guildId);

    // Brief delay so Shoukaku finishes teardown before we rejoin.
    await new Promise<void>((r) => setTimeout(r, 500));

    await recoverWithRetry(guildId, snapshot, nodeName, "disconnect");
  }
}

export function getQueue(guildId: string): GuildQueue | undefined {
  return queues.get(guildId);
}

export function formatDuration(ms: number): string {
  if (ms < 0) return "LIVE";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function parseSeekTime(input: string): number | null {
  const parts = input.trim().split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 1) return parts[0] * 1000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return null;
}

// Defensively wipe any Lavalink filters before starting playback. Speed/pitch
// warping during music ("plays too fast" or "too slow") is almost always a
// stale `timescale` filter that survived a previous track, recovery attempt,
// or node migration. Clearing filters every play guarantees each track starts
// at neutral 1.0× speed / pitch / rate.
async function resetPlayerFilters(player: Player, guildId: string): Promise<void> {
  try {
    const preset = guildFilters.get(guildId);
    if (preset) {
      await applyFilterPreset(player, preset, guildId);
    } else {
      await player.clearFilters();
    }
  } catch (err: any) {
    log(`[Music] Failed to apply filters in guild ${guildId}: ${err.message}`, "discord");
  }
}

function getResumePositionMs(queue: GuildQueue, track: QueueTrack | null): number {
  if (!track || track.isStream || track.duration <= 0) return 0;

  const position = Number(queue.player.position);
  if (!Number.isFinite(position) || position < 1000) return 0;

  const latestSafePosition = Math.max(0, track.duration - 1000);
  return Math.min(Math.floor(position), latestSafePosition);
}

async function applyResumePosition(
  player: Player,
  guildId: string,
  track: QueueTrack,
  queue: GuildQueue,
): Promise<void> {
  const resumePositionMs = queue.resumePositionMs ?? 0;
  queue.resumePositionMs = undefined;

  if (resumePositionMs <= 0 || track.isStream) return;

  try {
    await player.seekTo(resumePositionMs);
    log(`[Music] Resumed "${track.title}" in guild ${guildId} at ${formatDuration(resumePositionMs)}.`, "discord");
  } catch (err: any) {
    log(`[Music] Failed to restore position for "${track.title}" in guild ${guildId}: ${err.message}`, "discord");
  }
}

const AUTO_DISCONNECT_MS = 5 * 60 * 1000; // 5 minutes

function scheduleAutoDisconnect(guildId: string): void {
  queueStopCallback?.(guildId);
  // Notify the text channel that the queue is empty and give a countdown.
  const q0 = queues.get(guildId);
  if (q0) {
    textNotifyCallback?.(
      guildId,
      q0.textChannelId,
      `queue's empty — i'll hang around for 5 minutes in case you want to add more songs ♪`,
    );
  }
  setTimeout(async () => {
    const q = queues.get(guildId);
    if (q && !q.current && q.tracks.length === 0 && !q.isAdvancing) {
      textNotifyCallback?.(guildId, q.textChannelId, `no songs queued in 5 minutes — disconnecting, byebye ♡`);
      try {
        await shoukaku?.leaveVoiceChannel(guildId);
      } catch { /* ignore */ }
      queues.delete(guildId);
      log(`[Music] Auto-disconnected from guild ${guildId} (queue empty after 5 min).`, "discord");
    }
  }, AUTO_DISCONNECT_MS);
}

// Per-guild autoplay preference, persists even when no queue/player exists
const guildAutoplayPrefs = new Map<string, boolean>();

export function setAutoplay(guildId: string, enabled: boolean): boolean {
  guildAutoplayPrefs.set(guildId, enabled);
  const q = queues.get(guildId);
  if (q) q.autoplay = enabled;
  return enabled;
}

export function isAutoplayEnabled(guildId: string): boolean {
  const q = queues.get(guildId);
  if (q) return q.autoplay;
  return guildAutoplayPrefs.get(guildId) ?? false;
}

export function getAutoplayPref(guildId: string): boolean {
  return guildAutoplayPrefs.get(guildId) ?? false;
}

function extractYouTubeVideoId(uri: string): string | null {
  try {
    const url = new URL(uri);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.slice(1) || null;
    }
    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v");
    }
  } catch { /* ignore */ }
  return null;
}

async function fetchAutoplayTracks(
  seed: QueueTrack,
  count: number,
  exclude: Set<string>,
  guildId?: string,
  textChannelId?: string,
): Promise<QueueTrack[]> {
  if (!shoukaku) return [];
  const node = shoukaku.getIdealNode();
  if (!node) return [];

  const candidates: QueueTrack[] = [];
  const seen = new Set<string>(exclude);

  const collect = (raw: any): void => {
    if (!raw?.encoded || !raw.info) return;
    if (raw.info.isStream) return;
    const uri = raw.info.uri;
    if (!uri || seen.has(uri)) return;
    seen.add(uri);
    candidates.push({
      encoded: raw.encoded,
      title: raw.info.title,
      author: raw.info.author,
      uri,
      duration: raw.info.length,
      isStream: !!raw.info.isStream,
      requestedBy: "autoplay",
      artworkUrl: raw.info.artworkUrl ?? null,
    });
  };

  // Strategy 1: YouTube radio mix from the seed video
  const videoId = extractYouTubeVideoId(seed.uri);
  if (videoId) {
    try {
      const mixUrl = `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`;
      const result = await resolveWithTimeout(node, mixUrl);
      if (result?.loadType === "playlist") {
        const tracks = ((result.data as any).tracks ?? []) as any[];
        // Skip the first one — it's the seed track itself
        for (const t of tracks.slice(1)) collect(t);
      }
    } catch { /* ignore — fall back to search */ }
  }

  // Strategy 2: artist search as a backup or top-up
  if (candidates.length < count && seed.author) {
    try {
      const result = await resolveWithTimeout(node, `ytsearch:${seed.author} mix`);
      if (result?.loadType === "search") {
        for (const t of (result.data as any[])) collect(t);
      }
    } catch { /* ignore */ }
  }

  return candidates.slice(0, count);
}

// Iterative (non-recursive) queue advancer with isAdvancing guard
async function advanceQueue(player: Player, guildId: string): Promise<void> {
  const queue = queues.get(guildId);
  if (!queue) return;

  // Debounce: ignore if another advance just fired within 200ms
  const now = Date.now();
  const last = advanceDebounce.get(guildId) ?? 0;
  if (now - last < 200) return;
  advanceDebounce.set(guildId, now);

  // If already advancing or intentionally stopped, bail out
  if (queue.isAdvancing || queue.isStopped) return;
  queue.isAdvancing = true;

  try {
    // Loop until we either play a track successfully or exhaust the queue
    while (true) {
      const q = queues.get(guildId);
      if (!q || q.isStopped) return;

      // Track looping
      if (q.loop === "track" && q.current) {
        try {
          await resetPlayerFilters(player, guildId);
          await player.playTrack({ track: { encoded: q.current.encoded } });
          await player.setGlobalVolume(q.volume);
          await applyResumePosition(player, guildId, q.current, q);
          nowPlayingCallback?.(guildId, q.current, q);
          return;
        } catch (err: any) {
          log(`[Music] Failed to loop track "${q.current.title}" in guild ${guildId}: ${err.message}`, "discord");
          // Fall through: treat as finished and move to next track
        }
      }

      // Queue looping: push current to end of queue
      if (q.loop === "queue" && q.current) {
        q.tracks.push(q.current);
      }

      // Capture the just-finished track for autoplay seeding & repeat avoidance.
      // Only autoplay-fetched tracks are added to the exclusion list — user-queued
      // tracks stay eligible so autoplay can resurface them as discovery picks.
      if (q.current) {
        q.recentSeeds.push(q.current);
        if (q.recentSeeds.length > 5) q.recentSeeds.shift();
        if (q.current.requestedBy === "autoplay") {
          q.recentlyPlayedUris.push(q.current.uri);
          if (q.recentlyPlayedUris.length > 50) q.recentlyPlayedUris.shift();
        }
      }

      q.current = null;

      // Autoplay: when the queue runs dry, fetch similar tracks based on the last seed.
      // Only when not looping the whole queue (queue-loop is exclusive of autoplay).
      // Kicked off as a non-blocking background Promise so the event loop isn't held
      // while waiting for Lavalink HTTP (1-3 s). The .then() re-triggers advanceQueue
      // once tracks arrive, before the 30-second auto-disconnect fires.
      if (q.tracks.length === 0 && q.autoplay && q.loop !== "queue" && !q.isFetchingAutoplay) {
        const seed = q.recentSeeds[q.recentSeeds.length - 1];
        if (seed) {
          q.isFetchingAutoplay = true;
          const exclude = new Set(q.recentlyPlayedUris);
          fetchAutoplayTracks(seed, 5, exclude, guildId, q.textChannelId)
            .then((fetched) => {
              const liveQ = queues.get(guildId);
              if (!liveQ || liveQ.isStopped) return;
              if (fetched.length) {
                liveQ.tracks.push(...fetched);
                log(`[Music:autoplay] Queued ${fetched.length} tracks based on "${seed.title}" in guild ${guildId}.`, "discord");
                textNotifyCallback?.(guildId, liveQ.textChannelId, `🎶 autoplay queued **${fetched.length}** similar tracks.`);
                // Re-trigger advance if nothing is already playing
                if (!liveQ.current && !liveQ.isAdvancing) {
                  void advanceQueue(player, guildId);
                }
              } else {
                log(`[Music:autoplay] No similar tracks found for "${seed.title}" in guild ${guildId}.`, "discord");
              }
            })
            .catch((err: any) => {
              log(`[Music:autoplay] Fetch failed in guild ${guildId}: ${err.message}`, "discord");
            })
            .finally(() => {
              const liveQ = queues.get(guildId);
              if (liveQ) liveQ.isFetchingAutoplay = false;
            });
        }
      }

      if (q.tracks.length === 0) {
        scheduleAutoDisconnect(guildId);
        return;
      }

      const next = q.tracks.shift()!;

      try {
        await resetPlayerFilters(player, guildId);
        await player.playTrack({ track: { encoded: next.encoded } });
        q.current = next;
        await player.setGlobalVolume(q.volume);
        await applyResumePosition(player, guildId, next, q);
        nowPlayingCallback?.(guildId, next, q);
        return; // Successfully started next track
      } catch (playErr: any) {
        log(`[Music] Failed to play track "${next.title}" in guild ${guildId}: ${playErr.message} — re-resolving on alternate node.`, "discord");
        // The encoded token is node-specific and may be stale. Try re-resolving
        // on a different node before silently dropping the track.
        if (next.uri) {
          try {
            const failingNode = getPlayerNode(player);
            const fresh = await resolveTrack(next.uri, next.requestedBy, undefined, failingNode ?? undefined);
            if (fresh?.encoded) {
              await resetPlayerFilters(player, guildId);
              await player.playTrack({ track: { encoded: fresh.encoded } });
              const reResolved = { ...next, encoded: fresh.encoded };
              q.current = reResolved;
              await player.setGlobalVolume(q.volume);
              await applyResumePosition(player, guildId, reResolved, q);
              nowPlayingCallback?.(guildId, reResolved, q);
              log(`[Music] Re-resolved and now playing "${next.title}" in guild ${guildId}.`, "discord");
              return;
            }
          } catch { /* re-resolve also failed — skip track */ }
        }
        log(`[Music] Skipping "${next.title}" in guild ${guildId} — could not re-resolve.`, "discord");
        // Track is truly unplayable — continue while-loop to next track
      }
    }
  } finally {
    const q = queues.get(guildId);
    if (q) q.isAdvancing = false;
  }
}

// Try to recover the currently-playing track after a stuck/exception event by
// replaying it from its last known position. Only after a few failed attempts
// within a short window do we give up and advance the queue.
async function attemptRecovery(
  player: Player,
  guildId: string,
  cause: "stuck" | "exception",
  causeMessage: string,
): Promise<void> {
  const q = queues.get(guildId);
  if (!q || q.isStopped || q.isRecovering || q.isAdvancing) return;
  if (!q.current) {
    void advanceQueue(player, guildId);
    return;
  }

  const now = Date.now();
  // Reset the recovery streak if the window has elapsed since the streak began.
  if (q.recoveryAttempts > 0 && now - q.recoveryWindowStartedAt > RECOVERY_WINDOW_MS) {
    q.recoveryAttempts = 0;
  }
  if (q.recoveryAttempts === 0) {
    q.recoveryWindowStartedAt = now;
  }

  if (q.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
    log(`[Music] Recovery exhausted for "${q.current.title}" in guild ${guildId} (${cause}: ${causeMessage}). Skipping.`, "discord");
    textNotifyCallback?.(guildId, q.textChannelId, `couldn't recover **${q.current.title}** after a few tries — skipping.`);
    q.recoveryAttempts = 0;
    void advanceQueue(player, guildId);
    return;
  }

  q.recoveryAttempts += 1;
  q.isRecovering = true;

  const track = q.current;
  // Compute the position to resume from: prefer the player's current reported
  // position if it looks valid, otherwise re-use whatever resume point we had.
  const resumeFromMs = getResumePositionMs(q, track);

  log(
    `[Music] Recovery attempt ${q.recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS} for "${track.title}" in guild ${guildId} ` +
    `(${cause}: ${causeMessage}) — replaying from ${formatDuration(resumeFromMs)}.`,
    "discord",
  );

  if (q.recoveryAttempts === 1) {
    textNotifyCallback?.(guildId, q.textChannelId, `playback hiccup on **${track.title}** — trying to recover…`);
  }

  // On exception or stuck, the encoded token may be stale or node-specific —
  // especially when the Lavalink node has just cycled (1006 close/reconnect).
  // Stuck events can also mean the audio stream died mid-track, so a fresh
  // encoded token often unblocks playback without changing position.
  // Re-resolve the track to get a fresh encoded value before replaying.
  let encodedToPlay = track.encoded;
  if ((cause === "exception" || cause === "stuck") && track.uri) {
    try {
      // Pass title+author as text fallback: if the platform URI can't be resolved
      // on this node (e.g. SoundCloud URI, no plugin), the precise metadata search
      // finds the correct track rather than returning null or a wrong version.
      const textFallback = [track.author, track.title].filter(Boolean).join(" ");
      // Smart node fallback: exclude the player's current node from re-resolution so we
      // always get a fresh encoded token from a different node. If the current node had
      // a streaming issue (YouTube bot-detection, rate-limit, etc.) the old node would
      // return the same broken token. A fresh node is far more likely to succeed.
      const failingNode = getPlayerNode(player);
      const fresh = await resolveTrack(track.uri, track.requestedBy, textFallback || undefined, failingNode ?? undefined);
      if (fresh?.encoded) {
        encodedToPlay = fresh.encoded;
        // Keep the queue entry up to date so subsequent recoveries also get the fresh token.
        track.encoded = fresh.encoded;
        log(`[Music] Re-resolved fresh encoded for "${track.title}" in guild ${guildId}${failingNode ? ` (excluded failing node "${failingNode.name}")` : ""}.`, "discord");
      } else if (cause === "exception") {
        // Re-resolution returned nothing — every node failed to find the track.
        // Retrying with the old stale encoded that caused the exception would just
        // loop and fail 3 times. Skip immediately instead.
        log(`[Music] Re-resolve returned null for "${track.title}" in guild ${guildId} — skipping.`, "discord");
        textNotifyCallback?.(guildId, q.textChannelId, `couldn't re-fetch **${track.title}** — skipping.`);
        q.recoveryAttempts = 0;
        q.isRecovering = false;
        void advanceQueue(player, guildId);
        return;
      }
    } catch (err: any) {
      log(`[Music] Re-resolve failed for "${track.title}" in guild ${guildId}: ${err.message} — using cached encoded.`, "discord");
    }
  }

  try {
    await resetPlayerFilters(player, guildId);
    await player.playTrack({ track: { encoded: encodedToPlay } });
    await player.setGlobalVolume(q.volume);
    if (resumeFromMs > 0 && !track.isStream) {
      try {
        await player.seekTo(resumeFromMs);
      } catch (err: any) {
        log(`[Music] Recovery seek failed for "${track.title}" in guild ${guildId}: ${err.message}`, "discord");
      }
    }
  } catch (err: any) {
    log(`[Music] Recovery replay failed for "${track.title}" in guild ${guildId}: ${err.message}`, "discord");
    // Replay itself failed — fall through to advancing the queue.
    const cur = queues.get(guildId);
    if (cur) cur.isRecovering = false;
    void advanceQueue(player, guildId);
    return;
  }

  // Release the recovery lock shortly after — long enough that the player has
  // a chance to actually start, but short enough that the next stuck/exception
  // can trigger another attempt if needed.
  setTimeout(() => {
    const cur = queues.get(guildId);
    if (cur) cur.isRecovering = false;
  }, 3_000);
}

function attachPlayerEvents(player: Player, guildId: string): void {
  // Remove any stale listeners before attaching (safety in case of re-attach)
  player.removeAllListeners("start");
  player.removeAllListeners("end");
  player.removeAllListeners("exception");
  player.removeAllListeners("stuck");
  player.removeAllListeners("error");

  // Without an "error" listener, Node.js throws any emitted errors as uncaught
  // exceptions and crashes the process — this is the root cause of the 10 s crash.
  player.on("error", (err: any) => {
    log(`[Music] Player error in guild ${guildId}: ${err?.message ?? String(err)}`, "discord");
    const q = queues.get(guildId);
    if (!q || q.isStopped || q.isRecovering) return;
    void attemptRecovery(player, guildId, "exception", `player error: ${err?.message ?? "unknown"}`);
  });

  player.on("start", () => {
    const q = queues.get(guildId);
    if (!q) return;
    q.lastTrackStartedAt = Date.now();
    // If the player has been streaming smoothly long enough, treat any earlier
    // recovery streak as resolved. This is also handled lazily in attemptRecovery
    // via the time window, but resetting here keeps state tidy.
  });

  player.on("end", (event) => {
    const reason = (event as any)?.reason as string | undefined;

    // "replaced" = new track was loaded while something played (intended, already handled)
    // "cleanup"  = node is shutting down (handleNodeDisconnect handles this)
    // "stopped"  = stopTrack() was called intentionally (stopMusic sets isStopped first;
    //              skipTrack clears current first) — OR the node silently dropped the
    //              player session mid-song (unintentional drop, current is still set).
    if (reason === "replaced" || reason === "cleanup") return;

    const q = queues.get(guildId);
    if (!q || q.isStopped) return;

    // If we just finished a track cleanly (i.e. it actually ended), clear any
    // lingering recovery counters before moving on to the next song.
    if (reason === "finished") {
      q.recoveryAttempts = 0;
      q.recoveryWindowStartedAt = 0;
    }

    // If a recovery replay is in flight, the "end" event is a side-effect of
    // the replay itself and should not advance the queue.
    if (q.isRecovering) return;

    // An unexpected "stopped" while a track is still current means the node
    // killed the player session mid-song (the bot didn't call stopTrack).
    // skipTrack clears current before stopping, so q.current here implies the
    // drop was involuntary. Attempt recovery to re-resolve and resume from the
    // last known position rather than silently discarding the track.
    if (reason === "stopped" && q.current) {
      void attemptRecovery(player, guildId, "exception", "player stopped unexpectedly");
      return;
    }

    void advanceQueue(player, guildId);
  });

  player.on("exception", (event) => {
    const msg = (event as any)?.exception?.message ?? "unknown";
    log(`[Music] Track exception in guild ${guildId}: ${msg}`, "discord");

    const q = queues.get(guildId);
    if (!q || q.isStopped) return;

    // Permanently unplayable track patterns — skip immediately instead of
    // wasting 3 recovery attempts replaying the same broken source.
    // Covers: Deezer errors, LavaSrc provider errors, ended live streams,
    // YouTube age/region/copyright blocks, and bot-detection rate limits.
    const isUnrecoverable =
      /deezer/i.test(msg) ||
      q.current?.isStream === true ||
      /stream.{0,30}(metadata|identifier|missing|ended|unavailable)/i.test(msg) ||
      /not (playable|available|found)/i.test(msg) ||
      /no (track|song|result)/i.test(msg) ||
      /\b(403|404|410|429)\b/.test(msg) ||
      /video.{0,40}(unavailable|removed|deleted|private|blocked|restricted)/i.test(msg) ||
      /age.{0,20}(restricted|gated|verif)/i.test(msg) ||
      /copyright/i.test(msg) ||
      /this video is not available/i.test(msg) ||
      /sign in to confirm/i.test(msg) ||
      /playback.{0,30}(not|country|region)/i.test(msg) ||
      /content.{0,20}(country|region|blocked)/i.test(msg);

    if (isUnrecoverable) {
      log(`[Music] Unrecoverable track error ("${msg}") — skipping immediately.`, "discord");
      void advanceQueue(player, guildId);
      return;
    }

    void attemptRecovery(player, guildId, "exception", msg);
  });

  player.on("stuck", (event) => {
    const thresholdMs = (event as any)?.thresholdMs;
    log(`[Music] Track stuck in guild ${guildId}${thresholdMs ? ` (threshold ${thresholdMs}ms)` : ""}, attempting recovery.`, "discord");

    const q = queues.get(guildId);
    if (!q || q.isStopped) return;

    void attemptRecovery(player, guildId, "stuck", thresholdMs ? `threshold ${thresholdMs}ms` : "no threshold");
  });
}

export interface SearchResult {
  title: string;
  author: string;
  uri: string;
  duration: number;
  isStream: boolean;
}

// ── Autocomplete result cache ─────────────────────────────────────────────────
// Stores the exact track URIs returned during autocomplete so the play command
// can resolve the precise track the user picked, not a fresh re-search.
interface AcCacheEntry { items: Array<{ uri: string; text: string }>; exp: number; }
const _acCache = new Map<string, AcCacheEntry>();

export function acCacheStore(key: string, items: Array<{ uri: string; text: string }>): void {
  _acCache.set(key, { items, exp: Date.now() + 120_000 });
  const now = Date.now();
  for (const [k, v] of _acCache) if (v.exp < now) _acCache.delete(k);
}

export function acCacheLookup(key: string, idx: number): { uri: string; text: string } | null {
  const e = _acCache.get(key);
  if (!e || e.exp < Date.now()) return null;
  return e.items[idx] ?? null;
}

export async function searchTracks(query: string, limit = 5): Promise<SearchResult[]> {
  if (!shoukaku) return [];

  // Use getNodesByQuality() (same as resolveTrack) so that nodes which are
  // registered but not yet connected don't cause an immediate [] return.
  // getIdealNode() only returns CONNECTED nodes — if all nodes are still
  // establishing their WebSocket, it returns null and autocomplete shows nothing.
  const nodes = getNodesByQuality();
  const node = nodes[0] ?? shoukaku.getIdealNode();
  if (!node) return [];

  const isUrl = /^https?:\/\//i.test(query);

  const toResult = (raw: any): SearchResult => ({
    title: raw.info.title,
    author: raw.info.author,
    uri: raw.info.uri,
    duration: raw.info.length,
    isStream: raw.info.isStream,
  });

  try {
    if (isUrl) {
      const result = await resolveWithTimeout(node, query).catch(() => null);
      if (!result) return [];
      if (result.loadType === "search") return (result.data as any[]).slice(0, limit).map(toResult);
      if (result.loadType === "track") return [toResult(result.data)];
      if (result.loadType === "playlist") return ((result.data as any).tracks as any[]).slice(0, limit).map(toResult);
      return [];
    }

    // Non-URL: try multiple sources across all nodes
    const raws = await resolveSearchMultipleAnyNode(query, limit);
    return raws.map(toResult);
  } catch {
    // silently return empty on search errors
  }

  return [];
}

// Primary search source — ytsearch is the most portable and widely-supported
// Lavalink search prefix. ytmsearch (YouTube Music) and scsearch (SoundCloud)
// are sequential last-resorts when ytsearch returns nothing.
const SEARCH_PREFIXES = ["ytsearch"];

// Tracks whose titles match this are clearly not the original version the user
// wants (unless they explicitly typed one of these words in the query).
// We subtract JUNK_PENALTY from their score so bestMatchingTrack naturally
// prefers the real track — without hard-blocking (the user CAN request
// "/play billie jean remix" and still get a remix).
const JUNK_VERSION_RE =
  /\b(karaoke|instrumental(?:\s+version)?|nightcore|slowed(?:\s*\+?\s*reverb)?|lo-?fi|lofi|8d(?:\s+audio)?|demo(?:\s+version)?|tribute|minus\s+one|no\s+vocals?|off\s+vocal|in\s+the\s+style\s+of|made\s+popular\s+by|originally\s+performed\s+by|sped[- ]up|speed[- ]up|cover\s+version|background\s+(?:music|version)|phonk|remix|mashup|type\s+beat|fan[- ]?(?:made|cover|edit)|ai[- ]?(?:generated|cover|version)|unofficial|live(?:\s+at|\s+from|\s+version|\s+performance|\s+session)?|acoustic(?:\s+version)?|extended(?:\s+version)?|piano(?:\s+version)?|orchestral(?:\s+version)?|stripped(?:\s+version)?)\b/i;
const JUNK_PENALTY = 15;

// LavaSrc on public nodes routes ytmsearch: through Deezer/radio endpoints.
// Deezer tracks fail with "stream metadata missing"; stream tracks are live-only.
// Both should be excluded from search results entirely.
function isDeezerTrack(raw: any): boolean {
  const uri: string = raw?.info?.uri ?? "";
  return /deezer\.com/i.test(uri) || uri.startsWith("dz:");
}
function isStreamTrack(raw: any): boolean {
  return raw?.info?.isStream === true;
}
function isBadTrack(raw: any): boolean {
  return isDeezerTrack(raw) || isStreamTrack(raw);
}

// Wrap node.rest.resolve with a hard timeout so a slow/dead public node never
// blocks the event loop indefinitely. 8 s is generous but prevents infinite hangs.
const RESOLVE_TIMEOUT_MS = 8_000;
function resolveWithTimeout(node: any, url: string): Promise<any> {
  return Promise.race([
    node.rest.resolve(url) as Promise<any>,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("resolve timeout")), RESOLVE_TIMEOUT_MS),
    ),
  ]);
}

// Matches titles/channels from official artist sources.
// "VEVO" and "- Topic" (YouTube Music auto-generated topic channels) reliably
// carry the studio recording. "Official Video/Audio/Music Video" is YouTube's
// own tagging for label-uploaded videos.
const OFFICIAL_RE = /\b(vevo|official\s+(?:video|audio|music\s+video|lyric\s+video|visualizer)|official$|\s-\s+topic$)/i;
const OFFICIAL_BOOST = 3;

// Score how closely a Lavalink track result matches the user's query.
// Normalises both sides to lowercase word tokens, counts overlapping words,
// then subtracts JUNK_PENALTY if the result title looks like a phonk/remix/
// karaoke/etc. version that the user almost certainly didn't want, and adds
// OFFICIAL_BOOST when the result is from a verified/official source.
// Both adjustments are skipped when the user explicitly typed the keyword
// (e.g. "/play billie jean remix" keeps remix results).
function trackRelevanceScore(query: string, raw: any): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(w => w.length > 1);
  const queryWords = normalize(query);
  if (!queryWords.length) return 0;
  const title: string = raw?.info?.title ?? "";
  const channel: string = raw?.info?.author ?? "";
  const resultWords = new Set([
    ...normalize(title),
    ...normalize(channel),
  ]);
  const wordMatch = queryWords.filter(w => resultWords.has(w)).length;
  // Penalise unofficial/junk versions unless the user asked for them.
  const isJunk = JUNK_VERSION_RE.test(title) && !JUNK_VERSION_RE.test(query);
  // Reward official uploads so they beat equally-scored unofficial versions.
  const isOfficial = (OFFICIAL_RE.test(title) || OFFICIAL_RE.test(channel)) && !isJunk;
  let score = isJunk ? wordMatch - JUNK_PENALTY : wordMatch;
  if (isOfficial) score += OFFICIAL_BOOST;
  return score;
}

// Platform resolution reliability ranking.
// YouTube URLs resolve on every Lavalink node regardless of plugins; SoundCloud
// and YouTube Music require optional source plugins that not all nodes carry.
// When relevance scores are equal we bias toward the most-portable platform so
// that the stored URI can always be re-resolved on a fresh node during recovery
// without falling back to a generic text search that might return the wrong track.
function platformPriority(raw: any): number {
  const uri: string = raw?.info?.uri ?? "";
  if (/youtube\.com|youtu\.be/i.test(uri)) return 2;
  if (/soundcloud\.com/i.test(uri)) return 1;
  // YouTube Music, Deezer, etc. — least portable
  return 0;
}

// Pick the candidate with the highest relevance score.
// Ties are broken by platform priority (YouTube > SoundCloud > others) so we
// consistently favour URIs that every node can re-resolve, preventing
// cross-platform mismatches when the search node differs from the playback node.
function bestMatchingTrack(query: string, candidates: any[]): any {
  if (candidates.length === 1) return candidates[0];
  let best = candidates[0];
  let bestScore = trackRelevanceScore(query, best);
  let bestPriority = platformPriority(best);
  for (let i = 1; i < candidates.length; i++) {
    const score = trackRelevanceScore(query, candidates[i]);
    const priority = platformPriority(candidates[i]);
    if (score > bestScore || (score === bestScore && priority > bestPriority)) {
      bestScore = score;
      bestPriority = priority;
      best = candidates[i];
    }
  }
  return best;
}

// Query all search sources in parallel. Early-exit when the first result matches
// ALL query words AND is from YouTube (not SoundCloud) — this prevents SoundCloud
// from short-circuiting when it returns fast with a phonk/remix that happens to
// contain the artist name. If no source achieves a full-word YouTube match we
// wait for all responses and pick the best-scoring candidate overall.
// After the parallel phase, scsearch is tried as a last resort only if both
// YouTube sources returned nothing.
async function resolveSearch(node: any, query: string): Promise<any | null> {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(w => w.length > 1);
  const queryWordCount = Math.max(1, normalize(query).length);

  const candidates: any[] = [];
  let remaining = SEARCH_PREFIXES.length;

  const ytResult = await new Promise<any | null>((resolve) => {
    let done = false;
    const finish = (result: any | null) => {
      if (!done) { done = true; resolve(result); }
    };

    for (const prefix of SEARCH_PREFIXES) {
      resolveWithTimeout(node, `${prefix}:${query}`)
        .then((result: any) => {
          if (done) { remaining--; return; }
          remaining--;
          if (result?.loadType === "search") {
            const tracks = (result.data as any[]).filter((t: any) => !isBadTrack(t));
            if (tracks.length) {
              // Consider the top 5 results so a junk version ranked #1 by
              // YouTube doesn't block the real track at position #2–5.
              const topN = tracks.slice(0, 5);
              const best = bestMatchingTrack(query, topN);
              candidates.push(best);
              const topScore = trackRelevanceScore(query, best);
              // Early-exit only when ALL query words matched AND the winning
              // candidate is from YouTube (priority ≥ 2). SoundCloud candidates
              // are never allowed to short-circuit — we always wait for YouTube.
              if (topScore >= queryWordCount && topScore > 0 && platformPriority(best) >= 2) {
                finish(bestMatchingTrack(query, candidates));
                return;
              }
            }
          }
          // All primary sources responded — pick best effort even if no perfect match
          if (remaining === 0) finish(candidates.length ? bestMatchingTrack(query, candidates) : null);
        })
        .catch(() => {
          if (done) { remaining--; return; }
          remaining--;
          if (remaining === 0) finish(candidates.length ? bestMatchingTrack(query, candidates) : null);
        });
    }
  });

  if (ytResult) return ytResult;

  // Second attempt: YouTube Music. Only reached when ytsearch returned nothing.
  try {
    const ytm = await resolveWithTimeout(node, `ytmsearch:${query}`);
    if (ytm?.loadType === "search") {
      const tracks = (ytm.data as any[]).filter((t: any) => !isBadTrack(t));
      if (tracks.length) return bestMatchingTrack(query, tracks.slice(0, 5));
    }
  } catch { /* ytmsearch also empty */ }

  // Last resort: SoundCloud. Only reached when both YouTube sources returned
  // nothing (e.g. a very obscure track or YouTube region-block).
  try {
    const sc = await resolveWithTimeout(node, `scsearch:${query}`);
    if (sc?.loadType === "search") {
      const tracks = (sc.data as any[]).filter((t: any) => !isBadTrack(t));
      if (tracks.length) return bestMatchingTrack(query, tracks.slice(0, 5));
    }
  } catch { /* no fallback available */ }

  return null;
}

async function resolveSearchMultiple(node: any, query: string, limit: number): Promise<any[]> {
  // Fire ytsearch and ytmsearch concurrently. Promise.any resolves with the first
  // source that returns non-empty results — keeping us inside Discord's 3 s
  // autocomplete deadline instead of serially chaining 8 s timeouts.
  const searches = [...SEARCH_PREFIXES].map(prefix =>
    resolveWithTimeout(node, `${prefix}:${query}`)
      .then((result: any) => {
        if (result?.loadType === "search") {
          const tracks = (result.data as any[]).filter(t => !isBadTrack(t));
          if (tracks.length) return tracks.slice(0, limit);
        }
        throw new Error("no results");
      }),
  );

  try {
    return await Promise.any(searches);
  } catch { /* ytsearch came up empty — try ytmsearch next */ }

  // Second attempt: YouTube Music (reached when ytsearch returned nothing).
  try {
    const ytm = await resolveWithTimeout(node, `ytmsearch:${query}`);
    if (ytm?.loadType === "search") {
      const tracks = (ytm.data as any[]).filter(t => !isBadTrack(t));
      if (tracks.length) return tracks.slice(0, limit);
    }
  } catch { /* ytmsearch also empty */ }

  // Last resort: SoundCloud (only reached when both YouTube sources returned nothing).
  try {
    const sc = await resolveWithTimeout(node, `scsearch:${query}`);
    if (sc?.loadType === "search") {
      const tracks = (sc.data as any[]).filter(t => !isBadTrack(t));
      if (tracks.length) return tracks.slice(0, limit);
    }
  } catch { /* no fallback */ }
  return [];
}

// Walk every connected node until we find a search result, probing in quality
// order so the best node is tried first (same ranking as the resolver).
// The first two nodes are tried concurrently via Promise.any for speed;
// remaining nodes are tried serially as a last resort.
// Pass excludeNode to skip a node that is known to be failing (e.g. the player's
// current node during recovery so we always re-resolve on a fresh node).
async function resolveSearchAnyNode(query: string, excludeNode?: any): Promise<any | null> {
  const all = getNodesByQuality();
  if (!all.length) return null;
  const ordered = excludeNode ? all.filter(n => n !== excludeNode) : all;
  if (!ordered.length) return null;

  // Try the top two quality nodes concurrently — whichever wins first is used.
  const concurrent = ordered.slice(0, 2).map(node =>
    resolveSearch(node, query)
      .then(r => { if (!r) throw new Error("no result"); return r; })
      .catch(() => Promise.reject(new Error("no result"))),
  );
  try {
    const result = await Promise.any(concurrent);
    if (result) return result;
  } catch { /* both returned nothing — fall through to serial */ }

  for (const node of ordered.slice(2)) {
    try {
      const result = await resolveSearch(node, query);
      if (result) return result;
    } catch { /* try next node */ }
  }
  return null;
}

async function resolveSearchMultipleAnyNode(query: string, limit: number): Promise<any[]> {
  const ordered = getNodesByQuality();
  for (const node of ordered) {
    try {
      const result = await resolveSearchMultiple(node, query, limit);
      if (result.length) return result;
    } catch { /* try next node */ }
  }
  return [];
}

async function fetchSpotifyOEmbed(url: string): Promise<{ title: string; author: string } | null> {
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const data = await res.json() as { title?: string; author_name?: string };
    if (!data.title) return null;
    return { title: data.title, author: data.author_name ?? "" };
  } catch {
    return null;
  }
}

function rawToTrack(raw: any, requestedBy: string): QueueTrack {
  return {
    encoded: raw.encoded,
    title: raw.info.title,
    author: raw.info.author,
    uri: raw.info.uri,
    duration: raw.info.length,
    isStream: raw.info.isStream,
    requestedBy,
    artworkUrl: raw.info.artworkUrl ?? null,
  };
}

async function spotifyFallbackRaw(url: string): Promise<any | null> {
  const meta = await fetchSpotifyOEmbed(url);
  if (!meta) return null;
  const q = meta.author ? `${meta.author} ${meta.title}` : meta.title;
  return resolveSearchAnyNode(q);
}

async function fetchYouTubeOEmbed(url: string): Promise<{ title: string; author: string } | null> {
  try {
    const oe = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oe, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const data = await res.json() as { title?: string; author_name?: string };
    if (!data.title) return null;
    return { title: data.title, author: data.author_name ?? "" };
  } catch {
    return null;
  }
}

// YouTube URL fallback: fetch metadata via oEmbed, then do a text search.
// More reliable than ytsearch:URL across public nodes (most reject URL-shaped queries).
async function youTubeFallbackRaw(url: string): Promise<any | null> {
  const meta = await fetchYouTubeOEmbed(url);
  if (!meta) return null;
  const q = meta.author ? `${meta.author} ${meta.title}` : meta.title;
  return resolveSearchAnyNode(q);
}

export async function resolveTrack(
  query: string,
  requestedBy: string,
  fallbackQuery?: string,   // text search fallback when URI resolution fails
  excludeNode?: any,        // skip this node (e.g. the player's failing node during recovery)
): Promise<QueueTrack | null> {
  if (!shoukaku) throw new Error("Music not initialised.");

  // Prefer a node that isn't the known-failing one; fall back to ideal if nothing else available.
  const allNodes = getNodesByQuality();
  const freshNodes = excludeNode ? allNodes.filter(n => n !== excludeNode) : allNodes;
  const node = freshNodes[0] ?? shoukaku.getIdealNode();
  if (!node) throw new Error("No Lavalink nodes available.");

  const isUrl = /^https?:\/\//i.test(query);

  let raw: any = null;

  if (isUrl) {
    const result = await resolveWithTimeout(node, query).catch(() => null);
    if (result?.loadType === "search") {
      const tracks = (result.data as any[]).filter(t => !isDeezerTrack(t));
      if (tracks.length) raw = tracks[0];
    } else if (result?.loadType === "track") {
      raw = result.data;
    } else if (result?.loadType === "playlist") {
      const tracks = (result.data as any).tracks as any[];
      if (tracks.length) raw = tracks[0];
    }

    // Spotify URL fallback: oEmbed → multi-source search across all nodes
    if (!raw && /open\.spotify\.com/i.test(query)) {
      raw = await spotifyFallbackRaw(query);
    }

    // YouTube URL fallback: oEmbed → text search.
    // The old ytsearch:URL approach was unreliable — most public nodes reject URL-shaped queries.
    if (!raw && /youtu\.?be/i.test(query)) {
      raw = await youTubeFallbackRaw(query);
    }

    // Generic HTTP/HTTPS URL fallback — walk remaining nodes in quality order,
    // skipping both the initial node and the known-failing exclude node.
    if (!raw) {
      const fallbackPool = getNodesByQuality().filter(n => n !== node && n !== excludeNode);
      for (const n of fallbackPool) {
        try {
          const r = await resolveWithTimeout(n, query);
          if (r?.loadType === "track") { raw = r.data; break; }
          if (r?.loadType === "search") {
            const tracks = (r.data as any[]).filter(t => !isDeezerTrack(t));
            if (tracks.length) { raw = tracks[0]; break; }
          }
        } catch { /* try next */ }
      }
    }

    // URI resolution fully failed — if caller gave us a text fallback, use it
    if (!raw && fallbackQuery) {
      raw = await resolveSearchAnyNode(fallbackQuery, excludeNode);
    }
  } else {
    // Non-URL: search across all nodes, skipping the known-failing one
    raw = await resolveSearchAnyNode(query, excludeNode);
  }

  if (!raw) return null;
  return rawToTrack(raw, requestedBy);
}

export async function resolvePlaylist(
  query: string,
  requestedBy: string,
): Promise<{ tracks: QueueTrack[]; playlistName: string | null }> {
  if (!shoukaku) throw new Error("Music not initialised.");

  const node = shoukaku.getIdealNode();
  if (!node) throw new Error("No Lavalink nodes available.");

  const isUrl = /^https?:\/\//i.test(query);

  if (isUrl) {
    const result = await resolveWithTimeout(node, query).catch(() => null);

    if (result?.loadType === "playlist") {
      const data = result.data as any;
      const tracks: QueueTrack[] = (data.tracks as any[]).map(r => rawToTrack(r, requestedBy));
      return { tracks, playlistName: data.info?.name ?? null };
    }

    if (result?.loadType === "search") {
      const tracks = result.data as any[];
      if (tracks.length) return { tracks: [rawToTrack(tracks[0], requestedBy)], playlistName: null };
    }

    if (result?.loadType === "track") {
      return { tracks: [rawToTrack(result.data, requestedBy)], playlistName: null };
    }

    // Spotify URL fallback: oEmbed → multi-source search across all nodes
    if (/open\.spotify\.com/i.test(query)) {
      const meta = await fetchSpotifyOEmbed(query);
      if (meta) {
        const isPlaylistOrAlbum = /\/(playlist|album)\//i.test(query);
        const searchQ = meta.author ? `${meta.author} ${meta.title}` : meta.title;
        const raw = await resolveSearchAnyNode(searchQ);
        if (raw) {
          return {
            tracks: [rawToTrack(raw, requestedBy)],
            playlistName: isPlaylistOrAlbum ? meta.title : null,
          };
        }
      }
    }

    // YouTube URL fallback: oEmbed → text search (mirrors Spotify pattern)
    if (/youtu\.?be/i.test(query)) {
      const raw = await youTubeFallbackRaw(query);
      if (raw) return { tracks: [rawToTrack(raw, requestedBy)], playlistName: null };
    }

    // Generic fallback: try remaining nodes in quality order for any URL type.
    // resolvePlaylist previously never retried other nodes — this fills that gap.
    for (const n of getNodesByQuality().filter(n => n !== node)) {
      try {
        const r = await resolveWithTimeout(n, query);
        if (r?.loadType === "track") return { tracks: [rawToTrack(r.data, requestedBy)], playlistName: null };
        if (r?.loadType === "playlist") {
          const d = r.data as any;
          return { tracks: (d.tracks as any[]).map((t: any) => rawToTrack(t, requestedBy)), playlistName: d.info?.name ?? null };
        }
        if (r?.loadType === "search") {
          const tks = (r.data as any[]).filter((t: any) => !isDeezerTrack(t));
          if (tks.length) return { tracks: [rawToTrack(tks[0], requestedBy)], playlistName: null };
        }
      } catch { /* try next */ }
    }
  } else {
    // Non-URL: cascade ytmsearch → ytsearch → scsearch across all nodes
    const raw = await resolveSearchAnyNode(query);
    if (raw) return { tracks: [rawToTrack(raw, requestedBy)], playlistName: null };
  }

  return { tracks: [], playlistName: null };
}

// Shared helper: create a new queue + player for a guild
async function createQueue(
  guildId: string,
  voiceChannelId: string,
  textChannelId: string,
  shardId: number,
): Promise<GuildQueue> {
  const player = await shoukaku!.joinVoiceChannel({
    guildId,
    channelId: voiceChannelId,
    shardId,
    deaf: true,
  });

  const queue: GuildQueue = {
    player,
    tracks: [],
    current: null,
    volume: 100,
    loop: "none",
    voiceChannelId,
    textChannelId,
    autoplay: guildAutoplayPrefs.get(guildId) ?? false,
    recentSeeds: [],
    recentlyPlayedUris: [],
    isFetchingAutoplay: false,
    isAdvancing: false,
    isStopped: false,
    recoveryAttempts: 0,
    recoveryWindowStartedAt: 0,
    isRecovering: false,
    lastTrackStartedAt: 0,
    nodeUnhealthySince: 0,
    lastAutoMigrateAt: Date.now(),
    isAutoMigrating: false,
  };

  attachPlayerEvents(player, guildId);
  queues.set(guildId, queue);
  return queue;
}

// Wait for an in-progress join to complete and return the resulting queue
async function waitForJoin(guildId: string): Promise<GuildQueue | null> {
  return new Promise<GuildQueue | null>((resolve) => {
    const deadline = Date.now() + 5000;
    const interval = setInterval(() => {
      if (!joiningGuilds.has(guildId) || Date.now() > deadline) {
        clearInterval(interval);
        resolve(queues.get(guildId) ?? null);
      }
    }, 50);
  });
}

export async function joinAndPlay(
  guildId: string,
  voiceChannelId: string,
  textChannelId: string,
  track: QueueTrack,
  shardId = 0,
  forceQueue = false,
): Promise<"playing" | "queued"> {
  if (!shoukaku) throw new Error("Music not initialised.");

  let queue = queues.get(guildId);

  if (!queue) {
    if (joiningGuilds.has(guildId)) {
      const q = await waitForJoin(guildId);
      if (q) { q.tracks.push(track); return "queued"; }
    }

    joiningGuilds.add(guildId);
    try {
      queue = await createQueue(guildId, voiceChannelId, textChannelId, shardId);
    } finally {
      joiningGuilds.delete(guildId);
    }

    // Restore any frozen queue from a previous all-nodes-down outage.
    // Frozen tracks go AFTER the new track so the user's request plays first.
    const frozen = popFrozenQueue(guildId);
    if (frozen && frozen.tracks.length > 0) {
      queue.tracks.push(...frozen.tracks);
      queue.volume = frozen.volume;
      queue.loop = frozen.loop;
      queue.autoplay = frozen.autoplay;
      queue.recentSeeds = [...frozen.recentSeeds];
      queue.recentlyPlayedUris = [...frozen.recentlyPlayedUris];
      log(`[Music] Restored ${frozen.tracks.length} frozen track(s) for guild ${guildId}.`, "discord");
      textNotifyCallback?.(
        guildId,
        textChannelId,
        `🔁 restored ${frozen.tracks.length} frozen track${frozen.tracks.length === 1 ? "" : "s"} from before the outage.`,
      );
    }
  }

  // forceQueue is set when the caller snapshotted an active session before an
  // async resolution step. The session may have ended during resolution (race),
  // so we honour the caller's intent and queue rather than interrupt.
  if (forceQueue || queue.current || queue.player.paused || queue.isAdvancing) {
    queue.tracks.push(track);
    return "queued";
  }

  queue.current = track;
  await resetPlayerFilters(queue.player, guildId);
  await queue.player.playTrack({ track: { encoded: track.encoded } });
  await queue.player.setGlobalVolume(queue.volume);
  nowPlayingCallback?.(guildId, track, queue);
  return "playing";
}

export async function joinAndPlayMultiple(
  guildId: string,
  voiceChannelId: string,
  textChannelId: string,
  tracks: QueueTrack[],
  shardId = 0,
): Promise<"playing" | "queued"> {
  if (!shoukaku) throw new Error("Music not initialised.");
  if (!tracks.length) throw new Error("No tracks provided.");

  let queue = queues.get(guildId);

  if (!queue) {
    if (joiningGuilds.has(guildId)) {
      const q = await waitForJoin(guildId);
      if (q) { q.tracks.push(...tracks); return "queued"; }
    }

    joiningGuilds.add(guildId);
    try {
      queue = await createQueue(guildId, voiceChannelId, textChannelId, shardId);
    } finally {
      joiningGuilds.delete(guildId);
    }

    // Restore any frozen queue — frozen tracks go after the new batch.
    const frozen = popFrozenQueue(guildId);
    if (frozen && frozen.tracks.length > 0) {
      queue.tracks.push(...frozen.tracks);
      queue.volume = frozen.volume;
      queue.loop = frozen.loop;
      queue.autoplay = frozen.autoplay;
      queue.recentSeeds = [...frozen.recentSeeds];
      queue.recentlyPlayedUris = [...frozen.recentlyPlayedUris];
      log(`[Music] Restored ${frozen.tracks.length} frozen track(s) for guild ${guildId}.`, "discord");
      textNotifyCallback?.(
        guildId,
        textChannelId,
        `🔁 restored ${frozen.tracks.length} frozen track${frozen.tracks.length === 1 ? "" : "s"} from before the outage.`,
      );
    }
  }

  if (queue.current || queue.player.paused || queue.isAdvancing) {
    queue.tracks.push(...tracks);
    return "queued";
  }

  const [first, ...rest] = tracks;
  queue.tracks.push(...rest);
  queue.current = first;
  await queue.player.playTrack({ track: { encoded: first.encoded } });
  await queue.player.setGlobalVolume(queue.volume);
  nowPlayingCallback?.(guildId, first, queue);
  return "playing";
}

export async function addToFront(
  guildId: string,
  voiceChannelId: string,
  textChannelId: string,
  track: QueueTrack,
  shardId = 0,
): Promise<"playing" | "queued"> {
  if (!shoukaku) throw new Error("Music not initialised.");

  let queue = queues.get(guildId);

  if (!queue) {
    if (joiningGuilds.has(guildId)) {
      const q = await waitForJoin(guildId);
      if (q) { q.tracks.unshift(track); return "queued"; }
    }

    joiningGuilds.add(guildId);
    try {
      queue = await createQueue(guildId, voiceChannelId, textChannelId, shardId);
    } finally {
      joiningGuilds.delete(guildId);
    }
  }

  if (queue.current || queue.player.paused || queue.isAdvancing) {
    queue.tracks.unshift(track);
    return "queued";
  }

  queue.current = track;
  await queue.player.playTrack({ track: { encoded: track.encoded } });
  await queue.player.setGlobalVolume(queue.volume);
  nowPlayingCallback?.(guildId, track, queue);
  return "playing";
}

export async function skipTrack(guildId: string): Promise<QueueTrack | null> {
  const queue = queues.get(guildId);
  if (!queue || !queue.current) return null;
  const skipped = queue.current;
  // Clear current BEFORE stopTrack so the "stopped" end event doesn't mistake
  // this intentional skip for an unexpected mid-song drop and attempt recovery.
  queue.current = null;
  queue.recoveryAttempts = 0;
  await queue.player.stopTrack();
  return skipped;
}

export async function stopMusic(guildId: string): Promise<boolean> {
  const queue = queues.get(guildId);
  if (!queue) return false;
  queue.isStopped = true;
  queue.tracks = [];
  queue.current = null;
  queue.loop = "none";
  try { await queue.player.stopTrack(); } catch { /* ignore */ }
  try { await shoukaku?.leaveVoiceChannel(guildId); } catch { /* ignore */ }
  queues.delete(guildId);
  advanceDebounce.delete(guildId);
  queueStopCallback?.(guildId);
  return true;
}

export async function disconnectMusic(guildId: string): Promise<boolean> {
  return stopMusic(guildId);
}

export type ReconnectResult =
  | { ok: true; resumedAt: number; trackTitle: string | null; nodeName: string | null }
  | { ok: false; reason: "no-queue" | "no-node" | "rejoin-failed"; message: string };

// Force the bot to leave its current Lavalink node and rejoin voice on a fresh
// node, preserving the now-playing song (resumed from its last position) and
// the rest of the queue. Useful when playback feels rough but no error fired.
export async function reconnectMusic(guildId: string): Promise<ReconnectResult> {
  if (!shoukaku) {
    return { ok: false, reason: "no-node", message: "music engine not initialised." };
  }

  const queue = queues.get(guildId);
  if (!queue) {
    return { ok: false, reason: "no-queue", message: "i'm not playing anything in this server." };
  }

  const toResume = queue.current;
  const upcomingTracks = [...queue.tracks];
  const { voiceChannelId, textChannelId, volume, loop } = queue;
  const resumePositionMs = getResumePositionMs(queue, toResume);
  const previousNodeName: string | null =
    (queue.player as any)?.node?.name ?? (queue.player as any)?.options?.name ?? null;

  // Mark the existing queue stopped so its lingering events don't interfere,
  // then tear it down on Lavalink's side.
  queue.isStopped = true;
  try { await queue.player.stopTrack(); } catch { /* ignore */ }
  try { await shoukaku.leaveVoiceChannel(guildId); } catch { /* ignore */ }
  queues.delete(guildId);
  advanceDebounce.delete(guildId);

  // Tiny breather so Shoukaku finishes processing the disconnect before we rejoin.
  await new Promise<void>((r) => setTimeout(r, 750));

  const idealNode = shoukaku.getIdealNode();
  if (!idealNode) {
    return { ok: false, reason: "no-node", message: "no lavalink nodes are available right now." };
  }

  try {
    const newPlayer = await shoukaku.joinVoiceChannel({
      guildId,
      channelId: voiceChannelId,
      shardId: 0,
      deaf: true,
    });

    const newQueue: GuildQueue = {
      player: newPlayer,
      tracks: toResume ? [toResume, ...upcomingTracks] : upcomingTracks,
      current: null,
      volume,
      loop,
      voiceChannelId,
      textChannelId,
      resumePositionMs,
      autoplay: queue.autoplay,
      recentSeeds: [...queue.recentSeeds],
      recentlyPlayedUris: [...queue.recentlyPlayedUris],
      isFetchingAutoplay: false,
      isAdvancing: false,
      isStopped: false,
      recoveryAttempts: 0,
      recoveryWindowStartedAt: 0,
      isRecovering: false,
      lastTrackStartedAt: 0,
      nodeUnhealthySince: 0,
      lastAutoMigrateAt: Date.now(),
      isAutoMigrating: false,
    };

    attachPlayerEvents(newPlayer, guildId);
    queues.set(guildId, newQueue);

    const newNodeName: string | null =
      (newPlayer as any)?.node?.name ?? (newPlayer as any)?.options?.name ?? idealNode.name ?? null;
    log(
      `[Music] Manual reconnect for guild ${guildId}: ${previousNodeName ?? "unknown"} -> ${newNodeName ?? "unknown"}` +
      `${toResume ? ` (resuming "${toResume.title}" at ${formatDuration(resumePositionMs)})` : ""}.`,
      "discord",
    );

    await advanceQueue(newPlayer, guildId);

    return {
      ok: true,
      resumedAt: resumePositionMs,
      trackTitle: toResume?.title ?? null,
      nodeName: newNodeName,
    };
  } catch (err: any) {
    log(`[Music] Manual reconnect failed for guild ${guildId}: ${err.message}`, "discord");
    return { ok: false, reason: "rejoin-failed", message: err.message };
  }
}

export async function pauseMusic(guildId: string): Promise<boolean> {
  const queue = queues.get(guildId);
  if (!queue || !queue.current) return false;
  if (queue.player.paused) return false;
  await queue.player.setPaused(true);
  return true;
}

export async function resumeMusic(guildId: string): Promise<boolean> {
  const queue = queues.get(guildId);
  if (!queue || !queue.current) return false;
  if (!queue.player.paused) return false;
  await queue.player.setPaused(false);
  return true;
}

export async function setMusicVolume(
  guildId: string,
  volume: number,
): Promise<boolean> {
  const queue = queues.get(guildId);
  if (!queue) return false;
  queue.volume = Math.max(0, Math.min(100, volume));
  await queue.player.setGlobalVolume(queue.volume);
  return true;
}

export function shuffleQueue(guildId: string): boolean {
  const queue = queues.get(guildId);
  if (!queue || queue.tracks.length < 2) return false;
  for (let i = queue.tracks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
  }
  return true;
}

export function setLoop(guildId: string, mode: LoopMode): boolean {
  const queue = queues.get(guildId);
  if (!queue) return false;
  queue.loop = mode;
  return true;
}

export function cycleLoop(guildId: string): LoopMode | null {
  const queue = queues.get(guildId);
  if (!queue) return null;
  const next: Record<LoopMode, LoopMode> = { none: "track", track: "queue", queue: "none" };
  queue.loop = next[queue.loop];
  return queue.loop;
}

export function removeTrack(guildId: string, index: number): QueueTrack | null {
  const queue = queues.get(guildId);
  if (!queue || index < 1 || index > queue.tracks.length) return null;
  const [removed] = queue.tracks.splice(index - 1, 1);
  return removed ?? null;
}

export function moveTrack(guildId: string, from: number, to: number): boolean {
  const queue = queues.get(guildId);
  if (!queue) return false;
  if (from < 1 || from > queue.tracks.length) return false;
  if (to < 1 || to > queue.tracks.length) return false;
  if (from === to) return true;
  const [track] = queue.tracks.splice(from - 1, 1);
  queue.tracks.splice(to - 1, 0, track);
  return true;
}

export function clearQueue(guildId: string): number {
  const queue = queues.get(guildId);
  if (!queue) return 0;
  const count = queue.tracks.length;
  queue.tracks = [];
  return count;
}

export async function seekTrack(guildId: string, ms: number): Promise<boolean> {
  const queue = queues.get(guildId);
  if (!queue || !queue.current) return false;
  if (queue.current.isStream) return false;
  await queue.player.seekTo(ms);
  return true;
}

export async function skipToPosition(guildId: string, position: number): Promise<boolean> {
  const queue = queues.get(guildId);
  if (!queue) return false;
  if (position < 1 || position > queue.tracks.length) return false;
  // Drop all tracks before the target so it becomes first when advanceQueue runs
  queue.tracks.splice(0, position - 1);
  await skipTrack(guildId);
  return true;
}

export function removeDuplicates(guildId: string): number {
  const queue = queues.get(guildId);
  if (!queue) return 0;
  const seen = new Set<string>();
  if (queue.current) seen.add(queue.current.uri);
  const before = queue.tracks.length;
  queue.tracks = queue.tracks.filter((t) => {
    if (seen.has(t.uri)) return false;
    seen.add(t.uri);
    return true;
  });
  return before - queue.tracks.length;
}

export async function replayTrack(guildId: string): Promise<boolean> {
  const queue = queues.get(guildId);
  if (!queue || !queue.current) return false;
  try {
    await queue.player.seekTo(0);
    return true;
  } catch {
    return false;
  }
}

export function isLavalinkAvailable(): boolean {
  if (!shoukaku) return false;
  try {
    return Boolean(shoukaku.getIdealNode());
  } catch {
    return false;
  }
}

export function getLavalinkNodeCount(): number {
  if (!shoukaku) return 0;
  return shoukaku.nodes.size;
}

// Resolves a search query or URL via Lavalink and returns multiple encoded
// QueueTrack entries. Used by /dj for initial load and queue refills.
export async function resolveSearchResults(
  query: string,
  requestedBy: string,
  limit = 10,
): Promise<QueueTrack[]> {
  if (!shoukaku) return [];
  const node = shoukaku.getIdealNode();
  if (!node) return [];
  const identifier = /^https?:\/\//i.test(query) ? query : `ytsearch:${query}`;
  try {
    const result = await resolveWithTimeout(node, identifier);
    if (!result) return [];
    let raws: any[] = [];
    if (result.loadType === "search") raws = result.data as any[];
    else if (result.loadType === "playlist") raws = (result.data as any).tracks ?? [];
    else if (result.loadType === "track") raws = [result.data];
    return raws
      .filter((r: any) => r?.encoded && r.info && !r.info.isStream)
      .slice(0, limit)
      .map((raw: any) => ({
        encoded: raw.encoded,
        title: raw.info.title,
        author: raw.info.author,
        uri: raw.info.uri,
        duration: raw.info.length,
        isStream: false,
        requestedBy,
        artworkUrl: raw.info.artworkUrl ?? null,
      }));
  } catch {
    return [];
  }
}

export function getIdealLavalinkNode(): any | null {
  return shoukaku?.getIdealNode() ?? null;
}
