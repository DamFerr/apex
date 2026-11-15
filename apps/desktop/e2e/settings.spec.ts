import { expect, test } from "@playwright/test";
import { fakeDataDragon } from "./helpers";

test.beforeEach(async ({ page }) => { await fakeDataDragon(page); });

test("theme and reduce-motion apply and persist across reloads", async ({ page }) => {
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Colorblind-safe" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "colorblind");
  await page.getByRole("switch", { name: "Reduce motion" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "colorblind");
  await expect(page.getByRole("switch", { name: "Reduce motion" })).toHaveAttribute("aria-checked", "true");
});

test("hotkeys can be re-bound and the safe defaults hold", async ({ page }) => {
  await page.goto("/#/settings");
  await expect(page.getByRole("switch", { name: "Show overlay" })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("switch", { name: "Telemetry" })).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Ctrl+Shift+O" }).click();
  await page.keyboard.press("Control+Shift+L");
  await expect(page.getByRole("button", { name: "Ctrl+Shift+L" })).toBeVisible();
});
