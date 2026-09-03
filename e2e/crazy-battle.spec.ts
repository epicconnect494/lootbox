import { test, expect, blockExternal } from "./fixtures";
import { hydrated, login } from "./helpers";

test("create and join a Crazy Mode battle; lowest total wins and the pink banner persists", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await blockExternal(ctxA);
  await blockExternal(ctxB);
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await login(a, "nova@demo.lootbox");
  await login(b, "kai@demo.lootbox");

  await a.goto("/battles/create");
  await hydrated(a);
  const packLabel = await a.locator("#pack-picker option", { hasText: "Circuit Clash" }).first().textContent();
  await a.locator("#pack-picker").selectOption({ label: packLabel!.trim() });
  await a.getByRole("button", { name: /add round/i }).click();
  await a.getByRole("radiogroup", { name: "Battle mode" }).getByRole("radio", { name: /crazy/i }).click();
  await a.getByRole("radio", { name: /^2\b/ }).first().click();
  await a.getByRole("radio", { name: /fast/i }).click();
  await expect(a.getByRole("note", { name: "Crazy Mode rule" }).first()).toContainText("LOWEST TOTAL WINS");
  const review = a.getByRole("button", { name: /review crazy mode battle/i });
  await expect(review).toBeEnabled({ timeout: 20_000 });
  await review.click();
  // confirmation step repeats the rule before any money moves
  const dialog = a.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/LOWEST TOTAL WINS/i);
  await dialog.getByRole("button").last().click();
  await a.waitForURL(/\/battles\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const url = a.url();
  await hydrated(a);
  await expect(a.getByRole("note", { name: "Crazy Mode rule" }).first()).toBeVisible();

  await b.goto(url);
  await hydrated(b);
  await b.getByRole("button", { name: /^join for/i }).click();
  await expect(b.getByRole("button", { name: /^join for/i })).toBeHidden({ timeout: 30_000 });

  // Both players see the settled result derived from stored pulls.
  for (const p of [a, b]) {
    await expect(p.getByText(/settled/i).first()).toBeVisible({ timeout: 60_000 });
    const skip = p.getByRole("button", { name: /skip to result/i });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await expect(p.getByRole("note", { name: "Crazy Mode rule" }).first()).toContainText("LOWEST TOTAL WINS");
    await expect(p.getByText(/winner/i).first()).toBeVisible({ timeout: 30_000 });
  }
  const res = await ctxA.request.get(`/api/v1/battles/${url.split("/").pop()}`);
  const view = (await res.json()) as { battle: { status: string; winnerUserIds: string[] }; seats: Array<{ userId: string; totalValueMinor: string }> };
  expect(view.battle.status).toBe("SETTLED");
  const min = view.seats.reduce((m, s) => (BigInt(s.totalValueMinor) < m ? BigInt(s.totalValueMinor) : m), BigInt(view.seats[0].totalValueMinor));
  expect(view.seats.filter((s) => BigInt(s.totalValueMinor) === min).map((s) => s.userId)).toContain(view.battle.winnerUserIds[0]);
  await ctxA.close();
  await ctxB.close();
});
