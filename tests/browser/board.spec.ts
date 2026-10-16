import { test, expect, type Page, type Route } from "@playwright/test";
import { blankCard } from "../../lib/board";
import { summarizeCard } from "../../lib/card-types";
import { newRecord, revision } from "../../lib/server/model";

const API = "/api/boards/modernization/cards";
async function fixture(page: Page) {
  let card = newRecord(
    {
      ...blankCard("Discover", "synthetic-test"),
      title: "Synthetic test",
      summary: "Original summary",
      objective: "Outcome", context: "Inputs", constraints: "Scope", acceptance: "Checks", references: "https://example.com/baseline", outputs: "Baseline", progress: "Unknowns recorded",
    },
    "modernization",
  );
  let failReads = false;
  let failWrites = false;
  let writes = 0;
  let reads = 0;
  let delayedRead: Route | undefined;
  let delayNextRead = false;
  await page.route(`**${API}**`, async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      if (new URL(request.url()).pathname === API) {
        reads++;
        if (delayNextRead) {
          delayNextRead = false;
          delayedRead = route;
          return;
        }
        return route.fulfill(
          failReads
            ? { status: 503, json: { error: "Synthetic read outage" } }
            : { json: { cards: [summarizeCard(card)], mode: "public-demo" } },
        );
      }
      return route.fulfill({ json: { card } });
    }
    writes++;
    if (failWrites)
      return route.fulfill({
        status: 502,
        contentType: "text/html",
        body: "<h1>Bad gateway</h1>",
      });
    const input = request.postDataJSON();
    if (input.expectedVersion !== card.version)
      return route.fulfill({
        status: 409,
        json: {
          error: "This card changed since you opened it.",
          code: "VERSION_CONFLICT",
        },
      });
    card = revision(card, input.card ?? { status: input.status });
    return route.fulfill({ json: { card } });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Synthetic test Original summary" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh board" }),
  ).toBeEnabled();
  return {
    get card() {
      return card;
    },
    get writes() {
      return writes;
    },
    get reads() {
      return reads;
    },
    set failReads(value: boolean) {
      failReads = value;
    },
    set failWrites(value: boolean) {
      failWrites = value;
    },
    editElsewhere() {
      card = revision(card, { ...cardPayload(), summary: "Colleague summary" });
    },
    delayRead() {
      delayNextRead = true;
    },
    get readIsWaiting() {
      return !!delayedRead;
    },
    async releaseRead() {
      // Deliberately return a snapshot from before any write.
      await delayedRead!.fulfill({
        json: {
          cards: [{ ...summarizeCard(card), status: "Discover", version: 1 }],
          mode: "public-demo",
        },
      });
      delayedRead = undefined;
    },
  };
  function cardPayload() {
    return {
      ...blankCard(card.status, card.id),
      title: card.title,
      summary: card.summary,
    };
  }
}
async function approve(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("checkbox")).toHaveCount(2);
  for (const checkbox of await dialog.getByRole("checkbox").all()) await checkbox.check();
  await dialog.getByRole("button", { name: "Approve handoff", exact: true }).click();
}
async function resume(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
}
async function edit(page: Page) {
  await page
    .getByRole("button", { name: "Synthetic test Original summary" })
    .click();
  await page.getByRole("button", { name: "Edit card", exact: true }).click();
}

test("unchanged saves are disabled and reverting a draft disables Save again", async ({
  page,
}) => {
  const state = await fixture(page);
  await edit(page);
  const save = page.getByRole("button", { name: "Save changes", exact: true });
  await expect(save).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Summary", exact: true })
    .fill("Changed summary");
  await expect(save).toBeEnabled();
  await page
    .getByRole("textbox", { name: "Summary", exact: true })
    .fill("Original summary");
  await expect(save).toBeDisabled();
  expect(state.writes).toBe(0);
});

