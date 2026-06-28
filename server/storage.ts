import { db } from "./db";
import { users, botMeta, savedPlaylists, playlistTracks, songPlays, guildSettings } from "@shared/schema";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { type User, type InsertUser, type SavedPlaylist, type PlaylistTrack, type GuildSettingsRow } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getBotMeta(key: string): Promise<string | null>;
  setBotMeta(key: string, value: string): Promise<void>;
  getPlaylists(userId: string, guildId: string): Promise<SavedPlaylist[]>;
  getPlaylist(userId: string, guildId: string, name: string): Promise<SavedPlaylist | undefined>;
  createPlaylist(userId: string, guildId: string, name: string): Promise<SavedPlaylist>;
  deletePlaylist(userId: string, guildId: string, name: string): Promise<boolean>;
  getPlaylistTracks(playlistId: number): Promise<PlaylistTrack[]>;
  setPlaylistTracks(playlistId: number, tracks: Omit<PlaylistTrack, "id" | "playlistId">[]): Promise<void>;
  // Listening stats
  recordSongPlay(guildId: string, uri: string, title: string, author: string, requestedBy: string): Promise<void>;
  getTopTracks(guildId: string, limit?: number): Promise<Array<{ uri: string; title: string; author: string; playCount: number }>>;
  getGuildPlayStats(guildId: string): Promise<{ totalPlays: number; uniqueTracks: number }>;
  getGlobalPlayStats(): Promise<{ totalPlays: number; uniqueTracks: number; topGuilds: Array<{ guildId: string; plays: number }> }>;
  // Guild settings
  getGuildSettings(guildId: string): Promise<GuildSettingsRow | null>;
  getAllGuildSettings(): Promise<GuildSettingsRow[]>;
  setRequestChannel(guildId: string, channelId: string | null): Promise<void>;
  setGuildCrossfade(guildId: string, seconds: number): Promise<void>;
}

