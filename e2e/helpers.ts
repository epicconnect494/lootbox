import { expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

export const PASSWORD = "demo-password-123";

/** Wait until React has hydrated the page (forms submit natively before that). */
export async function hydrated(page: Page) {
  // Do not wait for network idle: SSE streams keep the network busy by design.
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => {
    const el = document.querySelector("form, button");
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactFiber"));
  }, undefined, { timeout: 30_000 });
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await hydrated(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

export function csrf(cookies: Array<{ name: string; value: string }>): string {
  return cookies.find((c) => c.name === "lb_csrf")?.value ?? "";
}

/** JSON call through the browser context's cookie jar with CSRF + idempotency headers. */
export async function apiCall<T = unknown>(ctx: BrowserContext, method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown, idem?: string): Promise<{ status: number; body: T }> {
  const cookies = await ctx.cookies();
  const res = await ctx.request.fetch(`/api/v1${path}`, {
    method,
    headers: { "content-type": "application/json", "x-csrf-token": csrf(cookies), ...(idem ? { "idempotency-key": idem } : {}) },
    data: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status(), body: (await res.json().catch(() => null)) as T };
}

export async function adminRequest(request: APIRequestContext, email = "admin@demo.lootbox") {
  const login = await request.post("/api/v1/auth/login", { data: { email, password: PASSWORD } });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).csrfToken as string;
  return {
    call: async <T = unknown>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown, idem?: string) => {
      const res = await request.fetch(`/api/v1${path}`, { method, headers: { "content-type": "application/json", "x-csrf-token": token, ...(idem ? { "idempotency-key": idem } : {}) }, data: body === undefined ? undefined : JSON.stringify(body) });
      return { status: res.status(), body: (await res.json().catch(() => null)) as T };
    },
  };
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.local`;
}