test("successful background recovery clears manual refresh and polling errors", async ({
  page,
}) => {
  const state = await fixture(page);
  state.failReads = true;
  await page.getByRole("button", { name: "Refresh board" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Synthetic read outage",
  );
  await resume(page);
  await expect(page.getByText(/Updates paused/)).toBeVisible();
  state.failReads = false;
  state.editElsewhere();
  await resume(page);
  await expect(
    page.getByRole("button", { name: "Synthetic test Colleague summary" }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  await expect(page.getByText(/Updates paused/)).toHaveCount(0);
});

test("a delayed background read cannot overwrite a completed move", async ({
  page,
}) => {
  const state = await fixture(page);
  state.delayRead();
  await resume(page);
  await expect.poll(() => state.readIsWaiting).toBe(true);
  await page
    .getByLabel("Move Synthetic test", { exact: true })
    .selectOption("Decompose");
  await approve(page);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeVisible();
  await state.releaseRead();
  // Let the released response and React render settle before checking the board.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await expect(
    page
      .getByRole("region", { name: "Decompose", exact: true })
      .getByRole("button", { name: /Synthetic test/ }),
  ).toBeVisible();
  expect(state.card.version).toBe(2);
});

test("new shared revisions preserve dirty drafts and require explicit replacement", async ({
  page,
}) => {
  const state = await fixture(page);
  await edit(page);
  await page
    .getByRole("textbox", { name: "Summary", exact: true })
    .fill("My unsaved draft");
  state.editElsewhere();
  await resume(page);
  await expect(page.getByText("A newer version is available.")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Summary", exact: true }),
  ).toHaveValue("My unsaved draft");
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Load latest card", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep my draft", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Summary", exact: true }),
  ).toHaveValue("My unsaved draft");
  await page
    .getByRole("button", { name: "Load latest card", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard draft and load latest", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Summary", exact: true }),
  ).toHaveValue("Colleague summary");
  await expect(page.getByText("A newer version is available.")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toBe(0);
});

test("Undo uses the moved version and cannot overwrite another visitor's edit", async ({
  page,
}) => {
  const state = await fixture(page);
  await page
    .getByLabel("Move Synthetic test", { exact: true })
    .selectOption("Decompose");
  await approve(page);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeVisible();
  state.editElsewhere();
  await resume(page);
  await expect(
    page.getByRole("button", { name: "Synthetic test Colleague summary" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Undo could not be completed",
  );
  expect(state.card.status).toBe("Decompose");
  expect(state.card.version).toBe(3);
  expect(state.card.summary).toBe("Colleague summary");
});

test("non-JSON write failures keep the draft and give an uncertain-outcome message", async ({
  page,
}) => {
  const state = await fixture(page);
  await edit(page);
  await page
    .getByRole("textbox", { name: "Summary", exact: true })
    .fill("Keep this draft");
  state.failWrites = true;
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "earlier write may have succeeded",
  );
  await expect(
    page.getByRole("textbox", { name: "Summary", exact: true }),
  ).toHaveValue("Keep this draft");
  await resume(page);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "earlier write may have succeeded",
  );
});

test("five-minute polling waits for the interval and refreshes without user action", async ({
  page,
}) => {
  await page.clock.install();
  const state = await fixture(page);
  const before = state.reads;
  state.editElsewhere();
  await page.clock.fastForward(299000);
  expect(state.reads).toBe(before);
  await page.clock.fastForward(1000);
  await expect(
    page.getByRole("button", { name: "Synthetic test Colleague summary" }),
  ).toBeVisible();
});

test("real mock API loads card details and persists a create/edit across reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New card" }).click();
  const title = `Synthetic browser regression ${Date.now()}`;
  await page.getByLabel("Title Required").fill(title);
  await page.getByRole("button", { name: /Add more detail/ }).click();
  const stop = page.getByRole("textbox", {
    name: "Stop Condition",
    exact: true,
  });
  await expect(stop).toHaveAttribute("aria-describedby", "stop-condition-hint");
  await expect(page.locator("#stop-condition-hint")).toContainText(
    "pause and request human input",
  );
  await stop.fill("Pause if the interface changes.");
  await page.getByRole("button", { name: "Create card", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(
    page.getByText("Pause if the interface changes.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit card", exact: true }).click();
  await stop.fill("Pause if test evidence is missing.\nAsk for human review.");
  await page
    .getByLabel("Summary", { exact: true })
    .fill("Saved by the real mock API");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: `${title} Saved by the real mock API` })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Saved by the real mock API", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Stop Condition" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Pause if test evidence is missing.\nAsk for human review.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByText("Activity history", { exact: false }).click();
  await expect(
    page.getByText("Updated summary and stop condition", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Revision 2", { exact: false })).toHaveCount(1);
});

