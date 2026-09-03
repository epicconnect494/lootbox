import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { route, ok } from "@/lib/api";
import { notificationsReadBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { notification } from "@/db/schema";

export const GET = route({ auth: "user" }, async ({ session }) => {
  const items = await getDb().select().from(notification).where(eq(notification.userId, session!.user.id)).orderBy(desc(notification.createdAt)).limit(50);
  return ok({ items, unread: items.filter((n) => !n.readAt).length });
});

export const POST = route({ auth: "user", body: notificationsReadBody }, async ({ body, session }) => {
  const db = getDb();
  await db.update(notification).set({ readAt: new Date() }).where(and(eq(notification.userId, session!.user.id), isNull(notification.readAt), body.ids?.length ? inArray(notification.id, body.ids) : undefined));
  return ok({ ok: true });
});
