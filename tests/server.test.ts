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
  assert.equal((await store.get(BOARD_ID, card.id)).activity.length, 2);
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

test("unchanged edits and moves preserve history and timestamps, but stale no-ops conflict", async () => {
  const store = new MemoryStore();
  const original = await store.create(BOARD_ID, card);
  for (const patch of [
    { card: { ...card, title: ` ${card.title} ` } },
    { status: card.status },
  ]) {
    const response = await handle(
      request("PATCH", { ...patch, expectedVersion: 1 }),
      BOARD_ID,
      card.id,
      store,
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).card, original);
  }
  await store.update(BOARD_ID, card.id, 1, { status: "Done" });
  const stale = await handle(
    request("PATCH", { status: "Done", expectedVersion: 1 }),
    BOARD_ID,
    card.id,
    store,
  );
  assert.equal(stale.status, 409);
  assert.equal((await store.get(BOARD_ID, card.id)).activity.length, 2);
});

test("Mongo no-op still checks the atomic version predicate and cannot replace a concurrent edit", async () => {
  const original = await new MemoryStore().create(BOARD_ID, card);
  let race = false;
  const collection = {
    findOne: async () => structuredClone(original),
    findOneAndUpdate: async (filter: object, update: { $set: RecordCard }) => {
      assert.deepEqual(filter, { boardId: BOARD_ID, id: card.id, version: 1 });
      assert.deepEqual(update.$set, original);
      return race ? null : structuredClone(original);
    },
  } as unknown as Collection<RecordCard>;
  const store = new MongoStore(collection);
  assert.deepEqual(await store.update(BOARD_ID, card.id, 1, card), original);
  race = true;
  await assert.rejects(
    store.update(BOARD_ID, card.id, 1, card),
    (e) => e instanceof ApiError && e.status === 409,
  );
});

test("list returns compact summaries; detail returns complete content with the same access boundaries", async () => {
  const store = new MemoryStore();
  const original = await store.create(BOARD_ID, {
    ...card,
    context: "x".repeat(20000),
  });
  const list = await handle(request("GET"), BOARD_ID, undefined, store);
  const data = await list.json();
  assert.deepEqual(Object.keys(data.cards[0]).sort(), [
    "id",
    "owner",
    "reviewer",
    "sample",
    "status",
    "summary",
    "title",
    "version",
    "workState",
    "worker",
    "workerKind",
  ]);
  assert.ok(JSON.stringify(data).length < 1000);
  const detail = await handle(request("GET"), BOARD_ID, card.id, store);
  assert.deepEqual((await detail.json()).card, original);
  assert.equal(detail.headers.get("cache-control"), "no-store");
  assert.equal(
    (await handle(request("GET"), BOARD_ID, "missing", store)).status,
    404,
  );
  assert.equal(
    (await handle(request("GET"), "other-board", card.id, store)).status,
    404,
  );
  assert.equal(
    (
      await handle(
        request("GET", undefined, BOARD_ID, { host: "remote.example" }),
        BOARD_ID,
        card.id,
        store,
      )
    ).status,
    403,
  );
});

test("Mongo list projects out detail and activity fields at the database", async () => {
  const collection = {
    find: (filter: object, options: { projection: object }) => {
      assert.deepEqual(filter, { boardId: BOARD_ID });
      assert.deepEqual(options.projection, {
        _id: 0,
        id: 1,
        title: 1,
        summary: 1,
        owner: 1,
        worker: 1,
        workerKind: 1,
        reviewer: 1,
        "workflow.state": 1,
        status: 1,
        sample: 1,
        version: 1,
      });
      return { sort: () => ({ toArray: async () => [] }) };
    },
  } as unknown as Collection<RecordCard>;
  assert.deepEqual(await new MongoStore(collection).list(BOARD_ID), []);
});

test("stop condition API create/edit/read roundtrip, clearing and legacy-client preservation", async () => {
  const store = new MemoryStore();
  const initial = {
    ...card,
    stopCondition: "Pause for interface review.\nKeep the draft.",
  };
  const created = await handle(
    request("POST", { card: initial }),
    BOARD_ID,
    undefined,
    store,
  );
  assert.equal(created.status, 201);
  assert.equal(
    (await created.json()).card.stopCondition,
    initial.stopCondition,
  );
  const changed = {
    ...initial,
    stopCondition: "Pause after two failed attempts.",
  };
  const edited = await handle(
    request("PATCH", { card: changed, expectedVersion: 1 }),
    BOARD_ID,
    card.id,
    store,
  );
  assert.equal(edited.status, 200);
  assert.deepEqual((await edited.json()).card.activity.at(-1).fields, [
    "stopCondition",
  ]);
  const legacy = { ...card, summary: "Older client edit" } as Partial<
    typeof card
  >;
  delete legacy.stopCondition;
  const oldEdit = await handle(
    request("PATCH", { card: legacy, expectedVersion: 2 }),
    BOARD_ID,
    card.id,
    store,
  );
  assert.equal(oldEdit.status, 200);
  assert.equal(
    (await oldEdit.json()).card.stopCondition,
    changed.stopCondition,
  );
  const read = await handle(request("GET"), BOARD_ID, card.id, store);
  assert.equal((await read.json()).card.stopCondition, changed.stopCondition);
  const clear = await handle(
    request("PATCH", {
      card: { ...card, stopCondition: "" },
      expectedVersion: 3,
    }),
    BOARD_ID,
    card.id,
    store,
  );
  assert.equal(clear.status, 200);
  assert.equal((await clear.json()).card.stopCondition, "");
});

