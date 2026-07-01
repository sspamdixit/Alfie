import { db } from "./db";
import { users, botMeta, savedPlaylists, playlistTracks, songPlays, guildSettings } from "@shared/schema";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { type User, type InsertUser, type SavedPlaylist, type PlaylistTrack, type GuildSettingsRow } from "@shared/schema";
import { randomUUID } from "crypto";

export interface Guild247Row {
  guildId: string;
  voiceChannelId: string | null;
  textChannelId: string | null;
  shardId: number;
  frozenQueueJson: string | null;
}

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
  getTopTracks(guildId: string, limit?: number): Promise<Array<{ trackUri: string; trackTitle: string; trackArtist: string; playCount: number }>>;
  getGuildPlayStats(guildId: string): Promise<{ totalPlays: number; uniqueTracks: number }>;
  getGlobalPlayStats(): Promise<{ totalPlays: number; uniqueTracks: number; topGuilds: Array<{ guildId: string; plays: number }> }>;
  // Guild settings
  getGuildSettings(guildId: string): Promise<GuildSettingsRow | null>;
  getAllGuildSettings(): Promise<GuildSettingsRow[]>;
  setRequestChannel(guildId: string, channelId: string | null): Promise<void>;
  setGuildCrossfade(guildId: string, seconds: number): Promise<void>;
  // 24/7 persistence
  set247On(guildId: string): Promise<void>;
  set247Off(guildId: string): Promise<void>;
  set247IdleState(guildId: string, voiceChannelId: string, textChannelId: string, shardId: number, frozenQueueJson: string | null): Promise<void>;
  clear247FrozenQueue(guildId: string): Promise<void>;
  getAll247Guilds(): Promise<Guild247Row[]>;
}

