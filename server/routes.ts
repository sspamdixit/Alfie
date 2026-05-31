import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { type Server } from "http";
import { createHash, timingSafeEqual } from "crypto";
import rateLimit from "express-rate-limit";
import { getAlfieBotStatus, getAlfieGuilds } from "../alfie/bot";
import { isLavalinkAvailable, getLavalinkNodeCount } from "./music";
import { getDjStatus } from "./dj";
import { z } from "zod";
import { DASHBOARD_AUTH_HEADER, issueAuthToken, isAuthTokenValid } from "./auth";
import {
  getOAuthUrl,
  exchangeCode,
  fetchDiscordUser,
  fetchDiscordGuilds,
  getBotInviteUrl,
  getAvatarUrl,
  getGuildIconUrl,
  hasManageGuild,
} from "./discord-oauth";

declare module "express-session" {
  interface SessionData {
    discordUserId?: string;
    discordUsername?: string;
    discordGlobalName?: string | null;
    discordAvatar?: string | null;
    discordAvatarUrl?: string;
    accessToken?: string;
  }
}

const PROCESS_START_TIME = Date.now();

const authSchema = z.object({
  password: z.string().min(1),
});

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again later." },
});
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
});

function safePasswordEquals(input: string, expected: string): boolean {
  const inputDigest = createHash("sha256").update(input).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(inputDigest, expectedDigest);
}

function ensureApiAuthorized(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/auth") {
    return next();
  }
  const providedToken = req.get(DASHBOARD_AUTH_HEADER);
  if (!providedToken || !isAuthTokenValid(providedToken)) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  return next();
}

function ensureDiscordAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.discordUserId) {
    return res.status(401).json({ error: "Discord login required." });
  }
  return next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use("/api", apiRateLimiter);

  // ── TTS audio proxy — Lavalink fetches this to play TTS ───────────────────
  app.get("/tts-audio", async (req: Request, res: Response) => {
    const text = ((req.query.text as string) ?? "").trim().slice(0, 450);
    if (!text) { res.status(400).end(); return; }
    const url = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text)}`;
    try {
      const upstream = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!upstream.ok) { res.status(502).end(); return; }
      res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "audio/mpeg");
      const cl = upstream.headers.get("content-length");
      if (cl) res.setHeader("Content-Length", cl);
      res.setHeader("Cache-Control", "no-store");
      const buf = await upstream.arrayBuffer();
      res.end(Buffer.from(buf));
    } catch {
      res.status(502).end();
    }
  });

  // ── Discord OAuth ─────────────────────────────────────────────────────────

  app.get("/api/oauth/discord", (req, res) => {
    try {
      const url = getOAuthUrl(req);
      res.redirect(url);
    } catch (err: any) {
      res.status(503).json({ error: err.message });
    }
  });

  app.get("/api/oauth/discord/callback", async (req, res) => {
    const code = req.query.code as string | undefined;
    if (!code) {
      return res.redirect("/?error=no_code");
    }
    const accessToken = await exchangeCode(code, req);
    if (!accessToken) {
      return res.redirect("/?error=token_exchange");
    }
    const user = await fetchDiscordUser(accessToken);
    if (!user) {
      return res.redirect("/?error=user_fetch");
    }
    req.session.discordUserId = user.id;
    req.session.discordUsername = user.username;
    req.session.discordGlobalName = user.global_name;
    req.session.discordAvatar = user.avatar;
    req.session.discordAvatarUrl = getAvatarUrl(user);
    req.session.accessToken = accessToken;
    return res.redirect("/servers");
  });

  app.get("/api/oauth/me", (req, res) => {
    if (!req.session?.discordUserId) {
      return res.status(401).json({ error: "Not logged in." });
    }
    return res.json({
      id: req.session.discordUserId,
      username: req.session.discordUsername,
      global_name: req.session.discordGlobalName,
      avatar: req.session.discordAvatar,
      avatarUrl: req.session.discordAvatarUrl,
    });
  });

  app.post("/api/oauth/logout", (req, res) => {
    req.session.destroy(() => {});
    res.json({ ok: true });
  });

  // ── Public guild routes (requires Discord OAuth) ──────────────────────────

  app.get("/api/public/guilds", ensureDiscordAuth, async (req, res) => {
    const accessToken = req.session.accessToken;
    if (!accessToken) {
      return res.status(401).json({ error: "No access token." });
    }
    const discordGuilds = await fetchDiscordGuilds(accessToken);
    const managed = discordGuilds.filter((g) => hasManageGuild(g.permissions));

    const alfieGuildIds = new Set(getAlfieGuilds().map((g) => g.id));

    const guilds = managed.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      iconUrl: getGuildIconUrl(g),
      owner: g.owner,
      permissions: g.permissions,
      hasAlfie: alfieGuildIds.has(g.id),
    }));

    guilds.sort((a, b) => {
      if (a.hasAlfie && !b.hasAlfie) return -1;
      if (!a.hasAlfie && b.hasAlfie) return 1;
      return a.name.localeCompare(b.name);
    });

    return res.json({ guilds });
  });

  app.get("/api/public/guilds/:guildId/info", ensureDiscordAuth, async (req, res) => {
    const { guildId } = req.params;
    const accessToken = req.session.accessToken;
    if (!accessToken) {
      return res.status(401).json({ error: "No access token." });
    }
    const discordGuilds = await fetchDiscordGuilds(accessToken);
    const guild = discordGuilds.find((g) => g.id === guildId);
    if (!guild || !hasManageGuild(guild.permissions)) {
      return res.status(403).json({ error: "Access denied." });
    }
    const hasAlfie = getAlfieGuilds().some((g) => g.id === guildId);
    return res.json({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      iconUrl: getGuildIconUrl(guild),
      owner: guild.owner,
      hasAlfie,
    });
  });

  app.get("/api/public/invite-url", (req, res) => {
    const guildId = req.query.guild_id as string | undefined;
    try {
      const url = getBotInviteUrl(guildId);
      if (req.query.guild_id) {
        return res.redirect(url);
      }
      return res.json({ url });
    } catch (err: any) {
      return res.status(503).json({ error: err.message });
    }
  });

  // ── Admin dashboard auth ──────────────────────────────────────────────────

  app.post("/api/auth", authRateLimiter, (req, res) => {
    const parsed = authSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Password required." });
    }
    const dashboardPassword = process.env.DASHBOARD_PASSWORD;
    if (!dashboardPassword) {
      return res.status(503).json({ error: "DASHBOARD_PASSWORD is not configured on the server." });
    }
    if (!safePasswordEquals(parsed.data.password, dashboardPassword)) {
      return res.status(401).json({ error: "Incorrect password." });
    }
    const token = issueAuthToken();
    return res.json({ ok: true, token });
  });

  app.use("/api", ensureApiAuthorized);

  // ── Alfie bot status ──────────────────────────────────────────────────────

  app.get("/api/alfie/status", (_req, res) => {
    res.json(getAlfieBotStatus());
  });

  // ── DJ / Rave status ──────────────────────────────────────────────────────

  app.get("/api/dj/status", (_req, res) => {
    return res.json({
      sessions: getDjStatus(),
      lavalink: { available: isLavalinkAvailable(), nodeCount: getLavalinkNodeCount() },
      updatedAt: Date.now(),
    });
  });

  // ── Service health ────────────────────────────────────────────────────────

  app.get("/api/service/health", (_req, res) => {
    return res.json({
      processStartTime: PROCESS_START_TIME,
      uptimeMs: Date.now() - PROCESS_START_TIME,
    });
  });

  return httpServer;
}
