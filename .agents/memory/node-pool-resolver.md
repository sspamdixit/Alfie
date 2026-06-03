---
name: Node pool & resolver
description: Public Lavalink node list (12 nodes, verified weekly) and quality-based resolver replacing the old local-first approach.
---

## Node resolver redesign

**Old:** `localFirstNodeResolver` — always picked the local node if connected, regardless of its load.

**New:** `qualityNodeResolver` — all nodes compete equally on Shoukaku penalty score (CPU/memory/players). Cooling penalty (+1000 pts) applied to nodes that closed within the 20 s cooldown window.

**Why:** The local node on Render was auto-selected even when overloaded, blocking better public nodes. Now the resolver naturally selects the least-loaded node across the whole pool.

**How to apply:** `qualityNodeResolver` is passed as `nodeResolver` in the Shoukaku constructor. `getNodesByQuality()` (same ranking logic) is used in `resolveSearchAnyNode`, `resolveSearchMultipleAnyNode`, and the `resolveTrack` URL fallback.

## Node pool (12 nodes as of June 2025)

All sourced from Darren's weekly-checked list (lavalink.darrennathanael.com) or AjieDev/Free-Lavalink:

| Name | URL | Auth | SSL | Region |
|------|-----|------|-----|--------|
| serenetia-v4 | lavalinkv4.serenetia.com:443 | https://seretia.link/discord | yes | Indonesia |
| darren | lavalink.darrennathanael.com:443 | Yonkotsu!Pinggir!Pantai | yes | Indonesia |
| millohost | lava-v4.millohost.my.id:443 | https://discord.gg/mjS5J2K3ep | yes | Indonesia |
| nyxbot-sg1/sg2 | sg1/sg2-nodelink.nyxbot.app:3000 | nyxbot.app/support | no | Singapore |
| nexcloud-in | n3.nexcloud.in:2026 | nexcloud | no | India |
| devamop | lavalink.devamop.in:80 | DevamOP | no | India |
| g3v-uk | lava.g3v.co.uk:9008 | lavalinklol | no | UK (opusQ=10, HIGH resample) |
| vexanode-us | omega.vexanode.cloud:2031 | https://discord.vexanode.cloud | no | Miami US |
| tririum-ssl | lavalink-v4.triniumhost.com:443 | free | yes | TriniumHost |
| tririum-nossl | lavalink.triniumhost.com:4333 | free | no | TriniumHost |
| jirayu | lavalink.jirayu.net:443 | youshallnotpass | yes | Thailand (cycles) |

## Key notes

- Serenetia auth changed from `https://dsc.gg/ajidevserver` → `https://seretia.link/discord` (June 2025)
- Jirayu kept but kept last in list; known to cycle with 1006 closes
- G3V (UK) notable for highest audio quality encoding settings
- NexCloud has lavasrc plugin — supports Spotify/Apple Music/Deezer resolution
