import { pgTable, serial, text, numeric, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { transactionsTable } from "./transactions";

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

// Pago recurrente mensual (ej. "Seguro", "Internet") — mismo patrón que habits/habitLogs,
// pero el log es por MES ("YYYY-MM") en vez de por día, y opcionalmente crea una
// transacción real cuando se marca pagado con auto-save activado.
export const billsTable = pgTable("bills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  color: text("color"),
  amount: numeric("amount", { precision: 12, scale: 6 }), // monto esperado, referencia — puede variar mes a mes
  categoryId: integer("category_id").references(() => categoriesTable.id),
  autoSave: boolean("auto_save").notNull().default(false),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const billLogsTable = pgTable("bill_logs", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id")
    .notNull()
    .references(() => billsTable.id, { onDelete: "cascade" }),
  month: text("month").notNull(), // "YYYY-MM"
  amountPaid: numeric("amount_paid", { precision: 12, scale: 6 }),
  transactionId: integer("transaction_id").references(() => transactionsTable.id, { onDelete: "set null" }),
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
export const insertBillSchema = createInsertSchema(billsTable).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export type Goal = typeof goalsTable.$inferSelect;
export type Habit = typeof habitsTable.$inferSelect;
export type HabitLog = typeof habitLogsTable.$inferSelect;
export type Bill = typeof billsTable.$inferSelect;
export type BillLog = typeof billLogsTable.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type InsertBill = z.infer<typeof insertBillSchema>;
