import test from "node:test";
import assert from "node:assert/strict";
import {
  STATUSES,
  blankCard,
  decodeBoard,
  encodeBoard,
  moveCard,
  samples,
  upsertCard,
  validateCard,
  safeLink,
} from "../lib/board";
test("exact column labels and order", () =>
  assert.deepEqual(STATUSES, [
    "To Do",
    "In Progress",
    "Ready for Review",
    "Done",
  ]));
test("moving updates only status and never mutates the source", () => {
  for (const status of STATUSES) {
    const moved = moveCard(samples, samples[0].id, status);
    assert.equal(moved[0].status, status);
    assert.deepEqual({ ...moved[0], status: samples[0].status }, samples[0]);
    assert.equal(moved.length, samples.length);
  }
  assert.equal(samples[0].status, "To Do");
  assert.deepEqual(moveCard(samples, "missing", "Done"), samples);
});
test("create and repeated edits preserve stable IDs without duplicates", () => {
  const card = { ...blankCard("To Do", "test-id"), title: "  A new task  " };
  const created = upsertCard([], card);
  assert.equal(created[0].title, "A new task");
  const updated = upsertCard(created, {
    ...card,
    title: "Edited",
    status: "Done",
  });
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, "test-id");
  assert.equal(updated[0].status, "Done");
  assert.deepEqual(upsertCard(updated, updated[0]), updated);
});
test("valid board round trips and intentionally empty boards stay empty", () => {
  assert.deepEqual(decodeBoard(encodeBoard(samples)), {
    cards: samples,
    warning: null,
  });
  assert.deepEqual(decodeBoard(encodeBoard([])), { cards: [], warning: null });
  assert.equal(decodeBoard(null).warning, null);
});
test("malformed storage safely recovers without accepting partial invalid state", () => {
  const bad = [
    "{",
    "null",
    "{}",
    '{"version":2,"cards":[]}',
    JSON.stringify({ version: 1, cards: [samples[0], samples[0]] }),
    JSON.stringify({
      version: 1,
      cards: [{ ...samples[0], status: "Unknown" }],
    }),
    JSON.stringify({ version: 1, cards: [{ ...samples[0], title: 12 }] }),
    JSON.stringify({
      version: 1,
      cards: [{ ...samples[0], references: "javascript:alert(1)" }],
    }),
  ];
  for (const raw of bad) {
    const result = decodeBoard(raw);
    assert.ok(result.warning);
    assert.deepEqual(result.cards, samples);
  }
});
test("validation rejects blank titles, overlong content and unsafe or malformed links", () => {
  const card = { ...blankCard("To Do", "x"), title: "Valid" };
  assert.equal(validateCard(card), null);
  for (const change of [
    { title: "  " },
    { title: "x".repeat(161) },
    { summary: "x".repeat(401) },
    { context: "x".repeat(20001) },
    { references: "javascript:alert(1)" },
    { references: "example.com" },
  ])
    assert.ok(validateCard({ ...card, ...change }));
  assert.equal(
    validateCard({
      ...card,
      references: " https://example.com/path\nhttp://example.org ",
    }),
    null,
  );
  assert.equal(safeLink("data:text/html,test"), false);
  assert.deepEqual(upsertCard([], { ...card, title: "" }), []);
});
