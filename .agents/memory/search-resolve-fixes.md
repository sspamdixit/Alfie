---
name: Search & resolve fixes
description: Root causes of wrong search results ("billie jean" playing wrong track) and music drops; design decisions for resolveWithTimeout and search prefix ordering.
---

## Wrong search results (the "billie jean" bug)

**Root cause:** `SEARCH_PREFIXES` put `ytmsearch` first. On public Lavalink nodes, `ytmsearch` is routed through LavaSrc → Deezer/YouTube Music, which returns covers or wrong artists. The early-exit threshold of `>= 1` (any single word matched) let a Billie Eilish track win over Michael Jackson's "Billie Jean" if ytmsearch responded first.

**Fix:**
- Reorder to `["ytsearch", "scsearch", "ytmsearch"]` — `ytsearch` (YouTube Search API) is deterministic and returns canonical results.
- Raise early-exit threshold in `resolveSearch` to `>= queryWordCount` — all query words must appear in the track before we fast-exit. For "billie jean" (2 words) both must match.

**Why:** `Promise.any`-style early-exit is intentional for speed, but the bar was too low. With `ytsearch` first and the correct threshold, the canonical result almost always wins.

## Music drops

**Root cause:** `node.rest.resolve()` calls had no timeout. A slow/dead public node could hang indefinitely, blocking the event loop and stalling `advanceQueue`.

**Fix:** `resolveWithTimeout(node, url, 8000)` wraps every `node.rest.resolve` call across: `resolveSearch`, `resolveSearchMultiple`, `fetchAutoplayTracks`, `resolveTrack` (all paths), `searchTracks`, `resolvePlaylist`.

## Stuck events not recovering

`attemptRecovery` previously only re-resolved on `exception` events. A `stuck` event (audio stream died mid-track) also needs a fresh encoded token — same fix path.

## resolveSearchAnyNode — parallel first-two nodes

Previously serial: node A times out at 8 s → wait → try node B. Now: first 2 nodes run concurrently via `Promise.any`; whichever returns a result first wins. Remaining nodes remain serial fallback.

**Why:** Public Lavalink node response times vary wildly. Concurrent first-two cuts worst-case search latency in half for the common case.

## Node-close recovery wait

Increased from 2.5 s to 4 s to give Shoukaku's internal reconnect bookkeeping time to settle before recovery tries to join voice on a different node.

## joinAndPlay filter reset

`joinAndPlay` first-play path now calls `resetPlayerFilters` before `playTrack`, matching `advanceQueue` behaviour. Prevents stale filter state (speed/pitch) on the very first track if a previous session left filters set.
