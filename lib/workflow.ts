import { safeLink, type Card, type Status } from "./board";

export const WORK_STATES = [
  "idle",
  "working",
  "awaiting_input",
  "in_review",
  "approved",
] as const;
export type WorkState = (typeof WORK_STATES)[number];
export const workStateLabel: Record<WorkState, string> = {
  idle: "Not started",
  working: "Working",
  awaiting_input: "Awaiting human input",
  in_review: "Awaiting review",
  approved: "Approved",
};
export type Evidence = {
  summary: string;
  links: string[];
  tests: string;
  criteria: { text: string; checked: boolean }[];
};
export type Workflow = {
  state: WorkState;
  attempt: number;
  question: string;
  decision: string;
  feedback: string;
  evidence: Evidence | null;
};
export function blankWorkflow(): Workflow {
  return {
    state: "idle",
    attempt: 0,
    question: "",
    decision: "",
    feedback: "",
    evidence: null,
  };
}
export function withWorkflow<T extends { workflow?: Workflow }>(
  card: T,
): T & { workflow: Workflow } {
  return { ...card, workflow: card.workflow ?? blankWorkflow() };
}
export const COMMANDS = [
  "start",
  "request_input",
  "resume",
  "submit_review",
  "request_changes",
  "approve",
] as const;
export type WorkflowCommand =
  | { type: "start" }
  | { type: "request_input"; note: string }
  | { type: "resume"; note: string }
  | { type: "submit_review"; evidence: Evidence }
  | { type: "request_changes"; note: string }
  | { type: "approve"; note: string };
