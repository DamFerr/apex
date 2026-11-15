import { expect, test } from "@playwright/test";
import { CHAMP_COUNT, fakeDataDragon } from "./helpers";

test.beforeEach(async ({ page }) => { await fakeDataDragon(page); });

test("lists every champion from Data Dragon, filters by role and sorts", async ({ page }) => {
  await page.goto("/#/champions");
  const rows = page.locator("main tbody tr");
  await expect(rows).toHaveCount(CHAMP_COUNT);
  await expect(page.getByLabel("Region")).toHaveCount(0); // the filter bar only applies to collected data
  await page.getByRole("button", { name: "Jungle" }).click();
  await expect(rows).toHaveCount(6); // Fighters and Assassins in the fixture
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(rows).toHaveCount(CHAMP_COUNT);
  const header = page.locator("main thead").getByRole("button", { name: /^Champion/ });
  await header.click(); // first click: Z to A
  await expect(rows.first()).toContainText("Zed");
  await header.click();
  await expect(rows.first()).toContainText("Ahri");
  await page.getByLabel("Filter champions").fill("lee");
  await expect(rows).toHaveCount(1);
});

test("opens a champion page with stats, builds and matchups", async ({ page }) => {
  await page.goto("/#/champions");
  await page.getByRole("link", { name: "Ahri" }).click();
  await expect(page).toHaveURL(/#\/champions\/Ahri/);
  await expect(page.getByRole("heading", { name: "Ahri" })).toBeVisible();
  await expect(page.getByText("Win rate (adjusted)").first()).toBeVisible();
  await expect(page.getByText("Matchups (best to worst)")).toBeVisible();
});