test("a successful background read does not erase an uncertain move outcome", async ({
  page,
}) => {
  const state = await fixture(page);
  state.failWrites = true;
  await page
    .getByLabel("Move Synthetic test", { exact: true })
    .selectOption("Decompose");
  await approve(page);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const warning = page.locator("main").getByRole("alert");
  await expect(warning).toContainText("earlier write may have succeeded");
  const reads = state.reads;
  await resume(page);
  await expect.poll(() => state.reads).toBeGreaterThan(reads);
  await expect(warning).toContainText("earlier write may have succeeded");
  expect(state.card.version).toBe(1);
});

test("handoff requires every criterion, can be cancelled, and cannot skip stages", async ({ page }) => {
  const state = await fixture(page);
  const move = page.getByLabel("Move Synthetic test", { exact: true });
  await expect(move.locator("option")).toHaveText(["Discover", "Decompose"]);
  await move.selectOption("Decompose");
  const dialog = page.getByRole("dialog");
  const approveButton = dialog.getByRole("button", { name: "Approve handoff" });
  await expect(approveButton).toBeDisabled();
  await dialog.getByRole("checkbox").first().check();
  await expect(approveButton).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toBe(0);
  await expect(move).toBeFocused();
  await move.selectOption("Decompose");
  await approve(page);
  await expect(page.getByRole("region", { name: "Decompose", exact: true }).getByRole("button", { name: /Synthetic test/ })).toBeVisible();
  expect(state.card.status).toBe("Decompose");
});

