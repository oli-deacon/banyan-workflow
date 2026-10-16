import { type Status } from "./board";
import { demoCard, demoSteps } from "./demo-scenario";
import { blankWorkflow, nextStage, STAGES, transitionError } from "./workflow";
import type { RecordCard } from "./server/model";

export type DemoPhase = Exclude<Status, "Complete">;
export const PHASE_DEMO: Record<DemoPhase, {
  input: string;
  contributions: { agent: string; work: string }[];
  evidence: string;
  decision: string;
}> = {
  Discover: {
    input: "A fictional order service with configuration reads scattered across startup and request handlers.",
    contributions: [{ agent: "architect-agent", work: "Trace configuration reads, dependencies and data flows. Separate observed startup behavior from inferred rules, and record the unknown local timeout default." }],
    evidence: "SIMULATED baseline v1: configuration inventory, dependency map and startup traces. Production requires an explicit timeout. The local default remains an open question owned by Alex; it does not prevent defining the unit boundary.",
    decision: "Alex reviews the baseline evidence and confirms the unknown has an owner before approving decomposition.",
  },
  Decompose: {
    input: "Baseline v1, dependency map and the recorded timeout question from Discover.",
    contributions: [
      { agent: "architect-agent", work: "Bound the unit to configuration loading and its callers. Preserve request behavior and interface ownership." },
      { agent: "pm-agent", work: "Sequence the schema, adapter and caller migration; confirm capacity and dependencies. Keep unrelated service changes out of scope." },
    ],
    evidence: "SIMULATED unit plan v1: one configuration module, unchanged service interfaces, schema → adapter → callers. Dependencies and exclusions are recorded for human boundary and sequencing review.",
    decision: "Alex approves the unit boundary and dependency order before specification begins.",
  },
  Specify: {
    input: "The approved configuration unit and sequence, plus baseline behavior and unresolved questions.",
    contributions: [
      { agent: "pm-agent", work: "Draft target behavior and acceptance criteria. Obtain Alex’s decision: 30 seconds locally; production still requires an explicit value." },
      { agent: "architect-agent", work: "Define the typed schema, validation boundary and compatibility contract." },
      { agent: "quality-agent", work: "Design startup, local-default and production-missing-value tests before implementation." },
    ],
    evidence: "SIMULATED specification v1: typed startup validation; local timeout defaults to 30 seconds; no implicit production default. Acceptance tests cover missing required values, environment separation and documentation. Alex’s bounded decision is recorded.",
    decision: "Alex approves the behavior, scope and acceptance tests. A missing decision would keep the card in Specify.",
  },
  Transform: {
    input: "Approved specification v1, unit boundaries and acceptance tests from Specify.",
    contributions: [{ agent: "developer-agent", work: "Implement only the configuration unit, generate tests and a draft diff. Flanders performs the illustrative first-pass review and fix loop; Sam reviews the resulting evidence." }],
    evidence: "SIMULATED candidate v2: typed configuration schema and migrated callers. Revised diff and 13 passing tests include the explicit 30-second local fallback and production fail-fast case. Flanders’ finding and fix remain in the timeline.",
    decision: "Sam reviews the candidate evidence and confirms the defined checks pass before handing the unit to independent validation.",
  },
  Validate: {
    input: "Candidate v2, baseline v1, the approved specification and developer test evidence.",
    contributions: [
      { agent: "quality-agent", work: "Independently compare legacy and candidate behavior, startup performance and data outcomes against the approved acceptance criteria." },
      { agent: "verifier-agent", work: "Independently review code, standards and security evidence. Check that secrets are not logged and production validation cannot be bypassed." },
    ],
    evidence: "SIMULATED independent report v1: legacy/candidate behavior agrees except for the approved local default; startup stays within the agreed budget; no data changes; static and security checks meet the specification. Independent reviewers support acceptance of candidate v2.",
    decision: "Sam inspects independent evidence. A failed check returns the work to Transform; an acceptance gap returns it to Specify. This example passes.",
  },
  "Release & learn": {
    input: "Independently accepted candidate v2, validation report and a proposed rollout/rollback plan.",
    contributions: [
      { agent: "pm-agent", work: "Coordinate operational acceptance, monitored outcomes and learning. Record a follow-up specification item for clearer configuration diagnostics." },
      { agent: "developer-agent", work: "Prepare rollout instructions, monitoring checks and rollback steps for an authorized operator. In this demo, rehearse only fictional outcomes." },
      { agent: "verifier-agent", work: "Review operational evidence and verify rollback readiness against the accepted candidate and baseline." },
    ],
    evidence: "SIMULATED operational record v1: rehearsal health checks pass; expected configuration failures are visible; rollback to the baseline is verified. Alex accepts operations. Learning about clearer diagnostics is recorded for a future Specify item. No deployment or rollback is executed by this walkthrough.",
    decision: "Alex confirms operational acceptance and verified rollback readiness, then approves Complete. Passing code review alone cannot complete the lifecycle.",
  },
};

