import { expect, test } from "@playwright/test";
import { cleanupE2eData, ids, loginAs, prisma, seedE2eData } from "./helpers/e2eDb";

test.beforeEach(async () => {
  await seedE2eData();
});

test.afterAll(async () => {
  await cleanupE2eData();
  await prisma.$disconnect();
});

test("Docker dev auth opens the CRM dashboard", async ({ page }) => {
  await loginAs(page, ids.master);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: /E2E Master/ })).toBeVisible();
});

test("bulk selection starts a calling session from the selected leads", async ({ page }) => {
  await loginAs(page, ids.master);
  await page.goto("/leads");

  await page.getByPlaceholder("Search leads...").fill("E2E Bulk");
  await expect(page.getByText("E2E Bulk Call One")).toBeVisible();
  await expect(page.getByText("E2E Bulk Call Two")).toBeVisible();

  await page.getByLabel("Select E2E Bulk Call One").click();
  await page.getByLabel("Select E2E Bulk Call Two").click();
  await expect(page.getByRole("button", { name: "Merge", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Call", exact: true }).click();

  await expect(page.getByText("Calling Session")).toBeVisible();
  await expect(page.getByText("Lead 1 of 2")).toBeVisible();
  await expect(page.getByRole("link", { name: /E2E Bulk Call/ })).toBeVisible();
});

test("callback scheduling can assign a different telemarketer", async ({ page }) => {
  await loginAs(page, ids.master);
  await page.goto("/leads");

  await page.getByPlaceholder("Search leads...").fill("E2E Callback");
  await expect(page.getByText("E2E Callback Prospect")).toBeVisible();
  await page.getByRole("button", { name: "Lead actions for E2E Callback Prospect" }).click();
  await page.getByRole("menuitem", { name: "Schedule callback" }).click();

  await expect(page.getByRole("dialog", { name: /Schedule callback/ })).toBeVisible();
  await page.locator("#cb-when").fill("2026-07-02T14:30");
  await page.locator("#cb-assignee").click();
  await page.getByRole("option", { name: "E2E TM B" }).click();
  await page.getByRole("button", { name: "Schedule callback" }).click();

  await expect
    .poll(async () => {
      const lead = await prisma.lead.findUnique({ where: { id: ids.callbackLead } });
      return lead?.callbackAssignedTo ?? null;
    })
    .toBe(ids.tmB);
});

test("Start Calling can target leads uploaded by the signed-in telemarketer", async ({ page }) => {
  await loginAs(page, ids.tmA);
  await page.goto("/");

  await page.getByRole("button", { name: "Start Calling" }).click();
  await expect(page.getByRole("dialog", { name: "Start Calling Session" })).toBeVisible();

  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /Uploaded by me/ }).click();

  await expect(page.getByText("E2E Uploaded Own")).toBeVisible();
  await expect(page.getByText("E2E Uploaded Other")).not.toBeVisible();
});
