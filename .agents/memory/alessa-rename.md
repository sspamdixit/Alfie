---
name: Alessa rename
description: Full Alfie→Alessa rename — what changed, what's backward-compat, and key wiring decisions.
---

## Rule
The bot is named **Alessa** everywhere. All user-visible text, code symbols, API routes, session keys, and file paths use `alessa` / `Alessa`.

**Why:** User requested a full rename from Alfie to Alessa across the entire codebase.

**How to apply:** Any new code, routes, or display text must use `alessa`/`Alessa`. Do not reintroduce `alfie`/`Alfie` in new code.

## What changed
- Bot folder: `alfie/` → `alessa/`
- Interface: `AlfieBotStatus` → `AlessaBotStatus`
- Functions: `startAlfie` → `startAlessa`, `stopAlfie` → `stopAlessa`, `getAlfieBotStatus` → `getAlessaBotStatus`, `getAlfieGuilds` → `getAlessaGuilds`
- API route: `/api/alfie/status` → `/api/alessa/status`
- Session cookie: `alfie.sid` → `alessa.sid`
- Storage keys: `alfie-dashboard-auth-token` → `alessa-dashboard-auth-token`, `alfie-authed` → `alessa-authed`, `alfie-auth-changed` → `alessa-auth-changed`
- TTS author: `"Alfie TTS"` → `"Alessa TTS"`
- DJ prompt: `"You are Alfie"` → `"You are Alessa"`

## Backward compatibility kept
- `ALESSA_TOKEN` is checked first; falls back to `ALFIE_TOKEN` then `DISCORD_TOKEN`
- `ENABLE_ALESSA=true` OR `ENABLE_ALFIE=true` both trigger auto-start (existing Replit env var `ENABLE_ALFIE` still works)
