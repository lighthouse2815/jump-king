import { pgTable, serial, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  nickname: text("nickname").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const raceMatches = pgTable("race_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomCode: text("room_code").notNull(),
  startTime: timestamp("start_time").defaultNow().notNull(),
  status: text("status").notNull(),
});

export const raceParticipants = pgTable("race_participants", {
  id: serial("id").primaryKey(),
  matchId: uuid("match_id").references(() => raceMatches.id),
  userId: uuid("user_id").references(() => users.id),
  finishTime: integer("finish_time"), // milliseconds
  maxHeight: integer("max_height"),
});
