import test from "node:test";
import assert from "node:assert/strict";
import { STATUSES } from "../lib/board";
import { STAGES } from "../lib/workflow";
import { advanceDemoStep } from "../lib/demo-scenario";
import { PHASE_DEMO, phaseDemoCard, preparePhaseEvidence, approvePhaseHandoff, phaseTransformSteps } from "../lib/phase-demo";

test("six phase walkthrough uses board ownership, gates and evidence with explicit human approval", () => {
  let card = phaseDemoCard();
  const untouched = phaseDemoCard();
  for (const phase of STATUSES.slice(0, -1)) {
    assert.equal(card.status, phase);
    assert.equal(card.worker, STAGES[phase].leadAgent);
    assert.deepEqual(PHASE_DEMO[phase as keyof typeof PHASE_DEMO].contributions.map(item => item.agent), [STAGES[phase].leadAgent, ...STAGES[phase].support]);
    assert.throws(() => approvePhaseHandoff(card, true));
    if (phase === "Transform") for (const step of phaseTransformSteps) {
      card = advanceDemoStep(card, step);
      assert.equal(card.status, phase);
    }
    card = preparePhaseEvidence(card);
    assert.throws(() => approvePhaseHandoff(card, false));
    const before = structuredClone(card.activity);
    card = approvePhaseHandoff(card, true);
    assert.deepEqual(card.activity.slice(0, -1), before);
    assert.equal(card.activity.at(-1)?.workflow?.role, "human");
    assert.match(card.activity.at(-1)?.workflow?.evidence?.summary ?? "", /SIMULATED/);
    assert.equal(card.workflow.state, "idle");
  }
  assert.equal(card.status, "Complete");
  assert.equal(card.activity.filter(item => item.action === "moved").length, 6);
  assert.throws(() => approvePhaseHandoff(card, true));
  assert.deepEqual(untouched, phaseDemoCard());
});
