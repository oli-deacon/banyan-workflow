import test from "node:test";
import assert from "node:assert/strict";
import type { Collection } from "mongodb";
import { blankCard } from "../lib/board";
import { handle } from "../lib/server/api";
import { collectionName } from "../lib/server/access";
import { ApiError, BOARD_ID, type RecordCard } from "../lib/server/model";
import {
  MemoryStore, MongoStore, checkDemoWriteLimit, type DemoWriteBucket, type Store,
} from "../lib/server/store";

const origin = "https://demo.example";
const card = { ...blankCard("To Do", "demo-test"), title: "Synthetic demo" };
Object.assign(process.env, {
  NODE_ENV: "production",
  BANYAN_ACCESS: "public-demo",
  BANYAN_STORAGE: "mongodb",
  BANYAN_PUBLIC_ORIGIN: origin,
});
function request(method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/boards/${BOARD_ID}/cards`, {
    method,
    headers: { host: "demo.example", origin, "content-type": "application/json", ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function demoStore(): Store {
  return Object.assign(new MemoryStore(), { checkDemoWrite: async () => {} });
}

test("hosted demo persists shared edits, labels anonymous activity and rejects stale writes", async () => {
  const store = demoStore();
  const created = await handle(request("POST", { card }), BOARD_ID, undefined, store);
  assert.equal(created.status, 201);
  assert.equal((await created.json()).card.activity[0].actor, "public-demo-visitor");
  const results = await Promise.all(["Done", "In Progress"].map(status =>
    handle(request("PATCH", { status, expectedVersion: 1 }), BOARD_ID, card.id, store),
  ));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const loaded = await handle(request("GET"), BOARD_ID, undefined, store);
  const data = await loaded.json();
  assert.equal(data.mode, "public-demo");
  assert.equal(data.cards[0].version, 2);
  assert.equal(data.cards[0].activity[1].actor, "public-demo-visitor");
  assert.equal(loaded.headers.get("cache-control"), "no-store");
});

test("public demo rejects unapproved origins, forwarded hosts, and other boards", async () => {
  const store = demoStore();
  const invalidHeaders: Record<string, string>[] = [
    { origin: "https://attacker.example" },
    { origin: "" },
    { host: "preview.example" },
    { "x-forwarded-host": "attacker.example" },
    { forwarded: "host=attacker.example" },
    { "sec-fetch-site": "cross-site" },
  ];
  for (const headers of invalidHeaders) {
    assert.equal((await handle(request("POST", { card }, headers), BOARD_ID, undefined, store)).status, 403);
  }
  assert.equal((await handle(request("GET"), "private-board", undefined, store)).status, 404);
  assert.equal((await store.list(BOARD_ID)).length, 0);
});

test("production remains denied without explicit valid demo configuration", async () => {
  const store = demoStore();
  for (const [key, value] of [
    ["BANYAN_ACCESS", ""],
    ["BANYAN_STORAGE", "mock"],
    ["BANYAN_PUBLIC_ORIGIN", ""],
    ["BANYAN_PUBLIC_ORIGIN", "http://demo.example"],
    ["BANYAN_PUBLIC_ORIGIN", `${origin}/path`],
  ]) {
    const old = process.env[key];
    try {
      process.env[key] = value;
      assert.equal((await handle(request("GET"), BOARD_ID, undefined, store)).status, 403);
    } finally { process.env[key] = old; }
  }
});

test("demo collection is fixed and separate from the existing local board", () => {
  assert.equal(collectionName(), "cards_public_demo");
  try {
    delete process.env.BANYAN_ACCESS;
    assert.equal(collectionName(), "cards");
  } finally { process.env.BANYAN_ACCESS = "public-demo"; }
});

test("rate-limited and unavailable limiter requests cannot mutate cards", async () => {
  const store = demoStore();
  store.checkDemoWrite = async () => { throw new ApiError(429, "Busy", "DEMO_RATE_LIMIT"); };
  assert.equal((await handle(request("POST", { card }), BOARD_ID, undefined, store)).status, 429);
  delete store.checkDemoWrite;
  assert.equal((await handle(request("POST", { card }), BOARD_ID, undefined, store)).status, 503);
  assert.equal((await store.list(BOARD_ID)).length, 0);
});

test("shared Mongo counters bound concurrent writes and expire old buckets", async () => {
  const buckets = new Map<string, number>();
  const now = 1800000000000;
  const limits = {
    findOneAndUpdate: async (
      query: { _id: string },
      update: { $inc: { count: number }; $setOnInsert: { expiresAt: Date } },
      options: unknown,
    ) => {
      assert.deepEqual(options, { upsert: true, returnDocument: "after" });
      assert.equal(update.$inc.count, 1);
      assert.ok(update.$setOnInsert.expiresAt.getTime() > now);
      const count = (buckets.get(query._id) ?? 0) + 1;
      buckets.set(query._id, count);
      return { count };
    },
  } as unknown as Collection<DemoWriteBucket>;
  const results = await Promise.allSettled(Array.from({ length: 40 }, () => checkDemoWriteLimit(limits, now)));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 30);
  assert.ok(results.filter(r => r.status === "rejected").every(r => r.reason.status === 429));
  await checkDemoWriteLimit(limits, now + 60000);
  const day = Math.floor(now / 86400000) * 86400000;
  buckets.set(`86400000:${day}`, 500);
  await assert.rejects(checkDemoWriteLimit(limits, now + 120000), (e) => e instanceof ApiError && e.status === 429);
});

test("full demo refuses additional creates", async () => {
  const collection = {
    countDocuments: async () => 200,
    insertOne: async () => assert.fail("full demo must not insert"),
  } as unknown as Collection<RecordCard>;
  await assert.rejects(new MongoStore(collection).create(BOARD_ID, card), (e) => e instanceof ApiError && e.code === "DEMO_FULL");
});