export function phaseDemoCard(): RecordCard {
  const card = demoCard();
  return { ...card, status: "Discover", worker: "architect-agent", reviewer: "Alex Example",
    summary: "A fictional modernization unit through all six phases.",
    activity: [{ ...card.activity[0], assignment: { owner: card.owner, worker: "architect-agent", workerKind: "agent", reviewer: "Alex Example" } }],
  };
}
export function preparePhaseEvidence(card: RecordCard): RecordCard {
  if (card.status === "Complete") throw new Error("The walkthrough is complete.");
  const phase = PHASE_DEMO[card.status];
  return { ...card, outputs: phase.evidence, references: `https://example.com/demo/${card.status.toLowerCase().replaceAll(/[^a-z]+/g, "-")}-evidence`, progress: phase.decision };
}
export function approvePhaseHandoff(card: RecordCard, approved: boolean): RecordCard {
  const target = nextStage(card.status);
  if (!approved || !target) throw new Error("Human approval is required for the next phase.");
  const error = transitionError(card, target);
  if (error) throw new Error(error);
  const at = new Date(new Date(card.updatedAt).getTime() + 60_000).toISOString();
  return { ...card, status: target, version: card.version + 1, updatedAt: at,
    worker: STAGES[target].leadAgent, reviewer: ["Transform", "Validate"].includes(target) ? "Sam Example" : "Alex Example",
    workflow: blankWorkflow(), outputs: "", references: "", progress: "",
    activity: [...card.activity, { version: card.version + 1, at, action: "moved", actor: "sample-seed", fields: ["status"], from: card.status, to: target,
      workflow: { type: "approve", role: "human", name: card.reviewer, attempt: card.workflow.attempt,
        note: `${card.status} → ${target}. ${STAGES[card.status].exit}. ${card.progress}`,
        evidence: { summary: card.outputs, links: card.references.split("\n"), tests: "Illustrative phase evidence only; no checks executed.", criteria: STAGES[card.status].criteria.map(text => ({ text, checked: true })) } } }],
  };
}

// Replay a specification clarification without discarding the earlier human decision.
export const phaseTransformSteps = demoSteps.map((step, index) => {
  if (index === 1) return { ...step,
    explanation: "The developer finds an older setup note that conflicts with the approved 30-second local default. The Stop Condition pauses work for Alex to resolve the contradiction.",
    command: { type: "request_input" as const, note: "An older setup note conflicts with specification v1. Confirm that the approved 30-second local default supersedes it, while production remains explicit." },
  };
  if (index === 2) return { ...step,
    explanation: "Alex confirms specification v1 is authoritative. The developer can correct the outdated note within the approved scope.",
    command: { type: "resume" as const, note: "Specification v1 remains approved: use 30 seconds locally, require an explicit production timeout, and correct the stale note. No scope change is authorized." },
  };
  return step;
});
