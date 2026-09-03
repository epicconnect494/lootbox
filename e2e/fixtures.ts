import { test as base, type BrowserContext } from "@playwright/test";

/** Abort every request that leaves the app under test (fonts, browser telemetry) so runs are hermetic and fast. */
export async function blockExternal(ctx: BrowserContext) {
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
}

export const test = base.extend({
  context: async ({ context }, provide) => {
    await blockExternal(context);
    await provide(context);
  },
});
export { expect } from "@playwright/test";
