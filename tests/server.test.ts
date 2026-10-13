import test from "node:test";
import assert from "node:assert/strict";
import type { Collection } from "mongodb";
import { blankCard } from "../lib/board";
import {
  ApiError,
  BOARD_ID,
  parseCard,
  type RecordCard,
} from "../lib/server/model";
import { MemoryStore, MongoStore, seed } from "../lib/server/store";
import { handle } from "../lib/server/api";
const card = {
  ...blankCard("To Do", "test-card"),
  title: "Synthetic server test",
};
function request(
  method: string,
  body?: unknown,
  path = BOARD_ID,
  headers: Record<string, string> = {},
) {
  return new Request(`http://127.0.0.1:3101/api/boards/${path}/cards`, {
    method,
    headers: {
      host: "127.0.0.1:3101",
      origin: "http://127.0.0.1:3101",
      "content-type": "application/json",
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
Object.assign(process.env, {
  NODE_ENV: "test",
  BANYAN_LOCAL_API: "1",
  BANYAN_STORAGE: "mock",
});
test("API create, edit and move increment version with coherent activity", async () => {
  const store = new MemoryStore();
  const create = await handle(
    request("POST", { card }),
    BOARD_ID,
    undefined,
    store,
  );
  assert.equal(create.status, 201);
  const created = (await create.json()).card;
  assert.equal(created.version, 1);
  const edit = await handle(
    request("PATCH", {
      card: { ...card, summary: "Updated" },
      expectedVersion: 1,
    }),
    BOARD_ID,
    card.id,
    store,
  );
  assert.equal(edit.status, 200);
  const move = await handle(
    request("PATCH", { status: "Done", expectedVersion: 2 }),
    BOARD_ID,
    card.id,
    store,
  );
  const saved = (await move.json()).card;
  assert.equal(saved.version, 3);
  assert.equal(saved.summary, "Updated");
  assert.equal(saved.status, "Done");
  assert.deepEqual(
    saved.activity.map((a: { action: string }) => a.action),
    ["created", "edited", "moved"],
  );
  assert.equal(saved.activity[2].from, "To Do");
  assert.equal(saved.activity[2].to, "Done");
});
test("concurrent writes accept one version and explicitly reject stale edits", async () => {
  const store = new MemoryStore();
  await store.create(BOARD_ID, card);
  const results = await Promise.all(
    ["Done", "In Progress"].map((status) =>
      handle(
        request("PATCH", { status, expectedVersion: 1 }),
        BOARD_ID,
        card.id,
        store,
      ),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await store.list(BOARD_ID))[0].activity.length, 2);
  const stale = results.find((r) => r.status === 409)!;
  assert.equal((await stale.json()).code, "VERSION_CONFLICT");
});
test("seed is idempotent and never resets edited samples", async () => {
  const store = new MemoryStore();
  await Promise.all([seed(store), seed(store)]);
  const initial = await store.list(BOARD_ID);
  assert.equal(initial.length, 5);
  await store.update(BOARD_ID, initial[0].id, 1, { status: "Done" });
  await seed(store);
  const after = await store.list(BOARD_ID);
  assert.equal(after.length, 5);
  assert.equal(after[0].version, 2);
  assert.equal(after[0].status, "Done");
});
test("board boundaries prevent reads and mutations across boards", async () => {
  const store = new MemoryStore();
  await store.create("other-board", card);
  assert.equal((await store.list(BOARD_ID)).length, 0);
  await assert.rejects(
    store.update(BOARD_ID, card.id, 1, { status: "Done" }),
    (e) => e instanceof ApiError && e.status === 404,
  );
  assert.equal(
    (
      await handle(
        request("GET", undefined, "other-board"),
        "other-board",
        undefined,
        store,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await handle(
        request("POST", { card, boardId: "other-board" }),
        BOARD_ID,
        undefined,
        store,
      )
    ).status,
    400,
  );
});
test("server validation rejects untrusted shapes, unsafe links, missing versions, injected state", async () => {
  const store = new MemoryStore();
  for (const bad of [
    { ...card, title: " " },
    { ...card, references: "javascript:alert(1)" },
    { ...card, title: [] },
    { ...card, version: 100 },
    { ...card, boardId: "other-board" },
    { ...card, agentState: "running" },
  ]) {
    assert.equal(
      (await handle(request("POST", { card: bad }), BOARD_ID, undefined, store))
        .status,
      400,
    );
  }
  assert.equal(
    (
      await handle(
        request("PATCH", { status: "Done" }),
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
        request("POST", { card: { ...card, context: "x".repeat(200001) } }),
        BOARD_ID,
        undefined,
        store,
      )
    ).status,
    413,
  );
  assert.throws(() => parseCard(null));
});
test("API denies cross-origin, remote hosts, disabled mode and production", async () => {
  const store = new MemoryStore();
  assert.equal(
    (
      await handle(
        request("POST", { card }, BOARD_ID, {
          origin: "https://elsewhere.example",
        }),
        BOARD_ID,
        undefined,
        store,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handle(
        request("GET", undefined, BOARD_ID, { host: "public.example" }),
        BOARD_ID,
        undefined,
        store,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handle(
        request("GET", undefined, BOARD_ID, { "sec-fetch-site": "cross-site" }),
        BOARD_ID,
        undefined,
        store,
      )
    ).status,
    403,
  );
  process.env.BANYAN_LOCAL_API = "0";
  assert.equal(
    (await handle(request("GET"), BOARD_ID, undefined, store)).status,
    403,
  );
  process.env.BANYAN_LOCAL_API = "1";
  Object.assign(process.env, { NODE_ENV: "production" });
  assert.equal(
    (await handle(request("GET"), BOARD_ID, undefined, store)).status,
    403,
  );
  Object.assign(process.env, { NODE_ENV: "test" });
});
test("unknown database failures do not expose secrets or claim success", async () => {
  const broken = {
    list: async () => {
      throw Error("mongodb://secret:password@host");
    },
  } as unknown as MemoryStore;
  const response = await handle(request("GET"), BOARD_ID, undefined, broken);
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("password"));
});
test("Mongo adapter uses atomic board/id/version predicate; losing race adds no history", async () => {
  let saved: RecordCard | undefined;
  const collection = {
    insertOne: async (document: RecordCard) => {
      saved = structuredClone(document);
    },
    findOne: async (filter: { boardId: string; id: string }) =>
      saved?.boardId === filter.boardId && saved.id === filter.id
        ? structuredClone(saved)
        : null,
    findOneAndUpdate: async (
      filter: { boardId: string; id: string; version: number },
      update: { $set: RecordCard },
    ) => {
      assert.deepEqual(Object.keys(filter).sort(), [
        "boardId",
        "id",
        "version",
      ]);
      if (
        !saved ||
        saved.boardId !== filter.boardId ||
        saved.id !== filter.id ||
        saved.version !== filter.version
      )
        return null;
      saved = structuredClone(update.$set);
      return structuredClone(saved);
    },
  } as unknown as Collection<RecordCard>;
  const store = new MongoStore(collection);
  await store.create(BOARD_ID, card);
  const results = await Promise.allSettled([
    store.update(BOARD_ID, card.id, 1, { status: "Done" }),
    store.update(BOARD_ID, card.id, 1, { status: "In Progress" }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(saved!.version, 2);
  assert.equal(saved!.activity.length, 2);
  await assert.rejects(
    store.update("other", card.id, 2, { status: "To Do" }),
    (e) => e instanceof ApiError && e.status === 404,
  );
});
test("Mongo seeding uses insert-only upsert and retains the existing document", async () => {
  let saved: RecordCard | undefined;
  const collection = {
    updateOne: async (
      filter: unknown,
      update: { $setOnInsert: RecordCard },
      options: unknown,
    ) => {
      assert.deepEqual(options, { upsert: true });
      assert.deepEqual(Object.keys(update), ["$setOnInsert"]);
      saved ??= structuredClone(update.$setOnInsert);
    },
    findOne: async () => saved,
  } as unknown as Collection<RecordCard>;
  const store = new MongoStore(collection);
  await store.create(BOARD_ID, card, true);
  saved!.title = "Existing work";
  await store.create(BOARD_ID, card, true);
  assert.equal(saved!.title, "Existing work");
});
