import test from "node:test";
import assert from "node:assert/strict";
import { STATUSES, blankCard, validateCard, safeLink } from "../lib/board";
test("exact column labels and order", () =>
  assert.deepEqual(STATUSES, [
    "To Do",
    "In Progress",
    "Ready for Review",
    "Done",
  ]));
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
});
