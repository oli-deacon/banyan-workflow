import { test, expect, type Page } from "@playwright/test";
import { blankCard } from "../../lib/board";
import { newRecord } from "../../lib/server/model";
import { summarizeCard } from "../../lib/card-types";
async function setup(page: Page) {
  const cards = [
    {
      ...blankCard("To Do", "human"),
      title: "Human task",
      owner: "Alex Example",
      worker: "Taylor Example",
      reviewer: "Sam Example",
    },
    {
      ...blankCard("In Progress", "agent"),
      title: "Agent task",
      owner: "Blair Example",
      worker: "Config Agent",
      workerKind: "agent",
      reviewer: "Jordan Example",
    },
    {
      ...blankCard("Done", "mixed"),
      title: "Mixed label task",
      owner: "Alex Example",
      worker: "Config Agent",
      workerKind: "human",
      reviewer: "Sam Example",
    },
    ...Array.from({ length: 16 }, (_, i) => ({
      ...blankCard("To Do", `extra-${i}`),
      title: `Extra ${i}`,
      owner: `Person ${String(i).padStart(2, "0")} Example`,
      worker: "Test Agent",
      workerKind: "agent",
      reviewer: "Sam Example",
    })),
  ].map((card) => summarizeCard(newRecord(card, "modernization")));
  await page.route("**/api/boards/modernization/cards", (route) =>
    route.fulfill({ json: { cards, mode: "public-demo" } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Filter by owner: Anyone", exact: true }),
  ).toBeVisible();
}

test("picker searches, distinguishes worker types, selects and clears with keyboard", async ({
  page,
}, info) => {
  await setup(page);
  const trigger = page.getByRole("button", {
    name: "Filter by owner: Anyone",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  const search = page.getByRole("combobox", {
    name: "Search owners",
    exact: true,
  });
  await expect(search).toBeFocused();
  await search.fill("aLeX");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(2);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  const selected = page.getByRole("button", {
    name: "Filter by owner: Alex Example",
    exact: true,
  });
  await expect(selected).toBeFocused();
  await expect(page.locator(".card")).toHaveCount(2);
  await selected.click();
  await expect(
    page.getByRole("option", { name: /Alex Example/ }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(selected).toBeFocused();
  await page
    .getByRole("button", { name: "Clear owner filter", exact: true })
    .click();
  await expect(trigger).toBeFocused();
  await expect(page.locator(".card")).toHaveCount(19);
  await page
    .getByRole("button", { name: "Filter by worker: Anyone", exact: true })
    .click();
  await expect(
    page.getByRole("option", { name: /Config Agent/ }),
  ).toContainText("Human / Agent");
  await expect(page.getByRole("option", { name: /Test Agent/ })).toContainText(
    "Agent",
  );
  await page.screenshot({ path: info.outputPath("worker-picker-desktop.png") });
  await page.getByRole("option", { name: /Config Agent/ }).click();
  await expect(page.locator(".card")).toHaveCount(2);
});

test("no matches, outside click, Tab exit, scroll navigation and reviewer filtering", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Filter by owner: Anyone", exact: true })
    .click();
  const search = page.getByRole("combobox", {
    name: "Search owners",
    exact: true,
  });
  await search.fill("Nobody matches");
  await expect(
    page.getByText("No matches. Try another name.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(1);
  await page
    .getByRole("heading", { name: "Modernization", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Owner filter" })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Filter by owner: Anyone", exact: true })
    .click();
  await page.keyboard.press("ArrowUp");
  const last = page.getByRole("option", { name: /Person 15 Example/ });
  await expect(last).toBeInViewport();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("dialog", { name: "Owner filter" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Filter by worker: Anyone", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Filter by reviewer: Anyone", exact: true })
    .click();
  await page.getByRole("option", { name: /Jordan Example/ }).click();
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator(".card")).toContainText("Agent task");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Filter by reviewer: Anyone",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".card")).toHaveCount(19);
});

test.describe("touch", () => {
  test.use({ hasTouch: true, isMobile: true });
  test("mobile picker fits, supports touch and handles an empty assignment list", async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 390, height: 740 });
    await setup(page);
    await page
      .getByRole("button", { name: "Filter by reviewer: Anyone", exact: true })
      .tap();
    const popup = page.getByRole("dialog", { name: "Reviewer filter" });
    const rect = await popup.boundingBox();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(390);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(740);
    await page.screenshot({
      path: info.outputPath("reviewer-picker-mobile.png"),
    });
    await page.getByRole("option", { name: /Sam Example/ }).tap();
    await expect(
      page.getByRole("button", {
        name: "Filter by reviewer: Sam Example",
        exact: true,
      }),
    ).toBeVisible();
    await page.unrouteAll();
    await page.route("**/api/boards/modernization/cards", (route) =>
      route.fulfill({ json: { cards: [], mode: "public-demo" } }),
    );
    await page.reload();
    await page
      .getByRole("button", { name: "Filter by owner: Anyone", exact: true })
      .tap();
    await expect(
      page.getByText("No owners assigned yet.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("option", { name: "All owners", exact: true }).tap();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
});