test("real API blocks incomplete handoffs, then accepts reviewed evidence and rework", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New card" }).click();
  const title = `Handoff flow ${Date.now()}`;
  await page.getByLabel("Title Required").fill(title);
  await page.getByRole("button", { name: "Create card", exact: true }).click();
  const move = page.getByLabel(`Move ${title}`, { exact: true });
  await move.selectOption("Decompose");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Add context, references, outputs, progress");
  await expect(page.getByRole("button", { name: "Approve handoff" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Edit card", exact: true }).click();
  await page.getByLabel("Objective", { exact: true }).fill("Modernize one unit");
  await page.getByLabel("Input context", { exact: true }).fill("Existing service map");
  await page.getByLabel("Constraints", { exact: true }).fill("Preserve API");
  await page.getByRole("textbox", { name: /^Reference links/ }).fill("https://example.com/baseline");
  await page.getByLabel("Outputs", { exact: true }).fill("Evidence-backed baseline");
  await page.getByLabel("Acceptance criteria", { exact: true }).fill("Contract tests pass");
  await page.getByLabel("Progress & blockers", { exact: true }).fill("Scope ready; return here if the boundary needs revision");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await move.selectOption("Decompose");
  await approve(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(move).toHaveValue("Decompose");
  await move.selectOption("Discover");
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirm return", exact: true }).click();
  await expect(move).toHaveValue("Discover");
});

test("agent contracts and board remain readable at desktop and mobile sizes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Discover", exact: true })).toBeVisible();
  await page.screenshot({ path: "output/aidlc-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("region", { name: "Decompose", exact: true }).getByText("AI contribution & handoff").click();
  await expect(page.getByText("Humans have approved the modernization unit boundaries.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "output/aidlc-mobile.png", fullPage: true });
});

test("agent names open repository specifications, shared contract and restore keyboard focus", async ({ page }) => {
  await page.goto("/");
  const lead = page.getByRole("region", { name: "Discover", exact: true }).getByRole("button", { name: "View architect-agent specification" });
  await lead.focus();
  await lead.press("Enter");
  const panel = page.getByRole("dialog", { name: "architect-agent", exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Responsibilities by phase", exact: true })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Handoff criteria", exact: true })).toHaveCount(1);
  await expect(panel.getByText("Evidence-backed baseline, with unresolved questions recorded", { exact: true })).toHaveCount(1);
  await page.getByRole("dialog").getByRole("button", { name: "Shared handoff contract", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Phase ownership and exit conditions", exact: true })).toHaveCount(1);
  await page.getByRole("dialog").getByRole("button", { name: "Developer agent", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "developer-agent", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(lead).toBeFocused();
  for (const agent of ["pm-agent", "developer-agent", "quality-agent", "verifier-agent"]) {
    await page.getByRole("button", { name: `View ${agent} specification`, exact: true }).first().click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Domain boundaries", exact: true })).toHaveCount(1);
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Inputs", exact: true })).toHaveCount(1);
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Outputs", exact: true })).toHaveCount(1);
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Handoff criteria", exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "Close agent specification" }).click();
  }
});

test("agent specifications fit mobile and supporting agents are accessible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("region", { name: "Specify", exact: true }).getByRole("button", { name: "View quality-agent specification" }).click();
  await expect(page.getByRole("dialog", { name: "quality-agent", exact: true })).toBeVisible();
  await page.screenshot({ path: "output/agent-spec-desktop.png", animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("button", { name: "Close agent specification" })).toBeVisible();
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await panel.getByRole("heading", { name: "Handoff criteria", exact: true }).scrollIntoViewIfNeeded();
  await expect(panel.getByRole("heading", { name: "Handoff criteria", exact: true })).toBeVisible();
  await page.screenshot({ path: "output/agent-spec-mobile.png", animations: "disabled" });
});

test("legacy details without optional fields remain readable and editable", async ({
  page,
}) => {
  const legacy = newRecord(
    { ...blankCard("Discover", "legacy-test"), title: "Legacy sample" },
    "modernization",
  );
  delete (legacy as Partial<typeof legacy>).stopCondition;
  delete (legacy as Partial<typeof legacy>).owner;
  await page.route(`**${API}**`, async (route) => {
    if (new URL(route.request().url()).pathname === API)
      return route.fulfill({
        json: { cards: [summarizeCard(legacy)], mode: "mock" },
      });
    return route.fulfill({ json: { card: legacy } });
  });
  await page.goto("/");
  await expect(page.locator(".owner-name")).toHaveText("Unassigned");
  await page.getByRole("button", { name: /^Legacy sample/ }).click();
  await expect(
    page.getByRole("heading", { name: "Stop Condition" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Edit card", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Stop Condition", exact: true }),
  ).toHaveValue("");
});

for (const width of [390, 1440]) {
  test(`sample stop condition reading and editing fit at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page
      .getByRole("button", {
        name: /Map the legacy service boundaries Find the seams/,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Stop Condition" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        /Pause and ask for human input if dependencies are ambiguous/,
      ),
    ).toBeVisible();
    const dialog = page.getByRole("dialog");
    expect(
      await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "Edit card", exact: true }).click();
    const stop = page.getByRole("textbox", {
      name: "Stop Condition",
      exact: true,
    });
    await stop.scrollIntoViewIfNeeded();
    await expect(stop).toBeVisible();
    await expect(stop).toHaveValue(
      /Pause and ask for human input if dependencies are ambiguous/,
    );
    expect(
      await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`stop-condition-${width}.png`),
    });
  });
}

test("owner creates, edits, reloads and clears through the real API", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "New card" }).click();
  const title = `Owner regression ${Date.now()}`;
  await page.getByLabel("Title Required").fill(title);
  const owner = page.getByRole("textbox", { name: "Owner", exact: true });
  await expect(owner).toHaveAttribute("maxlength", "100");
  await owner.fill("Alex Example");
  await page.getByRole("button", { name: "Create card", exact: true }).click();
  const tile = page
    .locator(".card")
    .filter({
      has: page.getByRole("button", { name: new RegExp(`^${title}`) }),
    });
  await expect(tile.locator(".owner-name")).toHaveText("Alex Example");
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  await expect(page.locator(".reading-owner")).toContainText("Alex Example");
  await page.getByRole("button", { name: "Edit card", exact: true }).click();
  await owner.fill("Sam Example");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(tile.locator(".owner-name")).toHaveText("Sam Example");
  await page.screenshot({
    path: testInfo.outputPath("owner-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: testInfo.outputPath("owner-desktop.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  await expect(page.locator(".reading-owner")).toContainText("Sam Example");
  await page.getByRole("button", { name: "Edit card", exact: true }).click();
  await owner.fill("");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(tile.locator(".owner-name")).toHaveText("Unassigned");
});
