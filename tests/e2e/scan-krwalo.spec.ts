import { test, expect } from "@playwright/test";

test("public homepage renders Scan Krwalo brand", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Scan Krwalo" })).toBeVisible();
});