export async function ensurePlaylistTables(): Promise<void> {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS saved_playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

let botMetaTableReady = false;
async function ensureBotMetaTable(): Promise<void> {
  if (botMetaTableReady) return;
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS bot_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  botMetaTableReady = true;
}

let extraTablesReady = false;
async function ensureExtraTablesOnce(): Promise<void> {
  if (extraTablesReady) return;
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS song_plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      uri TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      played_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);
  await db.run(sql`CREATE INDEX IF NOT EXISTS sp_guild ON song_plays(guild_id)`);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      request_channel_id TEXT,
      crossfade_seconds INTEGER NOT NULL DEFAULT 0
    )
  `);
  extraTablesReady = true;
}

let guild247ColumnsReady = false;
async function ensure247ColumnsOnce(): Promise<void> {
  if (guild247ColumnsReady) return;
  await ensureExtraTablesOnce();
  // SQLite doesn't support IF NOT EXISTS on ALTER TABLE — wrap each in try/catch
  for (const ddl of [
    `ALTER TABLE guild_settings ADD COLUMN mode_247 INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE guild_settings ADD COLUMN voice_channel_247 TEXT`,
    `ALTER TABLE guild_settings ADD COLUMN text_channel_247 TEXT`,
    `ALTER TABLE guild_settings ADD COLUMN shard_id_247 INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE guild_settings ADD COLUMN frozen_queue_247 TEXT`,
  ]) {
    try { await db.run(sql.raw(ddl)); } catch { /* column already exists */ }
  }
  guild247ColumnsReady = true;
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

  // ── Listening stats ─────────────────────────────────────────────────────────

  async recordSongPlay(guildId: string, uri: string, title: string, author: string, requestedBy: string): Promise<void> {
    await ensureExtraTablesOnce();
    await db.insert(songPlays).values({ guildId, uri, title, author, requestedBy });
  }

  async getTopTracks(guildId: string, limit = 10): Promise<Array<{ trackUri: string; trackTitle: string; trackArtist: string; playCount: number }>> {
    await ensureExtraTablesOnce();
    const rows = await db
      .select({
        trackUri: songPlays.uri,
        trackTitle: songPlays.title,
        trackArtist: songPlays.author,
        playCount: count(songPlays.id),
      })
      .from(songPlays)
      .where(eq(songPlays.guildId, guildId))
      .groupBy(songPlays.uri, songPlays.title, songPlays.author)
      .orderBy(desc(count(songPlays.id)))
      .limit(limit);
    return rows.map(r => ({ ...r, playCount: Number(r.playCount) }));
  }

  async getGuildPlayStats(guildId: string): Promise<{ totalPlays: number; uniqueTracks: number }> {
    await ensureExtraTablesOnce();
    const [totalRow] = await db
      .select({ total: count(songPlays.id) })
      .from(songPlays)
      .where(eq(songPlays.guildId, guildId));
    const [uniqueRow] = await db
      .select({ uniqueTracks: sql<number>`COUNT(DISTINCT ${songPlays.uri})` })
      .from(songPlays)
      .where(eq(songPlays.guildId, guildId));
    return {
      totalPlays: Number(totalRow?.total ?? 0),
      uniqueTracks: Number(uniqueRow?.uniqueTracks ?? 0),
    };
  }

  async getGlobalPlayStats(): Promise<{ totalPlays: number; uniqueTracks: number; topGuilds: Array<{ guildId: string; plays: number }> }> {
    await ensureExtraTablesOnce();
    const [totalRow] = await db.select({ total: count(songPlays.id) }).from(songPlays);
    const [uniqueRow] = await db
      .select({ uniqueTracks: sql<number>`COUNT(DISTINCT ${songPlays.uri})` })
      .from(songPlays);
    const guildRows = await db
      .select({ guildId: songPlays.guildId, plays: count(songPlays.id) })
      .from(songPlays)
      .groupBy(songPlays.guildId)
      .orderBy(desc(count(songPlays.id)))
      .limit(10);
    return {
      totalPlays: Number(totalRow?.total ?? 0),
      uniqueTracks: Number(uniqueRow?.uniqueTracks ?? 0),
      topGuilds: guildRows.map(r => ({ guildId: r.guildId, plays: Number(r.plays) })),
    };
  }

  // ── Guild settings ──────────────────────────────────────────────────────────

  async getGuildSettings(guildId: string): Promise<GuildSettingsRow | null> {
    await ensureExtraTablesOnce();
    const rows = await db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1);
    return rows[0] ?? null;
  }

  async getAllGuildSettings(): Promise<GuildSettingsRow[]> {
    await ensureExtraTablesOnce();
    return db.select().from(guildSettings);
  }

  async setRequestChannel(guildId: string, channelId: string | null): Promise<void> {
    await ensureExtraTablesOnce();
    await db
      .insert(guildSettings)
      .values({ guildId, requestChannelId: channelId, crossfadeSeconds: 0 })
      .onConflictDoUpdate({ target: guildSettings.guildId, set: { requestChannelId: channelId } });
  }

  async setGuildCrossfade(guildId: string, seconds: number): Promise<void> {
    await ensureExtraTablesOnce();
    await db
      .insert(guildSettings)
      .values({ guildId, crossfadeSeconds: seconds })
      .onConflictDoUpdate({ target: guildSettings.guildId, set: { crossfadeSeconds: seconds } });
  }

  // ── 24/7 persistence ────────────────────────────────────────────────────────

  async set247On(guildId: string): Promise<void> {
    await ensure247ColumnsOnce();
    await db.run(
      sql`INSERT INTO guild_settings (guild_id, mode_247, crossfade_seconds) VALUES (${guildId}, 1, 0)
          ON CONFLICT(guild_id) DO UPDATE SET mode_247 = 1`,
    );
  }

  async set247Off(guildId: string): Promise<void> {
    await ensure247ColumnsOnce();
    await db.run(
      sql`UPDATE guild_settings SET mode_247 = 0, voice_channel_247 = NULL, text_channel_247 = NULL,
          shard_id_247 = 0, frozen_queue_247 = NULL WHERE guild_id = ${guildId}`,
    );
  }

  async set247IdleState(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string,
    shardId: number,
    frozenQueueJson: string | null,
  ): Promise<void> {
    await ensure247ColumnsOnce();
    await db.run(
      sql`INSERT INTO guild_settings (guild_id, mode_247, voice_channel_247, text_channel_247, shard_id_247, frozen_queue_247, crossfade_seconds)
          VALUES (${guildId}, 1, ${voiceChannelId}, ${textChannelId}, ${shardId}, ${frozenQueueJson}, 0)
          ON CONFLICT(guild_id) DO UPDATE SET
            mode_247 = 1,
            voice_channel_247 = ${voiceChannelId},
            text_channel_247 = ${textChannelId},
            shard_id_247 = ${shardId},
            frozen_queue_247 = ${frozenQueueJson}`,
    );
  }

  async clear247FrozenQueue(guildId: string): Promise<void> {
    await ensure247ColumnsOnce();
    await db.run(
      sql`UPDATE guild_settings SET frozen_queue_247 = NULL WHERE guild_id = ${guildId}`,
    );
  }

  async getAll247Guilds(): Promise<Guild247Row[]> {
    await ensure247ColumnsOnce();
    const rows = await db.run(
      sql`SELECT guild_id, voice_channel_247, text_channel_247, shard_id_247, frozen_queue_247
          FROM guild_settings WHERE mode_247 = 1`,
    );
    // libSQL returns rows as an array of arrays; columns come back in select order
    return (rows.rows as unknown as Array<[string, string | null, string | null, number | null, string | null]>)
      .map(r => ({
        guildId: r[0],
        voiceChannelId: r[1] ?? null,
        textChannelId: r[2] ?? null,
        shardId: r[3] ?? 0,
        frozenQueueJson: r[4] ?? null,
      }));
  }
}

export const storage = new DrizzleStorage();
