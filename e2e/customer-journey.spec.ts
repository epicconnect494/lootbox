import { test, expect } from "./fixtures";
import { apiCall, hydrated, PASSWORD, uniqueEmail } from "./helpers";

test.describe.configure({ mode: "serial" });

test("register → verify → fund → open → reveal → vault → sell / ship", async ({ page, context }) => {
  test.setTimeout(180_000);
  const email = uniqueEmail("journey");

  // Register through the UI.
  await page.goto("/register");
  await hydrated(page);
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.locator("input[name=displayName]").fill("E2E Collector");
  await page.locator("select[name=jurisdictionCode]").selectOption("DEMO");
  await page.locator("input[name=dateOfBirth]").fill("1990-05-15");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/register"), { timeout: 30_000 });

  // Not yet eligible: the pack page explains why.
  await page.goto("/packs/spark-starter");
  await hydrated(page);
  await expect(page.getByText(/identity verification is required/i).first()).toBeVisible({ timeout: 20_000 });

  // Verify identity with the mock provider from the Account page.
  await page.goto("/account#verification");
  await hydrated(page);
  const verifyButtons = page.getByRole("button", { name: /verify with document/i });
  await expect(verifyButtons.first()).toBeVisible();
  const count = await verifyButtons.count();
  for (let i = 0; i < count; i++) {
    await page.getByRole("button", { name: /verify with document/i }).first().click();
    await page.waitForTimeout(800);
  }
  await expect(page.getByRole("button", { name: /verify with document/i })).toHaveCount(0, { timeout: 20_000 });

  // Fund with the test payment provider.
  await page.goto("/account#wallet");
  await hydrated(page);
  await page.locator("#dep-amount").fill("50.00");
  await page.getByRole("button", { name: /^deposit/i }).click();
  await expect(page.getByText(/\$50\.00/).first()).toBeVisible({ timeout: 20_000 });

  // Open a pack; the server settles before the reel renders.
  await page.goto("/packs/spark-starter");
  await hydrated(page);
  const openBtn = page.getByRole("button", { name: /^open pack/i });
  await expect(openBtn).toBeEnabled({ timeout: 20_000 });
  await openBtn.click();
  await page.waitForURL(/\/openings\//, { timeout: 30_000 });
  const openingUrl = page.url();
  await expect(page.getByRole("link", { name: "Keep in Vault" })).toBeVisible({ timeout: 30_000 });
  const resultText = await page.getByRole("img", { name: /^Result:/ }).getAttribute("aria-label");

  // Refresh must show the same result immediately and never reopen.
  await page.reload();
  await hydrated(page);
  await expect(page.getByRole("link", { name: "Keep in Vault" })).toBeVisible({ timeout: 20_000 });
  expect(await page.getByRole("img", { name: /^Result:/ }).getAttribute("aria-label")).toBe(resultText);
  const openings = await apiCall<{ items: unknown[] }>(context, "GET", "/openings");
  expect(openings.body.items.length).toBe(1);

  // Receipt + server-side verification.
  await page.getByRole("button", { name: /verify result/i }).click();
  await expect(page.getByRole("region", { name: "Fairness receipt" })).toBeVisible();
  await expect(page.getByText(/server seed hash/i).first()).toBeVisible();

  // Vault shows the item; sell it back for the disclosed offer.
  await page.goto(openingUrl);
  await hydrated(page);
  await page.getByRole("link", { name: "Sell now" }).click();
  await page.waitForURL(/\/vault/, { timeout: 30_000 });
  await hydrated(page);
  const accept = page.getByRole("button", { name: /^accept \$/i });
  await expect(accept).toBeEnabled({ timeout: 20_000 });
  const balanceBefore = (await apiCall<{ balance: { cashMinor: string } }>(context, "GET", "/auth/me")).body.balance.cashMinor;
  await accept.click();
  await expect(accept).toBeHidden({ timeout: 20_000 });
  await expect.poll(async () => (await apiCall<{ balance: { cashMinor: string } }>(context, "GET", "/auth/me")).body.balance.cashMinor, { timeout: 20_000 }).not.toBe(balanceBefore);
  const vault = await apiCall<{ count: number }>(context, "GET", "/vault");
  expect(vault.body.count).toBe(0);

  // Open another and request shipping.
  await page.goto("/packs/spark-starter");
  await hydrated(page);
  await page.getByRole("button", { name: /^open pack/i }).click();
  await page.waitForURL(/\/openings\//, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Ship" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Ship" }).click();
  await page.waitForURL(/\/vault/, { timeout: 30_000 });
  await hydrated(page);
  await page.getByLabel("Full name").fill("E2E Collector");
  await page.getByLabel("Address line 1").fill("1 Vault Way");
  await page.getByLabel("City").fill("Austin");
  await page.getByLabel("Postal code").fill("78701");
  await page.getByLabel("Country").fill("US");
  await page.getByRole("button", { name: /request shipping/i }).click();
  await expect(page.getByRole("button", { name: /request shipping/i })).toBeHidden({ timeout: 20_000 });
  const vault2 = await apiCall<{ items: Array<{ item: { status: string } }> }>(context, "GET", "/vault");
  expect(vault2.body.items[0].item.status).toBe("SHIP_REQUESTED");
});
