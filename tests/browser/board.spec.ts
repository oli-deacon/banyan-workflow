import { test, expect, type Page, type Route } from "@playwright/test";
import { blankCard } from "../../lib/board";
import { summarizeCard } from "../../lib/card-types";
import { newRecord, revision } from "../../lib/server/model";

const API = "/api/boards/modernization/cards";
async function fixture(page: Page) {
  let card = newRecord(
    {
      ...blankCard("To Do", "synthetic-test"),
      title: "Synthetic test",
      summary: "Original summary",
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
          cards: [{ ...summarizeCard(card), status: "To Do", version: 1 }],
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
    .selectOption("Done");
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
      .getByRole("region", { name: "Done", exact: true })
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
    .selectOption("Done");
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
  expect(state.card.status).toBe("Done");
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
  await page.getByRole("button", { name: "Create card", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Edit card", exact: true }).click();
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
    page.getByText("Saved by the real mock API", { exact: true }),
  ).toBeVisible();
  await page.getByText("Activity history", { exact: false }).click();
  await expect(page.getByText("Revision 2", { exact: false })).toHaveCount(1);
});

test("a successful background read does not erase an uncertain move outcome", async ({
  page,
}) => {
  const state = await fixture(page);
  state.failWrites = true;
  await page
    .getByLabel("Move Synthetic test", { exact: true })
    .selectOption("Done");
  const warning = page.locator("main").getByRole("alert");
  await expect(warning).toContainText("earlier write may have succeeded");
  const reads = state.reads;
  await resume(page);
  await expect.poll(() => state.reads).toBeGreaterThan(reads);
  await expect(warning).toContainText("earlier write may have succeeded");
  expect(state.card.version).toBe(1);
});
