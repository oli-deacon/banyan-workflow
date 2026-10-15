import { STATUSES, type Card, type Status } from "./board";

type Stage = {
  phase: string;
  domain: string;
  leadAgent: string;
  support: string[];
  leads: string;
  exit: string;
  criteria: string[];
  required: (keyof Card)[];
};

export const STAGES: Record<Status, Stage> = {
  Discover: {
    phase: "01 · Discover",
    domain: "Baseline & unknowns",
    leadAgent: "architect-agent",
    support: [],
    leads: "Map code, dependencies, data flows, and likely business rules; identify unknowns.",
    exit: "Evidence-backed baseline, with unresolved questions recorded",
    criteria: ["The baseline is backed by evidence.", "Unresolved questions are recorded."],
    required: ["context", "references", "outputs", "progress"],
  },
  Decompose: {
    phase: "02 · Decompose",
    domain: "Boundaries & sequencing",
    leadAgent: "architect-agent",
    support: ["pm-agent"],
    leads: "Propose modernization units and their dependency order.",
    exit: "Humans approve boundaries and sequencing",
    criteria: ["Humans have approved the modernization unit boundaries.", "Humans have approved the dependency order and sequencing."],
    required: ["objective", "constraints", "outputs"],
  },
  Specify: {
    phase: "03 · Specify",
    domain: "Behavior & acceptance",
    leadAgent: "pm-agent",
    support: ["architect-agent", "quality-agent"],
    leads: "Draft target behavior, transformation scope, acceptance criteria, and tests.",
    exit: "Approved modernization specification",
    criteria: ["The modernization specification covers target behavior, transformation scope, acceptance criteria, and tests.", "The modernization specification is approved."],
    required: ["objective", "context", "constraints", "acceptance", "outputs"],
  },
  Transform: {
    phase: "04 · Transform",
    domain: "Bounded implementation",
    leadAgent: "developer-agent",
    support: [],
    leads: "Make bounded code/schema changes; build and test iteratively.",
    exit: "Candidate change passes defined checks",
    criteria: ["The candidate change stays within the approved code/schema boundaries.", "The candidate change passes the defined checks, with results recorded."],
    required: ["acceptance", "outputs", "references", "progress"],
  },
  Validate: {
    phase: "05 · Validate",
    domain: "Independent validation",
    leadAgent: "quality-agent",
    support: ["verifier-agent"],
    leads: "Compare legacy and modernized behavior, performance, security, and data outcomes.",
    exit: "Independent evidence supports acceptance",
    criteria: ["Independent evidence compares legacy and modernized behavior, performance, security, and data outcomes.", "The independent evidence supports acceptance."],
    required: ["acceptance", "outputs", "references", "progress"],
  },
  "Release & learn": {
    phase: "06 · Release & learn",
    domain: "Rollout & operational learning",
    leadAgent: "pm-agent",
    support: ["developer-agent", "verifier-agent"],
    leads: "Assist rollout, monitor outcomes, and feed failures back into the specification.",
    exit: "Operational acceptance and verified rollback readiness",
    criteria: ["Operational acceptance is confirmed, with monitored outcomes and any failures fed back into the specification.", "Rollback readiness is verified and the evidence is recorded."],
    required: ["outputs", "references", "progress"],
  },
  Complete: {
    phase: "Accepted",
    domain: "Operationally accepted work",
    leadAgent: "",
    support: [],
    leads: "Retain accepted outputs and learning. Return work to the relevant phase when further changes are needed.",
    exit: "",
    criteria: [],
    required: [],
  },
};

// Interpret both earlier board versions without rewriting historical activity.
export function normalizeStatus(status: Status | string): Status {
  const legacy: Record<string, Status> = {
    "To Do": "Discover",
    "In Progress": "Transform",
    "Ready for Review": "Validate",
    Done: "Complete",
    "pm-agent": "Discover",
    "architect-agent": "Decompose",
    "developer-agent": "Transform",
    "quality-agent": "Validate",
    "verifier-agent": "Validate",
  };
  return legacy[status] ?? status as Status;
}
export function normalizeCard<T extends { status: Status }>(card: T): T {
  return { ...card, status: normalizeStatus(card.status) };
}
export function nextStage(status: Status): Status | undefined {
  return STATUSES[STATUSES.indexOf(status) + 1];
}
export function transitionError(card: Card, target: Status): string | null {
  const from = STATUSES.indexOf(card.status);
  const to = STATUSES.indexOf(target);
  if (to <= from) return null;
  if (to !== from + 1)
    return "Complete the current handoff before advancing to a later phase.";
  const missing = STAGES[card.status].required.filter(key => !String(card[key]).trim());
  return missing.length
    ? `Add ${missing.join(", ")} to the card before approving this handoff.`
    : null;
}
