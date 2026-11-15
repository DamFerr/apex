import { expect, test } from "@playwright/test";
import { collectErrors, expectContentVisible, fakeDataDragon } from "./helpers";

test.beforeEach(async ({ page }) => { await fakeDataDragon(page); });

test("mock: shows both teams, marks you, bans and the jungler", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/live");
  await expectContentVisible(page);
  await expect(page.getByRole("region", { name: "Blue team" }).getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("region", { name: "Red team" }).getByRole("listitem")).toHaveCount(5);
  await expect(page.getByText("you", { exact: true })).toHaveCount(1);
  await expect(page.getByText("jungle", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/^Bans:/).first()).toBeVisible();
  await expect(page.getByLabel("Game time")).toContainText("6:12");
  expect(errors).toEqual([]);
});

test("mock: a player who is not in a game gets a clear message; bad Riot IDs are rejected", async ({ page }) => {
  await page.goto("/#/live");
  const box = page.getByLabel("Riot ID to scout");
  await box.fill("nohashtag"); await page.getByRole("button", { name: "Look up" }).click();
  await expect(page).toHaveURL(/#\/live\/?$/); // rejected, did not navigate
  await box.fill("Offline Guy#EUW"); await page.getByRole("button", { name: "Look up" }).click();
  await expect(page).toHaveURL(/#\/live\/Offline/);
  await expect(page.getByText(/is not in a game right now/)).toBeVisible();
});

test("backend: real endpoint end to end, ranks, champion win rate, and the not-in-game state", async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem("apex-ui")) localStorage.setItem("apex-ui", JSON.stringify({ state: { dataSource: "backend", backendUrl: "http://127.0.0.1:8788", myRiotId: "Test Player#EUW" }, version: 0 })); });
  await page.goto("/#/live");
  const blue = page.getByRole("region", { name: "Blue team" });
  await expect(blue.getByRole("listitem")).toHaveCount(5);
  await expect(blue.getByText("Emerald II").first()).toBeVisible();
  await expect(blue.getByText("87W 79L", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("hot streak")).toHaveCount(1);
  await expect(page.getByText("Ranked Solo").first()).toBeVisible();
  await page.getByLabel("Riot ID to scout").fill("Offline#EUW"); await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByText(/is not in a game right now/)).toBeVisible();
});
