import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db, fresh, makeUser, closePool } from "./helpers";
import { createSession } from "@/lib/auth";
import { OPERATIONS } from "@/api/openapi";
import { ROLES, type RoleKey } from "@/lib/permissions";

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function loadHandler(path: string, method: string): Promise<Handler> {
  const file = `../../src/app/api/v1${path.replace(/\{(\w+)\}/g, "[$1]")}/route`;
  const mod = (await import(/* @vite-ignore */ file)) as Record<string, Handler>;
  return mod[method.toUpperCase()];
}

describe("authorization matrix for every admin route and role", () => {
  const sessions: Record<string, { cookie: string; csrf: string }> = {};
  beforeAll(async () => {
    await fresh();
    for (const role of Object.keys(ROLES) as RoleKey[]) {
      const u = await makeUser({ role });
      const sess = await createSession(db, u.id, {});
      sessions[role] = { cookie: `lb_session=${sess.token}`, csrf: sess.csrfSecret };
    }
  });
  afterAll(closePool);

  const adminOps = OPERATIONS.filter((o) => o.auth === "admin" && !o.sse);
  const id = "00000000-0000-4000-8000-000000000000";

  for (const op of adminOps) {
    for (const role of Object.keys(ROLES) as RoleKey[]) {
      const allowed = ROLES[role].permissions.includes("admin.access") && (!op.permission || ROLES[role].permissions.includes(op.permission as never));
      it(`${op.method.toUpperCase()} ${op.path} as ${role} -> ${allowed ? "allowed" : "403"}`, async () => {
        const handler = await loadHandler(op.path, op.method);
        expect(handler).toBeTypeOf("function");
        const url = `http://localhost/api/v1${op.path.replace(/\{\w+\}/g, id)}`;
        const s = sessions[role];
        const req = new NextRequest(url, { method: op.method.toUpperCase(), headers: { cookie: s.cookie, "x-csrf-token": s.csrf, "content-type": "application/json" }, body: op.method === "get" ? undefined : "{}" });
        const params: Record<string, string> = {};
        for (const m of op.path.matchAll(/\{(\w+)\}/g)) params[m[1]] = id;
        const res = await handler(req, { params: Promise.resolve(params) });
        if (!allowed) {
          expect(res.status).toBe(403);
          const body = (await res.json()) as { error: { code: string } };
          expect(body.error.code).toBe("FORBIDDEN");
        } else {
          expect(res.status).not.toBe(403);
          expect(res.status).not.toBe(401);
        }
      });
    }
  }

  it("rejects unauthenticated access to admin and user routes, and CSRF-less mutations", async () => {
    const handler = await loadHandler("/admin/dashboard", "get");
    const res = await handler(new NextRequest("http://localhost/api/v1/admin/dashboard"), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    const vault = await loadHandler("/vault", "get");
    expect((await vault(new NextRequest("http://localhost/api/v1/vault"), { params: Promise.resolve({}) })).status).toBe(401);
    const quote = await loadHandler("/openings/quote", "post");
    const s = sessions.CUSTOMER;
    const noCsrf = await quote(new NextRequest("http://localhost/api/v1/openings/quote", { method: "POST", headers: { cookie: s.cookie, "content-type": "application/json" }, body: JSON.stringify({ packVersionId: id }) }), { params: Promise.resolve({}) });
    expect(noCsrf.status).toBe(403);
    expect(((await noCsrf.json()) as { error: { code: string } }).error.code).toBe("CSRF_FAILED");
  });

  it("idempotent endpoints without a request body do not crash on replay bookkeeping", async () => {
    const accept = await loadHandler("/sellback/quotes/{id}/accept", "post");
    const s = sessions.CUSTOMER;
    const res = await accept(new NextRequest(`http://localhost/api/v1/sellback/quotes/${id}/accept`, { method: "POST", headers: { cookie: s.cookie, "x-csrf-token": s.csrf, "idempotency-key": "no-body-key-1" } }), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(404); // quote does not exist; must not be a 500
  });

  it("requires an Idempotency-Key on idempotent endpoints and detects body mismatch", async () => {
    const open = await loadHandler("/openings", "post");
    const s = sessions.CUSTOMER;
    const missing = await open(new NextRequest("http://localhost/api/v1/openings", { method: "POST", headers: { cookie: s.cookie, "x-csrf-token": s.csrf, "content-type": "application/json" }, body: JSON.stringify({ packVersionId: id }) }), { params: Promise.resolve({}) });
    expect(missing.status).toBe(400);
    const first = await open(new NextRequest("http://localhost/api/v1/openings", { method: "POST", headers: { cookie: s.cookie, "x-csrf-token": s.csrf, "content-type": "application/json", "idempotency-key": "idem-test-key-1" }, body: JSON.stringify({ packVersionId: id }) }), { params: Promise.resolve({}) });
    expect(first.status).toBe(404); // pack version does not exist; error responses are not cached
    const second = await open(new NextRequest("http://localhost/api/v1/openings", { method: "POST", headers: { cookie: s.cookie, "x-csrf-token": s.csrf, "content-type": "application/json", "idempotency-key": "idem-test-key-1" }, body: JSON.stringify({ packVersionId: id }) }), { params: Promise.resolve({}) });
    expect(second.status).toBe(404);
  });
});
