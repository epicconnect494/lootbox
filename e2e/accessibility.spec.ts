import { test, expect, blockExternal } from "./fixtures";
import { hydrated, login } from "./helpers";

test("navigation, landmarks, focus, touch targets and no horizontal overflow", async ({ page, isMobile }) => {
  test.setTimeout(300_000);
  await login(page, "customer@demo.lootbox");
  for (const path of ["/", "/packs", "/packs/electric-legends", "/vault", "/battles", "/race", "/raffles", "/fairness", "/account"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await hydrated(page);
    await expect(page.locator("main#main")).toBeVisible();
    expect(await page.getByRole("navigation", { name: "Primary" }).count()).toBeGreaterThan(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(1);
    if (isMobile) {
      const bottomNav = page.locator("nav.fixed.bottom-0");
      await expect(bottomNav).toBeVisible();
      const links = bottomNav.getByRole("link");
      expect(await links.count()).toBe(5);
      for (const name of ["Discover", "Drops", "Battle", "Vault", "Account"]) await expect(bottomNav.getByRole("link", { name })).toBeVisible();
      const box = await links.first().boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    } else {
      await expect(page.locator("aside").first()).toBeVisible();
    }
    // Every visible button/link with the tap class meets 44px.
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("button.tap, a.tap")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.height < 43.5 || r.width < 43.5).length,
    );
    expect(small, `${path} small tap targets`).toBe(0);
    const h1 = await page.locator("h1").count();
    expect(h1, `${path} has an h1`).toBeGreaterThan(0);
  }
  // Keyboard: tab from the top reaches the skip link, then focus is visible.
  await page.goto("/");
  await hydrated(page);
  await page.keyboard.press("Tab");
  const active = await page.evaluate(() => document.activeElement?.textContent ?? "");
  expect(active).toMatch(/skip to content/i);
});

test("reduced motion shows the settled result without animation", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  await blockExternal(ctx);
  const page = await ctx.newPage();
  await login(page, "customer@demo.lootbox");
  const res = await ctx.request.get("/api/v1/openings");
  expect(res.status(), await res.text()).toBe(200);
  const { items } = (await res.json()) as { items: Array<{ id: string }> };
  await page.goto(`/openings/${items[0].id}`);
  await hydrated(page);
  await expect(page.getByRole("img", { name: /^Result:/ })).toBeVisible({ timeout: 5000 });
  await ctx.close();
});
