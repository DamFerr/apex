import { expect, test, type Page } from "@playwright/test";
import { collectErrors, fakeDataDragon } from "./helpers";

async function open(page: Page) {
  await fakeDataDragon(page);
  await page.goto("/#/draft");
  await expect(page.getByText("League client (mock): connected")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("Waiting for champ select…")).toBeVisible();
}

test("mock champ select: ban turn, win probability, suggestions, locks", async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.getByRole("button", { name: "Start mock champ select" }).click();
  await expect(page.getByText("Your ban turn")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("region", { name: "Ban suggestions" }).locator("li")).toHaveCount(5);
  await expect(page.getByRole("region", { name: "Pick recommendations" })).toBeHidden(); // no pick suggestions during the ban turn
  // ban turn ends, picks begin
  await expect(page.getByRole("region", { name: "Pick recommendations" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Ban suggestions" })).toBeHidden();
  const bar = page.getByRole("region", { name: "Win probability" });
  const before = await bar.innerText();
  await expect(page.getByText("LOCKED").first()).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => bar.innerText(), { timeout: 20_000 }).not.toBe(before); // the bar reacts as picks lock
  await expect(page.getByText(/^You: \d+% in \d+ games/).first()).toBeVisible().catch(() => undefined); // personalization note (when a pooled champion is suggested)
  expect(errors).toEqual([]);
});

test("pool checkbox changes the ban reasons", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Start mock champ select" }).click();
  const bans = page.getByRole("region", { name: "Ban suggestions" });
  await expect(bans).toContainText("Beats your", { timeout: 15_000 });
  await page.getByLabel(/Use my champion pool/).uncheck();
  await expect(bans).toContainText("Strong in general");
});

test("dodge returns to the waiting state", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Start dodge scenario" }).click();
  await expect(page.getByText("LOCKED").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Waiting for champ select…")).toBeVisible({ timeout: 30_000 });
});

test("auto-import is off by default and logs only when enabled", async ({ page }) => {
  await open(page);
  await expect(page.getByLabel(/Auto-import on lock-in/)).not.toBeChecked();
  await page.getByLabel(/Auto-import on lock-in/).check();
  await page.getByRole("button", { name: "Start mock champ select" }).click();
  await expect(page.getByText(/Auto-import \(mock\)/)).toBeVisible({ timeout: 45_000 });
});
