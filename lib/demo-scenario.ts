import { blankCard } from "./board";
import {
  blankWorkflow,
  transition,
  type Evidence,
  type WorkflowCommand,
  type WorkflowEvent,
} from "./workflow";
import type { RecordCard } from "./server/model";

export function demoCard(): RecordCard {
  const at = "2026-10-14T09:00:00.000Z";
  return {
    ...blankCard("Transform", "guided-configuration-demo"),
    title: "Extract typed configuration safely",
    summary:
      "A fictional configuration refactor, from delegation to human approval.",
    owner: "Alex Example",
    worker: "Config Agent",
    workerKind: "agent",
    reviewer: "Sam Example",
    objective:
      "Replace scattered configuration reads with a typed interface while preserving production behaviour.",
    context:
      "Fictional order service. All names, results and links in this walkthrough are illustrative.",
    constraints:
      "No production access, real credentials, interface changes or deployment. Work on a proposed change only.",
    acceptance:
      "Required values fail fast at startup.\nProduction has no implicit timeout default.\nLocal development defaults are documented.",
    stopCondition:
      "Pause before choosing an unresolved default or changing required production configuration. Ask the accountable human to decide.",
    boardId: "simulation-only",
    version: 1,
    createdAt: at,
    updatedAt: at,
    workflow: blankWorkflow(),
    activity: [
      {
        version: 1,
        at,
        action: "created",
        actor: "sample-seed",
        fields: [],
        assignment: {
          owner: "Alex Example",
          worker: "Config Agent",
          workerKind: "agent",
          reviewer: "Sam Example",
        },
      },
    ],
  };
}
const criteria = demoCard()
  .acceptance.split("\n")
  .map((text) => ({ text, checked: true }));
const evidence: Evidence = {
  summary:
    "Illustrative draft: configuration reads now use a typed startup schema. Development fallback is isolated from production.",
  links: [
    "https://example.com/demo/configuration-diff",
    "https://example.com/demo/test-report",
  ],
  tests:
    "SIMULATED: npm test — 12 passing. Startup validation and production missing-value cases pass. The development timeout edge case still needs explicit reviewer inspection.",
  criteria,
};
export const demoSteps: {
  title: string;
  explanation: string;
  button: string;
  command: WorkflowCommand;
  actor?: Pick<WorkflowEvent, "name" | "role">;
}[] = [
  {
    title: "Delegate bounded work",
    explanation:
      "Alex owns the outcome. Config Agent develops the change. Flanders always performs the first code review and auto-fix loop before Sam gives final human review. Starting records intent; no code is executed.",
    button: "Simulate work starting",
    command: { type: "start" },
  },
  {
    title: "Stop at an unresolved decision",
    explanation:
      "The agent discovers that a local timeout default is unspecified. The Stop Condition sends a concrete question to Alex.",
    button: "Simulate the agent asking for input",
    command: {
      type: "request_input",
      note: "The inventory has no agreed local timeout default. Should local development use 30 seconds while production continues requiring an explicit value? No change has been made.",
    },
  },
  {
    title: "Human decision and resume",
    explanation:
      "Alex makes a bounded decision for this fictional scenario. The decision is retained in the timeline before work resumes.",
    button: "Record the example decision",
    command: {
      type: "resume",
      note: "For this fictional demo, use 30 seconds only in local development. Production must still require an explicit timeout. Document the distinction and test both paths.",
    },
  },
  {
    title: "Hand off to Flanders",
    explanation:
      "Config Agent submits a proposed diff, tests and acceptance checks to Flanders, the first-pass code review agent. Sam receives the work only after this review and auto-fix loop. These results are simulated claims.",
    button: "Send the example to Flanders",
    command: { type: "submit_review", evidence },
  },
  {
    title: "Flanders finds a gap",
    explanation:
      "Flanders spots missing coverage despite the checked acceptance criteria and opens its auto-fix loop. The finding returns the task to working within Transform before any human final review.",
    button: "Record Flanders’ finding",
    actor: { name: "Flanders", role: "agent" },
    command: {
      type: "request_changes",
      note: "Add an explicit test that an unset local timeout resolves to 30 seconds. The broad validation tests do not demonstrate that edge case.",
    },
  },
  {
    title: "Flanders fixes, rechecks and hands off",
    explanation:
      "Flanders applies the missing test and rechecks the revised diff and tests. This example resolves in one auto-fix cycle, then passes to Sam for final human review. If a fix needs a human decision or repeated attempts make no progress, pause and ask Alex. Both evidence submissions remain in history.",
    button: "Simulate Flanders’ fix and handoff",
    actor: { name: "Flanders", role: "agent" },
    command: {
      type: "submit_review",
      evidence: {
        ...evidence,
        summary:
          "Illustrative Flanders auto-fix and recheck: added a specific local timeout fallback test and clarified the local setup notes. No remaining finding in this example; handed to Sam for final human review.",
        tests:
          "SIMULATED: npm test — 13 passing. Added: unset local timeout resolves to 30 seconds. Production missing-value test still fails fast as intended.",
        links: [
          "https://example.com/demo/revised-configuration-diff",
          "https://example.com/demo/revised-test-report",
        ],
      },
    },
  },
  {
    title: "Human approval",
    explanation:
      "Sam performs the final human review after Flanders’ first pass and auto-fix loop, and records why the revised evidence is sufficient. Approval accepts this phase’s work; the board’s human-approved handoff advances the phase; it does not merge code or deploy anything.",
    button: "Record the example approval",
    command: {
      type: "approve",
      note: "Reviewed the illustrative revised diff and test report. Local fallback is explicitly covered and production remains explicit. All acceptance criteria are met in this simulated scenario.",
    },
  },
];
export function advanceDemo(
  card: RecordCard,
  command: WorkflowCommand,
): RecordCard {
  const { workflow, status, event } = transition(card, command);
  const at = new Date(
    new Date(card.updatedAt).getTime() + 60_000,
  ).toISOString();
  return {
    ...card,
    workflow,
    status,
    version: card.version + 1,
    updatedAt: at,
    activity: [
      ...card.activity,
      {
        version: card.version + 1,
        at,
        action: "edited",
        actor: "sample-seed",
        fields: ["workflow"],
        from: card.status,
        to: status,
        workflow: event,
      },
    ],
  };
}

// Demo-only attribution: shared-card reviewers remain human and API rules are unchanged.
export function advanceDemoStep(
  card: RecordCard,
  step: (typeof demoSteps)[number],
): RecordCard {
  const next = advanceDemo(card, step.command);
  const event = next.activity.at(-1)?.workflow;
  if (event && step.actor) Object.assign(event, step.actor);
  return next;
}

export function demoHandoff(card: RecordCard): string | undefined {
  if (
    card.workflow.state === "in_review" &&
    card.activity.filter((event) => event.workflow?.type === "submit_review")
      .length === 1
  )
    return "Next: Flanders performs the first-pass code review";
  if (card.workflow.state === "working" && card.workflow.feedback)
    return "Next: Flanders auto-fixes the finding and rechecks before handoff to Sam";
}
