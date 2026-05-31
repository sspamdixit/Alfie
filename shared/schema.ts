import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const botMeta = pgTable("bot_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type BotMetaRow = typeof botMeta.$inferSelect;

export const savedPlaylists = pgTable("saved_playlists", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SavedPlaylist = typeof savedPlaylists.$inferSelect;

export const playlistTracks = pgTable("playlist_tracks", {
  id: serial("id").primaryKey(),
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
