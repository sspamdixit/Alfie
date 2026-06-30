import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const botMeta = sqliteTable("bot_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type BotMetaRow = typeof botMeta.$inferSelect;

export const savedPlaylists = sqliteTable("saved_playlists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export type SavedPlaylist = typeof savedPlaylists.$inferSelect;

export const playlistTracks = sqliteTable("playlist_tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playlistId: integer("playlist_id").notNull(),
  position: integer("position").notNull(),
  encoded: text("encoded").notNull(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  uri: text("uri").notNull(),
  duration: integer("duration").notNull(),
  artworkUrl: text("artwork_url"),
});

export type PlaylistTrack = typeof playlistTracks.$inferSelect;

export const songPlays = sqliteTable("song_plays", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildId: text("guild_id").notNull(),
  uri: text("uri").notNull(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  requestedBy: text("requested_by").notNull(),
  playedAt: text("played_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export type SongPlay = typeof songPlays.$inferSelect;

export const guildSettings = sqliteTable("guild_settings", {
  guildId: text("guild_id").primaryKey(),
  requestChannelId: text("request_channel_id"),
  crossfadeSeconds: integer("crossfade_seconds").notNull().default(0),
});

export type GuildSettingsRow = typeof guildSettings.$inferSelect;