export type WorkflowEvent = {
  type: WorkflowCommand["type"] | "brief_changed";
  name: string;
  role: "human" | "agent";
  attempt: number;
  note: string;
  evidence?: Evidence;
};
export const commandLabel: Record<WorkflowEvent["type"], string> = {
  start: "Started work",
  request_input: "Requested human input",
  resume: "Recorded decision and resumed",
  submit_review: "Submitted evidence for review",
  request_changes: "Requested changes",
  approve: "Approved work",
  brief_changed: "Reopened work after card changes",
};
export class WorkflowError extends Error {}
function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new WorkflowError(message);
}
function record(value: unknown): Record<string, unknown> {
  requireValue(
    value && typeof value === "object" && !Array.isArray(value),
    "Invalid workflow action.",
  );
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  requireValue(
    Object.keys(value).every((key) => allowed.includes(key)),
    "Unknown workflow action field.",
  );
}
function text(value: unknown, label: string, max = 2000) {
  requireValue(
    typeof value === "string" && value.trim() && value.length <= max,
    `${label} is required (up to ${max} characters).`,
  );
  return value.trim();
}
export function acceptanceItems(card: Pick<Card, "acceptance">) {
  return card.acceptance
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
// Strict parsing is shared with the isolated simulation. State/history never come from a client payload.
export function parseCommand(value: unknown): WorkflowCommand {
  const input = record(value);
  requireValue(
    new TextEncoder().encode(JSON.stringify(input)).length <= 12000,
    "Keep the workflow entry under 12 KB; link to larger evidence.",
  );
  requireValue(
    COMMANDS.includes(input.type as WorkflowCommand["type"]),
    "Choose a valid workflow action.",
  );
  if (input.type === "start") {
    keys(input, ["type"]);
    return { type: "start" };
  }
  if (input.type === "submit_review") {
    keys(input, ["type", "evidence"]);
    const data = record(input.evidence);
    keys(data, ["summary", "links", "tests", "criteria"]);
    requireValue(
      Array.isArray(data.links) &&
        data.links.length > 0 &&
        data.links.length <= 10,
      "Add 1–10 output links.",
    );
    const links = data.links.map((link) => text(link, "Output link", 2000));
    requireValue(
      links.every(safeLink),
      "Use full http:// or https:// output links.",
    );
    requireValue(
      Array.isArray(data.criteria) &&
        data.criteria.length > 0 &&
        data.criteria.length <= 50,
      "Use 1–50 acceptance criteria, one per line.",
    );
    const criteria = data.criteria.map((item) => {
      const criterion = record(item);
      keys(criterion, ["text", "checked"]);
      requireValue(
        typeof criterion.checked === "boolean",
        "Each criterion needs a check result.",
      );
      return {
        text: text(criterion.text, "Acceptance criterion", 2000),
        checked: criterion.checked,
      };
    });
    return {
      type: "submit_review",
      evidence: {
        summary: text(data.summary, "Change summary"),
        tests: text(data.tests, "Test evidence"),
        links,
        criteria,
      },
    };
  }
  keys(input, ["type", "note"]);
  return {
    type: input.type,
    note: text(input.note, "A question, decision or review note"),
  } as WorkflowCommand;
}
export function transition(
  card: Card & { workflow?: Workflow },
  raw: WorkflowCommand,
) {
  const command = parseCommand(raw);
  const current = card.workflow ?? blankWorkflow();
  const workflow = structuredClone(current);
  let status: Status = card.status;
  const human = ["resume", "request_changes", "approve"].includes(command.type);
  const reviewer = ["request_changes", "approve"].includes(command.type);
  requireValue(
    card.owner.trim() && card.worker.trim() && card.reviewer.trim(),
    "Set an accountable owner, assigned worker and reviewer in Edit card first.",
  );
  const event: WorkflowEvent = {
    type: command.type,
    name: reviewer ? card.reviewer : human ? card.owner : card.worker,
    role: human ? "human" : (card.workerKind as "human" | "agent"),
    attempt: current.attempt,
    note: "note" in command ? command.note : "",
  };
  switch (command.type) {
    case "start":
      requireValue(
        current.state === "idle" && card.status !== "Done",
        "Only unfinished, unstarted work can be started.",
      );
      requireValue(
        card.objective.trim() &&
          card.acceptance.trim() &&
          card.stopCondition.trim(),
        "Add an objective, acceptance criteria and Stop Condition before starting.",
      );
      requireValue(
        acceptanceItems(card).length <= 50 &&
          acceptanceItems(card).every((item) => item.length <= 2000),
        "Use up to 50 acceptance criteria of 2,000 characters, one per line.",
      );
      workflow.state = "working";
      workflow.attempt++;
      status = "In Progress";
      break;
    case "request_input":
      requireValue(
        current.state === "working",
        "Human input can only be requested while working.",
      );
      workflow.state = "awaiting_input";
      workflow.question = command.note;
      workflow.decision = "";
      break;
    case "resume":
      requireValue(
        current.state === "awaiting_input",
        "There is no pending question to resolve.",
      );
      workflow.state = "working";
      workflow.decision = command.note;
      workflow.attempt++;
      break;
    case "submit_review": {
      requireValue(
        current.state === "working",
        "Resume work before submitting for review.",
      );
      const expected = acceptanceItems(card);
      requireValue(
        command.evidence.criteria.length === expected.length &&
          command.evidence.criteria.every(
            (item, i) => item.text === expected[i],
          ),
        "Acceptance criteria changed. Reload the card and check the current criteria.",
      );
      requireValue(
        command.evidence.criteria.every((item) => item.checked),
        "Check every acceptance criterion before submitting for review.",
      );
      workflow.state = "in_review";
      workflow.evidence = command.evidence;
      workflow.feedback = "";
      status = "Ready for Review";
      event.evidence = structuredClone(command.evidence);
      break;
    }
    case "request_changes":
      requireValue(
        current.state === "in_review",
        "Changes can only be requested on submitted work.",
      );
      workflow.state = "working";
      workflow.feedback = command.note;
      workflow.attempt++;
      status = "In Progress";
      break;
    case "approve":
      requireValue(
        current.state === "in_review" && current.evidence,
        "Submit evidence for review before approving.",
      );
      workflow.state = "approved";
      workflow.feedback = command.note;
      status = "Done";
      break;
  }
  event.attempt = workflow.attempt;
  return { workflow, status, event };
}
