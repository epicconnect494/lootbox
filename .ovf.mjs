import { chromium, devices } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:3001/login", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => { const el = document.querySelector("form"); return !!el && Object.keys(el).some((k) => k.startsWith("__reactFiber")); });
await page.getByLabel("Email").fill("customer@demo.lootbox");
await page.getByLabel("Password").fill("demo-password-123");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"));
for (const path of ["/", "/packs", "/packs/electric-legends", "/vault", "/battles", "/race", "/raffles", "/fairness", "/account"]) {
await page.goto("http://127.0.0.1:3001" + path, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const r = await page.evaluate(() => {
  const w = document.documentElement.clientWidth;
  const over = [...document.querySelectorAll("*")].filter((el) => el.getBoundingClientRect().right > w + 1 && getComputedStyle(el).position !== "fixed").slice(0, 8).map((el) => `${el.tagName}#${el.id}.${[...el.classList].slice(0, 5).join(".")} right=${Math.round(el.getBoundingClientRect().right)}`);
  return { scrollW: document.documentElement.scrollWidth, w, over };
});
console.log(path, JSON.stringify(r));
}
await browser.close();
