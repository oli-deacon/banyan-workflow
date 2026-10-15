import test from "node:test";
import assert from "node:assert/strict";
import { STATUSES, blankCard, validateCard, safeLink } from "../lib/board";
test("exact column labels and order", () =>
  assert.deepEqual(STATUSES, ["Discover", "Decompose", "Specify", "Transform", "Validate", "Release & learn", "Complete"]));
test("validation rejects blank titles, overlong content and unsafe or malformed links", () => {
  const card = { ...blankCard("Discover", "x"), title: "Valid" };
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

test("legacy statuses map to the corresponding agent without claiming new approvals", async () => {
  const { normalizeStatus } = await import("../lib/workflow");
  assert.equal(normalizeStatus("To Do"), "Discover");
  assert.equal(normalizeStatus("In Progress"), "Transform");
  assert.equal(normalizeStatus("Ready for Review"), "Validate");
  assert.equal(normalizeStatus("Done"), "Complete");
});


test("agent-board statuses map to phases and every working phase has an exit gate", async () => {
  const { normalizeStatus, STAGES } = await import("../lib/workflow");
  for (const [old, phase] of [["pm-agent", "Discover"], ["architect-agent", "Decompose"], ["developer-agent", "Transform"], ["quality-agent", "Validate"], ["verifier-agent", "Validate"]]) {
    assert.equal(normalizeStatus(old), phase);
  }
  for (const phase of STATUSES.slice(0, -1)) {
    assert.ok(STAGES[phase].exit);
    assert.ok(STAGES[phase].leadAgent);
    assert.ok(STAGES[phase].criteria.length);
  }
  assert.equal(STAGES["Release & learn"].exit, "Operational acceptance and verified rollback readiness");
});
