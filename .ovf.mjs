import { chromium, devices } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
const page = await ctx.newPage();
for (const path of ["/", "/packs/electric-legends", "/battles", "/race", "/fairness", "/account", "/vault"]) {
  await page.goto("http://127.0.0.1:3001" + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const over = [...document.querySelectorAll("*")].filter((el) => el.getBoundingClientRect().right > w + 1).slice(0, 5).map((el) => `${el.tagName}.${[...el.classList].slice(0, 4).join(".")} right=${Math.round(el.getBoundingClientRect().right)}`);
    return { scrollW: document.documentElement.scrollWidth, w, over };
  });
  console.log(path, JSON.stringify(r));
}
await browser.close();
