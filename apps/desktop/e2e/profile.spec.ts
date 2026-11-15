import { expect, test } from "@playwright/test";
import { fakeDataDragon } from "./helpers";

test.beforeEach(async ({ page }) => { await fakeDataDragon(page); });

test("search validates Riot IDs and opens a profile", async ({ page }) => {
  await page.goto("/#/");
  const box = page.getByLabel("Riot ID");
  await box.fill("nohashtag"); await box.press("Enter");
  await expect(page.getByText("Enter a Riot ID like Name#TAG")).toBeVisible();
  await box.fill("Test Player#EUW"); await box.press("Enter");
  await expect(page.getByRole("heading", { name: "Test Player#EUW" })).toBeVisible();
  await expect(page.getByText("Emerald II")).toBeVisible();
});

test("match history loads more on scroll, filters, and expands a match", async ({ page }) => {
  await page.goto("/#/profile");
  await expect(page.getByText("10 games loaded")).toBeVisible();
  const main = page.locator("main");
  await expect(async () => { await main.evaluate((el) => el.scrollTo(0, el.scrollHeight)); await expect(page.getByText("End of history")).toBeVisible({ timeout: 1500 }); }).toPass({ timeout: 20_000 });
  await expect(page.getByText("45 games loaded")).toBeVisible();
  await page.getByRole("button", { name: "Wins" }).click();
  expect(await page.locator("li button[aria-expanded]").count()).toBeLessThan(45);
  const first = page.locator("li button[aria-expanded]").first();
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("table").first()).toBeVisible();
  await expect(page.getByText(/Victory|Defeat/).first()).toBeVisible();
});

test("tabs: mastery and LP history", async ({ page }) => {
  await page.goto("/#/profile");
  await page.getByRole("tab", { name: "Mastery" }).click();
  await expect(page.getByText(/^M\d+$/).first()).toBeVisible();
  await page.getByRole("tab", { name: "LP history" }).click();
  await expect(page.getByRole("img", { name: /LP went from/ })).toBeVisible();
  await page.getByRole("tab", { name: "Match history" }).click();
  await expect(page.getByText(/games loaded/)).toBeVisible(); // infinite scroll area comes back after switching tabs
});
