import { test, expect, type Page } from "@playwright/test";
import { FIELDS } from "../../lib/board";
import { demoCard, demoSteps } from "../../lib/demo-scenario";
const API = "/api/boards/modernization/cards";
async function create(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "New card" }).click();
  const title = `Workflow browser ${Date.now()}`;
  await page.getByLabel("Title Required").fill(title);
  await page
    .getByRole("textbox", { name: "Owner", exact: true })
    .fill("Alex Example");
  await page
    .getByRole("textbox", { name: "Assigned worker", exact: true })
    .fill("Config Agent");
  await page.getByLabel("Worker type", { exact: true }).selectOption("agent");
  await page
    .getByRole("textbox", { name: "Reviewer", exact: true })
    .fill("Sam Example");
  await page.getByRole("button", { name: /Add more detail/ }).click();
  await page
    .getByRole("textbox", { name: "Objective", exact: true })
    .fill("Preserve behaviour while extracting typed configuration.");
  await page
    .getByRole("textbox", { name: "Acceptance criteria", exact: true })
    .fill("Required values fail fast.\nDevelopment defaults are documented.");
  await page
    .getByRole("textbox", { name: "Stop Condition", exact: true })
    .fill("Pause when a configuration default is unresolved.");
  await page.getByRole("button", { name: "Create card", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  await page
    .getByRole("button", { name: "Record work started", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Working", { exact: true }),
  ).toBeVisible();
  return title;
}
async function evidence(page: Page, revised = false) {
  await page
    .getByRole("button", { name: "Prepare review", exact: true })
    .click();
  await page
    .getByLabel("Change summary", { exact: true })
    .fill(
      revised
        ? "Added missing default coverage"
        : "Extracted typed configuration",
    );
  await page
    .getByLabel("Output links", { exact: true })
    .fill("https://example.com/synthetic-diff");
  await page
    .getByLabel("Test evidence", { exact: true })
    .fill(
      revised ? "Illustrative 13 tests passed" : "Illustrative 12 tests passed",
    );
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Awaiting review", { exact: true }),
  ).toBeVisible();
}

test("shared workflow records roles, handoff, filters, correction and approval across reload", async ({
  page,
}, testInfo) => {
  const title = await create(page);
  await page
    .getByRole("button", { name: "Request human input", exact: true })
    .click();
  await page
    .getByLabel("Question for the owner")
    .fill("Which local default should the example use?");
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Awaiting human input", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await page.getByRole("button", { name: /^Needs human input/ }).click();
  const tile = page.locator(".card").filter({
    has: page.getByRole("button", { name: new RegExp(`^${title}`) }),
  });
  await expect(tile).toBeVisible();
  await expect(
    tile.getByLabel(`Move ${title}`, { exact: true }),
  ).toBeDisabled();
  await expect(tile).toHaveAttribute("draggable", "false");
  await page.getByLabel("Filter by worker").selectOption("Config Agent");
  await page.screenshot({
    path: testInfo.outputPath("attention-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  await page
    .getByLabel("Human decision", { exact: true })
    .fill("Use 30 seconds locally; keep production explicit.");
  await page
    .getByRole("button", { name: "Record decision and resume", exact: true })
    .click();
  await evidence(page);
  await page
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await page.getByLabel("Reviewing as").selectOption("Sam Example");
  await page.getByRole("button", { name: /^Ready for my review/ }).click();
  await expect(tile).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  await page
    .getByRole("button", { name: "Request changes", exact: true })
    .click();
  await page
    .getByLabel("Changes required")
    .fill("Add the missing local default test.");
  await page
    .getByRole("button", { name: "Request changes", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Working", { exact: true }),
  ).toBeVisible();
  await evidence(page, true);
  await page.getByRole("button", { name: "Approve work", exact: true }).click();
  await page
    .getByLabel("Approval rationale")
    .fill("Reviewed the revised evidence against both acceptance criteria.");
  await page
    .getByRole("button", { name: "Approve and complete", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Approved", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  await expect(
    page.getByText("Requested human input", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Recorded decision and resumed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Submitted evidence for review", { exact: true }),
  ).toHaveCount(2);
  await expect(page.getByRole("dialog").locator(".status-badge")).toContainText(
    "Done",
  );
});

test("stale workflow entry retains the question and requires explicit replacement", async ({
  page,
}) => {
  await page.goto("/");
  const example = demoCard();
  const card = Object.fromEntries(
    ["id", "status", "sample", ...FIELDS].map((key) => [
      key,
      example[key as keyof typeof example],
    ]),
  );
  card.id = `stale-workflow-${Date.now()}`;
  card.title = "Stale workflow example";
  const created = await page.request.post(API, {
    headers: { origin: "http://127.0.0.1:3107" },
    data: { card },
  });
  expect(created.status()).toBe(201);
  await page.getByRole("button", { name: "Refresh board" }).click();
  await page.getByRole("button", { name: /^Stale workflow example/ }).click();
  await page.getByRole("button", { name: "Record work started" }).click();
  await page
    .getByRole("button", { name: "Request human input", exact: true })
    .click();
  await page
    .getByLabel("Question for the owner")
    .fill("Keep my unsaved question.");
  const other = await page.request.patch(`${API}/${card.id}`, {
    headers: { origin: "http://127.0.0.1:3107" },
    data: {
      expectedVersion: 2,
      command: { type: "request_input", note: "Another visitor question" },
    },
  });
  expect(other.status()).toBe(200);
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "changed since you opened",
  );
  await expect(page.getByLabel("Question for the owner")).toHaveValue(
    "Keep my unsaved question.",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("A newer version is available.")).toBeVisible();
  await page
    .getByRole("button", { name: "Load latest card", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep my draft", exact: true })
    .click();
  await expect(page.getByLabel("Question for the owner")).toHaveValue(
    "Keep my unsaved question.",
  );
  await page
    .getByRole("button", { name: "Load latest card", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard draft and load latest", exact: true })
    .click();
  await expect(page.getByLabel("Human decision", { exact: true })).toHaveValue(
    "",
  );
  await page
    .getByLabel("Human decision", { exact: true })
    .fill("Draft decision");
  await expect(
    page.getByRole("button", { name: "Edit card", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Human decision", { exact: true }).fill("");
  await expect(
    page.getByRole("button", { name: "Edit card", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".handoff-note")).toContainText(
    "Another visitor question",
  );
});

for (const width of [390, 1440])
  test(`guided simulation completes and resets without board requests at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    let apiRequests = 0;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.url().includes("/api/boards/")) apiRequests++;
    });
    await page.goto("/demo");
    await expect(
      page.getByText("Simulation · fictional data.", { exact: true }),
    ).toBeVisible();
    for (const step of demoSteps) {
      await page
        .getByRole("button", { name: step.button, exact: true })
        .click();
    }
    await expect(
      page.getByRole("heading", { name: "Reviewed and complete", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Submitted evidence for review", { exact: true }),
    ).toHaveCount(2);
    await expect(page.locator("[aria-current=step]")).toHaveText("Done");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`guided-${width}.png`),
      fullPage: true,
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Restart simulation", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: demoSteps[0].button, exact: true }),
    ).toBeVisible();
    expect(apiRequests).toBe(0);
    expect(errors).toEqual([]);
  });

test("mobile handoff retains drafts on failure and supports keyboard cancellation", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await create(page);
  await page
    .getByRole("button", { name: "Request human input", exact: true })
    .click();
  await page
    .getByLabel("Question for the owner")
    .fill("Keep this question if saving fails.");
  await page.route(`**${API}/*`, async (route) => {
    if (route.request().method() === "PATCH")
      return route.fulfill({
        status: 503,
        json: { error: "Synthetic workflow outage" },
      });
    return route.continue();
  });
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "Synthetic workflow outage",
  );
  await expect(page.getByLabel("Question for the owner")).toHaveValue(
    "Keep this question if saving fails.",
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".save-hint")).not.toContainText(
    "Saved to the board",
  );
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("handoff-mobile.png") });
  page.once("dialog", (prompt) => prompt.dismiss());
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  page.once("dialog", (prompt) => prompt.accept());
  await page
    .getByRole("button", { name: "Cancel workflow entry", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit card", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
