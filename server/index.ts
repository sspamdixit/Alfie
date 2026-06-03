import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startAlessa, getAlessaBotStatus } from "../alessa/bot";
import { initSocket } from "./socket";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

const app = express();
const httpServer = createServer(app);

process.on("unhandledRejection", (reason) => {
  log(`Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`, "process");
});

process.on("uncaughtException", (err) => {
  log(`Uncaught exception: ${err.message}`, "process");
});

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("X-Frame-Options", "DENY");
  }
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  const forwardedProto = req.get("x-forwarded-proto");
  const isSecure = req.secure || forwardedProto === "https";
  if (process.env.NODE_ENV === "production" && isSecure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
});

const sessionSecret = process.env.SESSION_SECRET ?? "alessa-dev-secret-change-in-prod";
app.use(
  session({
    secret: sessionSecret,
    store: new MemoryStore({ checkPeriod: 86400000 }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
    name: "alessa.sid",
  }),
);

initSocket(httpServer);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "16kb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "16kb" }));

app.get("/health", (_req, res) => {
  const bot = getAlessaBotStatus();
  res.status(200).json({
    status: "ok",
    bot: {
      online: bot.online,
      status: bot.status,
      tag: bot.tag,
      uptime: bot.uptimeStart ? Math.floor((Date.now() - bot.uptimeStart) / 1000) : null,
    },
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

function startKeepAlive() {
  const serviceUrl = (
    process.env.RENDER_EXTERNAL_URL ??
    process.env.SERVICE_URL ??
    ""
  ).trim().replace(/\/$/, "");

  if (!serviceUrl) {
    log("No RENDER_EXTERNAL_URL or SERVICE_URL set — keep-alive disabled.", "keep-alive");
    return;
  }

  const pingUrl = `${serviceUrl}/health`;
  // 5-minute interval gives 3× safety margin inside Render's 15-min spin-down window.
  const INTERVAL_MS = 5 * 60 * 1000;

  log(`Keep-alive active → pinging ${pingUrl} every 5 min`, "keep-alive");

  const keepAliveTimer = setInterval(async () => {
    try {
      const res = await fetch(pingUrl, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) log(`Keep-alive ping returned ${res.status}`, "keep-alive");
    } catch (err: any) {
      log(`Keep-alive ping failed: ${err.message}`, "keep-alive");
    }
  }, INTERVAL_MS);
  keepAliveTimer.unref?.();
}

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      if (process.env.ENABLE_ALESSA === "true" || process.env.ENABLE_ALFIE === "true") {
        startAlessa();
      } else {
        log("Alessa auto-start disabled. Set ENABLE_ALESSA=true to start.", "alessa");
      }
      if (process.env.NODE_ENV === "production") {
        startKeepAlive();
      }
    },
  );

  const shutdown = () => {
    log("SIGTERM received — shutting down gracefully.", "express");
    httpServer.close(() => {
      log("HTTP server closed.", "express");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
})();
