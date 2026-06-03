---
name: Node pool & resolver
description: How Lavalink nodes are configured and selected at runtime.
---

## Node resolver redesign

**Old:** `localFirstNodeResolver` — always picked the local node if connected, regardless of its load.

**New:** `qualityNodeResolver` — all nodes compete equally on Shoukaku penalty score (CPU/memory/players). Cooling penalty (+1000 pts) applied to nodes that closed within the 20 s cooldown window.

**Why:** The local node on Render was auto-selected even when overloaded, blocking better nodes. Now the resolver naturally selects the least-loaded node.

**How to apply:** `qualityNodeResolver` is passed as `nodeResolver` in the Shoukaku constructor. `getNodesByQuality()` (same ranking logic) is used in `resolveSearchAnyNode`, `resolveSearchMultipleAnyNode`, and the `resolveTrack` URL fallback.

## Node configuration

Nodes are sourced entirely from environment variables — no credentials live in source:

| Env var | Purpose |
|---------|---------|
| `LAVALINK_URL` | Host:port of the primary node |
| `LAVALINK_PASSWORD` or `LAVALINK_AUTH` | Password for the primary node |
| `LAVALINK_SECURE` | `true` for WSS, omit/`false` for WS |
| `LAVALINK_NODES` | JSON array for additional nodes (see format below) |

### `LAVALINK_NODES` format
```json
[
  { "name": "node-1", "url": "host:port", "auth": "password", "secure": true },
  { "name": "node-2", "url": "host:port", "auth": "password", "secure": false }
]
```

Public community Lavalink node lists (updated regularly):
- https://lavalink.darrennathanael.com
- https://nodes.lavalink.rf.gd

## Key notes

- Nodes with no stats yet (still connecting) are deprioritized to the non-stats pool but still eligible.
- `recentlyClosedNodes` map applies a 20 s cooldown penalty after an abnormal close.
- No hardcoded fallback pool exists — if no env vars are set, music is unavailable and a log message explains why.
