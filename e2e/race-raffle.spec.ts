import { test, expect } from "./fixtures";
import { adminRequest, apiCall, hydrated, login } from "./helpers";

test("race page shows a personal rank and score explanation after an opening", async ({ page, context }) => {
  test.setTimeout(120_000);
  await login(page, "customer@demo.lootbox");
  const packs = await apiCall<{ items: Array<{ slug: string; version: { id: string } }> }>(context, "GET", "/packs?limit=50");
  const spark = packs.body.items.find((p) => p.slug === "spark-starter")!;
  const open = await apiCall(context, "POST", "/openings", { packVersionId: spark.version.id }, `e2e-race-${Date.now()}`);
  expect(open.status, JSON.stringify(open.body)).toBe(201);
  await page.goto("/race");
  await hydrated(page);
  await expect(page.getByText(/your rank|rank/i).first()).toBeVisible();
  await page.getByText(/how your score was calculated/i).click();
  await expect(page.getByText(/pts per unit/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/EARLIEST_QUALIFYING_EVENT_WINS/).first()).toBeVisible();
});

test("raffle entry, close, draw and in-browser verification", async ({ page, context, request }) => {
  test.setTimeout(180_000);
  const admin = await adminRequest(request);
  const now = Date.now();
  const slug = `e2e-raffle-${now}`;
  const created = await admin.call<{ raffle: { id: string } }>("POST", "/admin/raffles", {
    slug,
    name: "E2E Raffle",
    entryMode: "FREE",
    maxTickets: 100,
    maxTicketsPerUser: 5,
    ticketPrice: "0",
    winnersCount: 1,
    amoeEnabled: true,
    allowedJurisdictions: [],
    opensAt: new Date(now - 60_000).toISOString(),
    closesAt: new Date(now + 3_600_000).toISOString(),
    drawsAt: new Date(now + 7_200_000).toISOString(),
    claimDeadlineAt: new Date(now + 86_400_000).toISOString(),
    publicRandomnessSource: "e2e fixed value",
    prizes: [{ rank: 1, title: "E2E Prize", referenceValue: "100.00" }],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const raffleId = created.body.raffle.id;

  await login(page, "customer@demo.lootbox");
  await page.goto(`/raffles/${raffleId}`);
  await hydrated(page);
  await page.getByLabel(/^Tickets/).fill("3");
  await page.getByRole("button", { name: /get 3 tickets/i }).click();
  await expect(page.getByText(/TKT-/).first()).toBeVisible({ timeout: 20_000 });

  const closed = await admin.call("POST", `/admin/raffles/${raffleId}/close`);
  expect(closed.status).toBe(200);
  const drawn = await admin.call<{ draw: { winners: Array<{ ticketNumber: number }> } }>("POST", `/admin/raffles/${raffleId}/draw`, { publicRandomness: "e2e-public-randomness-0001", publicRandomnessSource: "e2e fixed value" });
  expect(drawn.status).toBe(201);

  await page.goto(`/raffles/${raffleId}`);
  await hydrated(page);
  await expect(page.getByText(/manifest/i).first()).toBeVisible();
  await page.getByRole("button", { name: /verify/i }).first().click();
  await expect(page.getByText(/matches/i).first()).toBeVisible({ timeout: 20_000 });
  const view = await apiCall<{ draws: Array<{ status: string; winners: unknown[] }> }>(context, "GET", `/raffles/${raffleId}`);
  expect(view.body.draws[0].status).toBe("VALID");
  expect(view.body.draws[0].winners.length).toBe(1);
});
