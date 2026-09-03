import { bigint, char, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const id = () => uuid("id").primaryKey().defaultRandom();
export const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
export const deletedAt = () => timestamp("deleted_at", { withTimezone: true });
/** Money is always stored as integer minor units (cents) in a bigint column with an explicit currency. */
export const money = (name: string) => bigint(name, { mode: "bigint" });
export const currency = () => char("currency", { length: 3 }).notNull().default("USD");
export const nowSql = sql`now()`;