test("stop condition validation accepts omission and boundary length, rejects invalid values", async () => {
  const legacy = { ...card } as Partial<typeof card>;
  delete legacy.stopCondition;
  assert.equal(parseCard(legacy).stopCondition, "");
  assert.equal(
    parseCard({ ...card, stopCondition: "x".repeat(20000) }).stopCondition
      .length,
    20000,
  );
  const store = new MemoryStore();
  for (const stopCondition of [null, 42, [], {}, true, "x".repeat(20001)]) {
    const response = await handle(
      request("POST", { card: { ...card, stopCondition } }),
      BOARD_ID,
      undefined,
      store,
    );
    assert.equal(response.status, 400);
  }
  const created = await handle(
    request("POST", { card: legacy }),
    BOARD_ID,
    undefined,
    store,
  );
  assert.equal(created.status, 201);
  assert.equal((await created.json()).card.stopCondition, "");
});

test("Mongo legacy reads normalize without writes and edits persist stop condition with version safety", async () => {
  const original = await new MemoryStore().create(BOARD_ID, card);
  let saved = { ...original } as RecordCard;
  delete (saved as Partial<RecordCard>).stopCondition;
  delete (saved as Partial<RecordCard>).owner;
  let writes = 0;
  const collection = {
    findOne: async () => structuredClone(saved),
    findOneAndUpdate: async (
      filter: { version: number },
      update: { $set: RecordCard },
    ) => {
      if (filter.version !== saved.version) return null;
      writes++;
      saved = structuredClone(update.$set);
      return structuredClone(saved);
    },
  } as unknown as Collection<RecordCard>;
  const store = new MongoStore(collection);
  assert.equal((await store.get(BOARD_ID, card.id)).stopCondition, "");
  assert.equal((await store.get(BOARD_ID, card.id)).owner, "");
  assert.equal(writes, 0);
  assert.equal(Object.hasOwn(saved, "stopCondition"), false);
  const noop = await store.update(BOARD_ID, card.id, 1, card);
  assert.equal(noop.version, 1);
  assert.equal(noop.activity.length, 1);
  const updated = await store.update(BOARD_ID, card.id, 1, {
    ...card,
    stopCondition: "Pause if evidence is missing.",
    owner: "Alex Example",
  });
  assert.equal(updated.stopCondition, "Pause if evidence is missing.");
  assert.equal(saved.stopCondition, updated.stopCondition);
  assert.equal(saved.owner, "Alex Example");
  assert.equal(updated.version, 2);
  assert.deepEqual(updated.activity.at(-1)?.fields, ["owner", "stopCondition"]);
  await assert.rejects(
    store.update(BOARD_ID, card.id, 1, card),
    (e) => e instanceof ApiError && e.status === 409,
  );
});

test("owner roundtrip, normalization, legacy preservation, clearing and conflict", async () => {
  const store = new MemoryStore();
  const created = await handle(
    request("POST", { card: { ...card, owner: "  Alex   Example  " } }),
    BOARD_ID,
    undefined,
    store,
  );
  assert.equal(created.status, 201);
  assert.equal((await created.json()).card.owner, "Alex Example");
  assert.equal((await store.list(BOARD_ID))[0].owner, "Alex Example");
  const legacy = { ...card, summary: "Older client" } as Partial<typeof card>;
  delete legacy.owner;
  const edit = await handle(
    request("PATCH", { card: legacy, expectedVersion: 1 }),
    BOARD_ID,
    card.id,
    store,
  );
  assert.equal(edit.status, 200);
  assert.equal((await edit.json()).card.owner, "Alex Example");
  const stale = await handle(
    request("PATCH", {
      card: { ...card, owner: "Sam Example" },
      expectedVersion: 1,
    }),
    BOARD_ID,
    card.id,
    store,
  );
  assert.equal(stale.status, 409);
  const clear = await handle(
    request("PATCH", { card: { ...legacy, owner: "" }, expectedVersion: 2 }),
    BOARD_ID,
    card.id,
    store,
  );
  assert.equal(clear.status, 200);
  const saved = (await clear.json()).card;
  assert.equal(saved.owner, "");
  assert.deepEqual(saved.activity.at(-1).fields, ["owner"]);
});

test("owner validation supports legacy omission and limits names", async () => {
  const legacy = { ...card } as Partial<typeof card>;
  delete legacy.owner;
  assert.equal(parseCard(legacy).owner, "");
  assert.equal(
    parseCard({ ...card, owner: "x".repeat(100) }).owner.length,
    100,
  );
  for (const owner of [null, 42, [], {}, true, "x".repeat(101)]) {
    const response = await handle(
      request("POST", { card: { ...card, owner } }),
      BOARD_ID,
      undefined,
      new MemoryStore(),
    );
    assert.equal(response.status, 400);
  }
});
