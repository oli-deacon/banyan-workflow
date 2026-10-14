import test from "node:test";
import assert from "node:assert/strict";
import type { Collection } from "mongodb";
import { blankCard, FIELDS, samples } from "../lib/board";
import { BOARD_ID, newRecord, type RecordCard } from "../lib/server/model";
import {
  backfillSampleStopConditions,
  parseBackfillArgs,
} from "../lib/server/sample-stop-conditions";

function fixture() {
  const records = samples.map((sample) => {
    const card = newRecord(sample, BOARD_ID, true);
    delete (card as Partial<RecordCard>).stopCondition;
    return card;
  });
  records.push(
    newRecord(
      { ...blankCard("To Do", "user-added"), title: "User card" },
      BOARD_ID,
    ),
  );
  let writes = 0;
  let beforeWrite: ((record: RecordCard) => void) | undefined;
  const collection = {
    findOne: async ({ boardId, id }: { boardId: string; id: string }) =>
      structuredClone(
        records.find((card) => card.boardId === boardId && card.id === id) ??
          null,
      ),
    updateOne: async (
      filter: Record<string, unknown>,
      update: { $set: Partial<RecordCard> },
      options?: unknown,
    ) => {
      writes++;
      assert.equal(options, undefined); // no upsert
      assert.deepEqual(Object.keys(update), ["$set"]);
      assert.deepEqual(Object.keys(update.$set).sort(), [
        "activity",
        "stopCondition",
        "updatedAt",
        "version",
      ]);
      assert.deepEqual(filter.$or, [
        { stopCondition: { $exists: false } },
        { stopCondition: "" },
      ]);
      for (const key of [
        "boardId",
        "id",
        "sample",
        "version",
        ...FIELDS.filter(
          (field) =>
            field !== "stopCondition" &&
            !["owner", "worker", "workerKind", "reviewer"].includes(field),
        ),
      ])
        assert.ok(Object.hasOwn(filter, key));
      const record = records.find(
        (card) => card.boardId === filter.boardId && card.id === filter.id,
      );
      if (!record) return { modifiedCount: 0 };
      beforeWrite?.(record);
      if (
        (record.stopCondition !== undefined && record.stopCondition !== "") ||
        Object.entries(filter).some(
          ([key, value]) =>
            key !== "$or" && record[key as keyof RecordCard] !== value,
        )
      )
        return { modifiedCount: 0 };
      Object.assign(record, structuredClone(update.$set));
      return { modifiedCount: 1 };
    },
  } as unknown as Collection<RecordCard>;
  return {
    records,
    collection,
    get writes() {
      return writes;
    },
    race(fn: (record: RecordCard) => void) {
      beforeWrite = fn;
    },
  };
}

test("backfill dry run writes nothing; apply fills only known samples and is idempotent", async () => {
  const f = fixture();
  f.records[0].status = "Done"; // preserve moves
  f.records[1].stopCondition = "";
  f.records[0].owner = "Alex Example";
  delete (f.records[1] as Partial<RecordCard>).owner;
  const before = structuredClone(f.records);
  assert.ok(
    (await backfillSampleStopConditions(f.collection)).every(
      ({ outcome }) => outcome === "would-fill",
    ),
  );
  assert.equal(f.writes, 0);
  assert.deepEqual(f.records, before);
  assert.ok(
    (await backfillSampleStopConditions(f.collection, true)).every(
      ({ outcome }) => outcome === "filled",
    ),
  );
  assert.equal(f.writes, 5);
  assert.equal(f.records.length, 6);
  assert.deepEqual(f.records.at(-1), before.at(-1));
  f.records.slice(0, 5).forEach((card, index) => {
    assert.equal(card.stopCondition, samples[index].stopCondition);
    assert.equal(card.version, 2);
    assert.equal(card.status, before[index].status);
    assert.equal(card.owner, before[index].owner);
    assert.equal(
      Object.hasOwn(card, "owner"),
      Object.hasOwn(before[index], "owner"),
    );
    assert.equal(card.createdAt, before[index].createdAt);
    assert.deepEqual(card.activity.slice(0, -1), before[index].activity);
    assert.deepEqual(card.activity.at(-1)?.fields, ["stopCondition"]);
    assert.equal(card.activity.at(-1)?.actor, "sample-seed");
  });
  const after = structuredClone(f.records);
  assert.ok(
    (await backfillSampleStopConditions(f.collection, true)).every(
      ({ outcome }) => outcome === "already-set",
    ),
  );
  assert.equal(f.writes, 5);
  assert.deepEqual(f.records, after);
});

test("backfill skips existing text, changed task context, non-samples and missing/other-board cards", async () => {
  const f = fixture();
  f.records[0].stopCondition = "Human-authored stop condition";
  f.records[1].objective = "New objective";
  f.records[2].sample = false;
  f.records[3].boardId = "other-board";
  f.records.splice(4, 1);
  const before = structuredClone(f.records);
  const results = await backfillSampleStopConditions(f.collection, true);
  assert.deepEqual(
    results.map(({ outcome }) => outcome),
    [
      "already-set",
      "review-changed-context",
      "review-changed-context",
      "missing",
      "missing",
    ],
  );
  assert.equal(f.writes, 0);
  assert.deepEqual(f.records, before);
});

test("backfill conflicts preserve concurrent edits, including missing-field and context changes without a version bump", async () => {
  for (const race of [
    (record: RecordCard) => {
      record.version++;
      record.summary = "Concurrent edit";
    },
    (record: RecordCard) => {
      record.stopCondition = "Concurrent human input";
    },
    (record: RecordCard) => {
      record.objective = "Changed context";
    },
  ]) {
    const f = fixture();
    f.race(race);
    const results = await backfillSampleStopConditions(f.collection, true);
    assert.ok(results.every(({ outcome }) => outcome === "conflict"));
    f.records
      .slice(0, 5)
      .forEach((card) => assert.equal(card.activity.length, 1));
  }
});

test("backfill requires an explicit allowed collection and defaults to dry run", () => {
  for (const target of ["cards", "cards_public_demo"]) {
    assert.deepEqual(parseBackfillArgs([`--collection=${target}`]), {
      collection: target,
      apply: false,
    });
    assert.deepEqual(parseBackfillArgs([`--collection=${target}`, "--apply"]), {
      collection: target,
      apply: true,
    });
  }
  for (const args of [
    [],
    ["--apply"],
    ["--collection=other"],
    ["--collection=cards", "--force"],
    ["--collection=cards", "--collection=cards_public_demo"],
  ])
    assert.throws(() => parseBackfillArgs(args));
});

test("backfill leaves started human-agent workflows for review", async () => {
  const f = fixture();
  f.records[0].workflow.state = "in_review";
  f.records[0].worker = "Config Agent";
  f.records[0].workerKind = "agent";
  f.records[0].reviewer = "Sam Example";
  const before = structuredClone(f.records[0]);
  const result = await backfillSampleStopConditions(f.collection, true);
  assert.equal(result[0].outcome, "review-changed-context");
  assert.deepEqual(f.records[0], before);
});
