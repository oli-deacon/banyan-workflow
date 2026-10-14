import test from "node:test";
import assert from "node:assert/strict";
import type { Collection } from "mongodb";
import { blankCard } from "../lib/board";
import { summarizeCard } from "../lib/card-types";
import { demoCard, demoSteps, advanceDemo } from "../lib/demo-scenario";
import { needsAttention } from "../lib/attention";
import { blankWorkflow, parseCommand } from "../lib/workflow";
import {
  ApiError,
  BOARD_ID,
  newRecord,
  parseCard,
  revision,
  type RecordCard,
} from "../lib/server/model";
import { MemoryStore, MongoStore } from "../lib/server/store";
import { handle } from "../lib/server/api";
Object.assign(process.env, {
  NODE_ENV: "test",
  BANYAN_LOCAL_API: "1",
  BANYAN_STORAGE: "mock",
});
const payload = () => {
  const {
    id,
    version,
    activity,
    boardId,
    workflow,
    createdAt,
    updatedAt,
    ...fields
  } = demoCard();
  void version;
  void activity;
  void boardId;
  void workflow;
  void createdAt;
  void updatedAt;
  return { ...fields, id };
};
function request(body: unknown, method = "PATCH", headers = {}) {
  return new Request(`http://127.0.0.1:3101/api/boards/${BOARD_ID}/cards`, {
    method,
    headers: {
      host: "127.0.0.1:3101",
      origin: "http://127.0.0.1:3101",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("whole workflow retains questions, decisions, both evidence snapshots and declared roles", async () => {
  const store = new MemoryStore();
  let card = await store.create(BOARD_ID, payload());
  for (const step of demoSteps) {
    const response = await handle(
      request({ expectedVersion: card.version, command: step.command }),
      BOARD_ID,
      card.id,
      store,
    );
    assert.equal(response.status, 200, step.title);
    card = (await response.json()).card;
    assert.equal(card.activity.length, card.version);
  }
  assert.equal(card.status, "Done");
  assert.equal(card.workflow.state, "approved");
  assert.equal(card.workflow.attempt, 3);
  assert.equal(card.activity[2].workflow?.role, "agent");
  assert.equal(card.activity[3].workflow?.name, "Alex Example");
  assert.equal(card.activity[5].workflow?.name, "Sam Example");
  assert.match(card.activity[4].workflow!.evidence!.tests, /12 passing/);
  assert.match(card.activity[6].workflow!.evidence!.tests, /13 passing/);
  assert.equal((await store.list(BOARD_ID))[0].workState, "approved");
  const oldSnapshot = structuredClone(card.activity[4]);
  const edited = await store.update(BOARD_ID, card.id, card.version, {
    ...payload(),
    status: "Done",
    acceptance: "A new requirement",
  });
  assert.equal(edited.status, "In Progress");
  assert.equal(edited.workflow.state, "working");
  assert.equal(edited.workflow.evidence, null);
  assert.deepEqual(edited.activity[4], oldSnapshot);
  assert.equal(edited.activity.at(-1)?.workflow?.type, "brief_changed");
});

test("invalid transitions and direct moves cannot bypass human input or approval", async () => {
  const store = new MemoryStore();
  const card = await store.create(BOARD_ID, payload());
  for (const command of [
    { type: "approve", note: "skip" },
    { type: "resume", note: "skip" },
    demoSteps[3].command,
  ]) {
    const result = await handle(
      request({ expectedVersion: 1, command }),
      BOARD_ID,
      card.id,
      store,
    );
    assert.equal(result.status, 400);
  }
  await store.update(BOARD_ID, card.id, 1, { command: { type: "start" } });
  for (const status of ["Done", "Ready for Review", "To Do"]) {
    assert.equal(
      (
        await handle(
          request({ expectedVersion: 2, status }),
          BOARD_ID,
          card.id,
          store,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await handle(
          request({ expectedVersion: 2, card: { ...payload(), status } }),
          BOARD_ID,
          card.id,
          store,
        )
      ).status,
      400,
    );
  }
  await store.update(BOARD_ID, card.id, 2, { command: demoSteps[1].command });
  assert.equal(
    (
      await handle(
        request({ expectedVersion: 3, command: demoSteps[3].command }),
        BOARD_ID,
        card.id,
        store,
      )
    ).status,
    400,
  );
  assert.equal((await store.get(BOARD_ID, card.id)).version, 3);
});

test("commands reject spoofed state, actors, invalid evidence, types, links and oversized history", async () => {
  const store = new MemoryStore();
  const card = await store.create(BOARD_ID, payload());
  await store.update(BOARD_ID, card.id, 1, { command: { type: "start" } });
  for (const command of [
    null,
    [],
    { type: "start", actor: "admin" },
    { type: "pause" },
    { type: "request_input", note: " " },
    { type: "request_input", note: 22 },
    { type: "request_input", note: "x".repeat(2001) },
  ])
    assert.equal(
      (
        await handle(
          request({ expectedVersion: 2, command }),
          BOARD_ID,
          card.id,
          store,
        )
      ).status,
      400,
    );
  const base = demoSteps[3].command;
  assert.equal(base.type, "submit_review");
  if (base.type !== "submit_review") return;
  for (const evidence of [
    { ...base.evidence, links: ["javascript:alert(1)"] },
    { ...base.evidence, links: [] },
    { ...base.evidence, tests: "" },
    {
      ...base.evidence,
      criteria: base.evidence.criteria.map((item) => ({
        ...item,
        checked: false,
      })),
    },
    {
      ...base.evidence,
      criteria: [{ text: "Invented criterion", checked: true }],
    },
    { ...base.evidence, criteria: [{ text: "foo", checked: "yes" }] },
    {
      ...base.evidence,
      links: Array.from(
        { length: 10 },
        () => `https://example.com/${"x".repeat(1800)}`,
      ),
    },
  ])
    assert.equal(
      (
        await handle(
          request({
            expectedVersion: 2,
            command: { type: "submit_review", evidence },
          }),
          BOARD_ID,
          card.id,
          store,
        )
      ).status,
      400,
    );
  assert.equal(
    (
      await handle(
        request({
          expectedVersion: 2,
          card: { ...payload(), workflow: { state: "approved" } },
        }),
        BOARD_ID,
        card.id,
        store,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handle(
        request({
          expectedVersion: 2,
          status: "Done",
          command: { type: "start" },
        }),
        BOARD_ID,
        card.id,
        store,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handle(
        request(
          {
            expectedVersion: 2,
            command: { type: "request_input", note: "question" },
          },
          "PATCH",
          { origin: "https://elsewhere.example" },
        ),
        BOARD_ID,
        card.id,
        store,
      )
    ).status,
    403,
  );
  assert.equal((await store.get(BOARD_ID, card.id)).version, 2);
});

test("start requires roles and brief; role validation and legacy clients preserve assignments", async () => {
  for (const field of [
    "owner",
    "worker",
    "reviewer",
    "objective",
    "acceptance",
    "stopCondition",
  ] as const) {
    const card = newRecord({ ...payload(), [field]: "" }, BOARD_ID);
    assert.throws(
      () => revision(card, { command: { type: "start" } }),
      ApiError,
    );
  }
  for (const fields of [
    { workerKind: "robot" },
    { worker: 9 },
    { reviewer: "x".repeat(101) },
  ])
    assert.throws(() => parseCard({ ...payload(), ...fields }), ApiError);
  const store = new MemoryStore();
  const card = await store.create(BOARD_ID, payload());
  const legacy = { ...payload(), summary: "Legacy client edit" } as Partial<
    ReturnType<typeof payload>
  >;
  delete legacy.worker;
  delete legacy.workerKind;
  delete legacy.reviewer;
  const result = await handle(
    request({ expectedVersion: 1, card: legacy }),
    BOARD_ID,
    card.id,
    store,
  );
  assert.equal(result.status, 200);
  const saved = (await result.json()).card;
  assert.equal(saved.worker, "Config Agent");
  assert.equal(saved.workerKind, "agent");
  assert.equal(saved.reviewer, "Sam Example");
});

test("simultaneous and stale workflow commands create exactly one event", async () => {
  const store = new MemoryStore();
  const card = await store.create(BOARD_ID, payload());
  const responses = await Promise.all(
    [1, 2].map(() =>
      handle(
        request({ expectedVersion: 1, command: { type: "start" } }),
        BOARD_ID,
        card.id,
        store,
      ),
    ),
  );
  assert.deepEqual(responses.map((item) => item.status).sort(), [200, 409]);
  const saved = await store.get(BOARD_ID, card.id);
  assert.equal(saved.activity.length, 2);
  assert.equal(saved.workflow.attempt, 1);
});

test("Mongo workflow uses atomic version guard, normalizes legacy reads and persists the full event", async () => {
  let saved = newRecord(payload(), BOARD_ID);
  delete (saved as Partial<RecordCard>).workflow;
  delete (saved as Partial<RecordCard>).worker;
  delete (saved as Partial<RecordCard>).workerKind;
  delete (saved as Partial<RecordCard>).reviewer;
  let writes = 0;
  let loseRace = false;
  const collection = {
    findOne: async () => structuredClone(saved),
    findOneAndUpdate: async (filter: object, update: { $set: RecordCard }) => {
      assert.deepEqual(filter, {
        boardId: BOARD_ID,
        id: saved.id,
        version: saved.version,
      });
      if (loseRace) return null;
      writes++;
      saved = structuredClone(update.$set);
      return structuredClone(saved);
    },
  } as unknown as Collection<RecordCard>;
  const store = new MongoStore(collection);
  const legacy = await store.get(BOARD_ID, saved.id);
  assert.deepEqual(legacy.workflow, blankWorkflow());
  assert.equal(legacy.worker, "");
  assert.equal(writes, 0);
  await store.update(BOARD_ID, saved.id, 1, payload());
  await store.update(BOARD_ID, saved.id, 2, { command: { type: "start" } });
  assert.equal(saved.workflow.state, "working");
  assert.equal(saved.activity.at(-1)?.workflow?.name, "Config Agent");
  const before = structuredClone(saved);
  loseRace = true;
  await assert.rejects(
    store.update(BOARD_ID, saved.id, 3, { command: demoSteps[1].command }),
    (e) => e instanceof ApiError && e.status === 409,
  );
  assert.deepEqual(saved, before);
});

test("attention filters reflect workflow and reviewer; simulations are independent and repeatable", () => {
  let card = demoCard();
  const original = demoCard();
  for (const step of demoSteps.slice(0, 2))
    card = advanceDemo(card, step.command);
  assert.equal(needsAttention(summarizeCard(card), "input", ""), true);
  for (const step of demoSteps.slice(2, 4))
    card = advanceDemo(card, step.command);
  assert.equal(
    needsAttention(summarizeCard(card), "mine", "Sam Example"),
    true,
  );
  assert.equal(
    needsAttention(summarizeCard(card), "mine", "Alex Example"),
    false,
  );
  assert.equal(needsAttention(summarizeCard(card), "mine", ""), false);
  assert.equal(original.workflow.state, "idle");
  assert.deepEqual(original, demoCard());
  assert.throws(() =>
    parseCommand({ type: "start", workflow: blankWorkflow() }),
  );
  const bare = blankCard();
  assert.equal(bare.workerKind, "human");
});
