---
name: Node pool & resolver
description: How Lavalink nodes are configured, selected, and kept alive at runtime.
---

## Node resolver

`qualityNodeResolver` — all nodes compete equally on Shoukaku penalty score (CPU/memory/players). Nodes that closed abnormally within a 20 s cooldown window receive +1000 penalty so they are tried last.

`getNodesByQuality()` (same ranking logic) is used inside `resolveSearchAnyNode`, `resolveSearchMultipleAnyNode`, `resolveTrack`, and `searchTracks` so the selection is always consistent.

## Node configuration

| Env var | Purpose |
|---------|---------|
| `LAVALINK_NODES` | JSON array — overrides the built-in public pool entirely |
| `LAVALINK_URL` | **Ignored** — single-URL support was removed; use `LAVALINK_NODES` |

If neither is set, the 14-entry `PUBLIC_NODE_POOL` constant in `server/music.ts` is used automatically.

### `LAVALINK_NODES` format
```json
[
  { "name": "node-1", "url": "host:port", "auth": "password", "secure": true }
]
```

## Reconnect / pool stability

**Why:** With `reconnectTries: 5` the entire 14-node public pool could be permanently evicted in minutes (5 tries × ~10 s apart = ~50 s per node). Once `shoukaku.nodes` is empty, every search throws "No Lavalink nodes available." — "music went boom".

**Fix applied:**
- `reconnectTries: 999` — nodes retry for hours before being evicted.
- `reconnectInterval: 10` (seconds between retries).
- Pool guardian runs every 90 s: if `shoukaku.nodes.size === 0`, it removes all listeners and calls `initMusic` again to bootstrap a fresh Shoukaku instance. `_musicClient` is retained for this re-init.

## searchTracks consistency fix

`searchTracks` previously called `shoukaku.getIdealNode()` which only returns **connected** nodes. During startup or after an outage, all nodes may be registered but not yet connected, making `getIdealNode()` return null and autocomplete show zero results.

**Fix:** `searchTracks` now uses `getNodesByQuality()` (same as `resolveTrack`) with `shoukaku.getIdealNode()` as fallback. This keeps both code paths consistent.

## Key rule

> Any code path that picks a node for search or playback must use `getNodesByQuality()` (not `shoukaku.getIdealNode()` alone) so unconnected-but-registered nodes are still reachable and the selection logic matches the resolver.
