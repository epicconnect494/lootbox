import { route, ok } from "@/lib/api";
import { refundBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { issueRefund } from "@/domain/users";
import { parseDecimalToMinor } from "@/lib/money";

export const POST = route({ auth: "admin", permission: "finance.write", body: refundBody }, async ({ body, session }) => {
  const r = await issueRefund(getDb(), session!.user.id, { userId: body.userId, paymentId: body.paymentId ?? null, amountMinor: parseDecimalToMinor(body.amount), reason: body.reason, referenceType: body.referenceType, referenceId: body.referenceId });
  return ok({ refund: r }, 201);
});