export async function ensurePlaylistTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS saved_playlists (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id SERIAL PRIMARY KEY,
      playlist_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      encoded TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      uri TEXT NOT NULL,
      duration INTEGER NOT NULL,
      artwork_url TEXT
    )
  `);
}

let playlistTablesReady = false;
async function ensurePlaylistTablesOnce(): Promise<void> {
  if (playlistTablesReady) return;
  await ensurePlaylistTables();
  playlistTablesReady = true;
}

export class DrizzleStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const result = await db.insert(users).values({ ...insertUser, id }).returning();
    return result[0];
  }

  async getBotMeta(key: string): Promise<string | null> {
    await ensureBotMetaTable();
    const result = await db.select().from(botMeta).where(eq(botMeta.key, key)).limit(1);
    return result[0]?.value ?? null;
  }

  async setBotMeta(key: string, value: string): Promise<void> {
    await ensureBotMetaTable();
    await db
      .insert(botMeta)
      .values({ key, value })
      .onConflictDoUpdate({ target: botMeta.key, set: { value } });
  }

  async getPlaylists(userId: string, guildId: string): Promise<SavedPlaylist[]> {
    await ensurePlaylistTablesOnce();
    return db
      .select()
      .from(savedPlaylists)
      .where(and(eq(savedPlaylists.userId, userId), eq(savedPlaylists.guildId, guildId)));
  }

  async getPlaylist(userId: string, guildId: string, name: string): Promise<SavedPlaylist | undefined> {
    await ensurePlaylistTablesOnce();
    const result = await db
      .select()
      .from(savedPlaylists)
      .where(
        and(
          eq(savedPlaylists.userId, userId),
          eq(savedPlaylists.guildId, guildId),
          eq(savedPlaylists.name, name),
        ),
      )
      .limit(1);
    return result[0];
  }

  async createPlaylist(userId: string, guildId: string, name: string): Promise<SavedPlaylist> {
    await ensurePlaylistTablesOnce();
    const result = await db
      .insert(savedPlaylists)
      .values({ userId, guildId, name })
      .returning();
    return result[0];
  }

  async deletePlaylist(userId: string, guildId: string, name: string): Promise<boolean> {
    await ensurePlaylistTablesOnce();
    const playlist = await this.getPlaylist(userId, guildId, name);
    if (!playlist) return false;
    await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, playlist.id));
    const result = await db
      .delete(savedPlaylists)
      .where(eq(savedPlaylists.id, playlist.id))
      .returning();
    return result.length > 0;
  }

  async getPlaylistTracks(playlistId: number): Promise<PlaylistTrack[]> {
    await ensurePlaylistTablesOnce();
    return db
      .select()
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId))
      .orderBy(playlistTracks.position);
  }

  async setPlaylistTracks(
    playlistId: number,
    tracks: Omit<PlaylistTrack, "id" | "playlistId">[],
  ): Promise<void> {
    await ensurePlaylistTablesOnce();
    await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, playlistId));
    if (!tracks.length) return;
    await db.insert(playlistTracks).values(
      tracks.map((t) => ({ ...t, playlistId })),
    );
  }
}

let botMetaTableReady = false;
async function ensureBotMetaTable(): Promise<void> {
  if (botMetaTableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bot_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  botMetaTableReady = true;
}

// ── New-tables bootstrap ──────────────────────────────────────────────────────
let extraTablesReady = false;
async function ensureExtraTablesOnce(): Promise<void> {
  if (extraTablesReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS song_plays (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      uri TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS sp_guild ON song_plays(guild_id)`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      request_channel_id TEXT,
      crossfade_seconds INTEGER NOT NULL DEFAULT 0
    )
  `);
  extraTablesReady = true;
}

// ── DrizzleStorage — listening stats & guild settings ────────────────────────
// Append to the class above; TypeScript merges with the prototype chain
Object.assign(DrizzleStorage.prototype, {
  async recordSongPlay(guildId: string, uri: string, title: string, author: string, requestedBy: string): Promise<void> {
    await ensureExtraTablesOnce();
    await db.insert(songPlays).values({ guildId, uri, title, author, requestedBy });
  },

  async getTopTracks(guildId: string, limit = 10): Promise<Array<{ uri: string; title: string; author: string; playCount: number }>> {
    await ensureExtraTablesOnce();
    const rows = await db
      .select({
        uri: songPlays.uri,
        title: songPlays.title,
        author: songPlays.author,
        playCount: count(songPlays.id),
      })
      .from(songPlays)
      .where(eq(songPlays.guildId, guildId))
      .groupBy(songPlays.uri, songPlays.title, songPlays.author)
      .orderBy(desc(count(songPlays.id)))
      .limit(limit);
    return rows.map(r => ({ ...r, playCount: Number(r.playCount) }));
  },

  async getGuildPlayStats(guildId: string): Promise<{ totalPlays: number; uniqueTracks: number }> {
    await ensureExtraTablesOnce();
    const [totalRow] = await db
      .select({ total: count(songPlays.id) })
      .from(songPlays)
      .where(eq(songPlays.guildId, guildId));
    const [uniqueRow] = await db.execute(
      sql`SELECT COUNT(DISTINCT uri) AS unique_tracks FROM song_plays WHERE guild_id = ${guildId}`
    );
    return {
      totalPlays: Number(totalRow?.total ?? 0),
      uniqueTracks: Number((uniqueRow as any)?.unique_tracks ?? 0),
    };
  },

  async getGlobalPlayStats(): Promise<{ totalPlays: number; uniqueTracks: number; topGuilds: Array<{ guildId: string; plays: number }> }> {
    await ensureExtraTablesOnce();
    const [totalRow] = await db.select({ total: count(songPlays.id) }).from(songPlays);
    const [uniqueRow] = await db.execute(sql`SELECT COUNT(DISTINCT uri) AS unique_tracks FROM song_plays`);
    const guildRows = await db
      .select({ guildId: songPlays.guildId, plays: count(songPlays.id) })
      .from(songPlays)
      .groupBy(songPlays.guildId)
      .orderBy(desc(count(songPlays.id)))
      .limit(10);
    return {
      totalPlays: Number(totalRow?.total ?? 0),
      uniqueTracks: Number((uniqueRow as any)?.unique_tracks ?? 0),
      topGuilds: guildRows.map(r => ({ guildId: r.guildId, plays: Number(r.plays) })),
    };
  },

  async getGuildSettings(guildId: string): Promise<GuildSettingsRow | null> {
    await ensureExtraTablesOnce();
    const rows = await db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1);
    return rows[0] ?? null;
  },

  async getAllGuildSettings(): Promise<GuildSettingsRow[]> {
    await ensureExtraTablesOnce();
    return db.select().from(guildSettings);
  },

  async setRequestChannel(guildId: string, channelId: string | null): Promise<void> {
    await ensureExtraTablesOnce();
    await db
      .insert(guildSettings)
      .values({ guildId, requestChannelId: channelId, crossfadeSeconds: 0 })
      .onConflictDoUpdate({ target: guildSettings.guildId, set: { requestChannelId: channelId } });
  },

  async setGuildCrossfade(guildId: string, seconds: number): Promise<void> {
    await ensureExtraTablesOnce();
    await db
      .insert(guildSettings)
      .values({ guildId, crossfadeSeconds: seconds })
      .onConflictDoUpdate({ target: guildSettings.guildId, set: { crossfadeSeconds: seconds } });
  },
} satisfies Pick<IStorage, "recordSongPlay" | "getTopTracks" | "getGuildPlayStats" | "getGlobalPlayStats" | "getGuildSettings" | "getAllGuildSettings" | "setRequestChannel" | "setGuildCrossfade">);

export const storage = new DrizzleStorage();
