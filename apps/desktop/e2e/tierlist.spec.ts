import { expect, test } from "@playwright/test";
import { collectErrors, expectContentVisible, fakeDataDragon } from "./helpers";

test.beforeEach(async ({ page }) => { await fakeDataDragon(page); });

test("tier list groups champions into graded bands and switches role", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/tierlist");
  await expectContentVisible(page);
  await expect(page.getByRole("heading", { name: "Tier List" })).toBeVisible();
  const tiles = page.locator("main section a");
  await expect(tiles.first()).toBeVisible();
  const mid = await tiles.count();
  await page.getByRole("button", { name: "Support" }).click();
  await expect(page.getByRole("button", { name: "Support" })).toHaveAttribute("aria-pressed", "true");
  await expect(tiles.first()).toBeVisible();
  expect(mid).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("a champion tile opens its champion page", async ({ page }) => {
  await page.goto("/#/tierlist");
  await page.locator("main section a").first().click();
  await expect(page).toHaveURL(/#\/champions\//);
});
