import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const goalsTable = pgTable("goals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 6 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 12, scale: 6 }).notNull().default("0"),
  icon: text("icon"),
  color: text("color"),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const habitsTable = pgTable("habits", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  color: text("color"),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const habitLogsTable = pgTable("habit_logs", {
  id: serial("id").primaryKey(),
  habitId: integer("habit_id")
    .notNull()
    .references(() => habitsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // "YYYY-MM-DD", igual que transactions
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGoalSchema = createInsertSchema(goalsTable).omit({
  id: true,
  createdAt: true,
  userId: true,
});
export const insertHabitSchema = createInsertSchema(habitsTable).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export type Goal = typeof goalsTable.$inferSelect;
export type Habit = typeof habitsTable.$inferSelect;
export type HabitLog = typeof habitLogsTable.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type InsertHabit = z.infer<typeof insertHabitSchema>;
