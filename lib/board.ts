export const STATUSES = [
  "Discover",
  "Decompose",
  "Specify",
  "Transform",
  "Validate",
  "Release & learn",
  "Complete",
] as const;
export type Status = (typeof STATUSES)[number];
export const FIELDS = [
  "title",
  "summary",
  "owner",
  "worker",
  "workerKind",
  "reviewer",
  "objective",
  "context",
  "references",
  "constraints",
  "stopCondition",
  "acceptance",
  "progress",
  "outputs",
] as const;
export type Card = { id: string; status: Status; sample: boolean } & Record<
  (typeof FIELDS)[number],
  string
>;
export function isStatus(value: unknown): value is Status {
  return STATUSES.includes(value as Status);
}
export function blankCard(status: Status = "Discover", id = ""): Card {
  return {
    id,
    status,
    sample: false,
    title: "",
    summary: "",
    owner: "",
    worker: "",
    workerKind: "human",
    reviewer: "",
    objective: "",
    context: "",
    references: "",
    constraints: "",
    stopCondition: "",
    acceptance: "",
    progress: "",
    outputs: "",
  };
}
export function safeLink(value: string): boolean {
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
export function validateCard(card: Card): string | null {
  if (!card.title.trim()) return "Give this card a title.";
  if (card.title.length > 160)
    return "Keep the title to 160 characters or fewer.";
  if (!["human", "agent"].includes(card.workerKind))
    return "Choose a human or agent worker.";
  if (card.worker.length > 100 || card.reviewer.length > 100)
    return "Keep worker and reviewer names to 100 characters or fewer.";
  if (card.owner.length > 100)
    return "Keep the owner to 100 characters or fewer.";
  if (card.summary.length > 400)
    return "Keep the summary to 400 characters or fewer.";
  if (FIELDS.some((key) => card[key].length > 20000))
    return "Keep each detail field to 20,000 characters or fewer.";
  if (!isStatus(card.status)) return "Choose a valid status.";
  if (
    card.references
      .split("\n")
      .some((link) => link.trim() && !safeLink(link.trim()))
  )
    return "Use a full http:// or https:// reference URL, one per line.";
  return null;
}
export const samples: Card[] = [
  {
    ...blankCard("Discover", "sample-service-map"),
    sample: true,
    stopCondition:
      "Pause and ask for human input if dependencies are ambiguous or no independently testable boundary is supported by the evidence. Stop before accessing production or customer data, or moving code; confirm the proposed migration scope with a human.",
    title: "Map the legacy service boundaries",
    summary: "Find the seams before we start moving code.",
    objective: "Agree a small, safe first migration boundary.",
    context:
      "Sample project: a fictional order-management application with tightly coupled services.",
    constraints: "Discovery only. No production access or customer data.",
    acceptance:
      "Document current dependencies.\nIdentify one independently testable boundary.\nReview the proposed scope.",
    outputs: "Expected: a service map and a short decision record.",
  },
  {
    ...blankCard("Discover", "sample-contract-tests"),
    sample: true,
    stopCondition:
      "Pause and ask for human input if expected success, validation or failure responses are unclear, consumers disagree, or a test would require changing an existing response shape. Stop if synthetic fixtures cannot establish the expected behaviour.",
    title: "Define API contract tests",
    summary: "Capture the behaviour consumers rely on.",
    objective: "Protect the public API during modernization.",
    acceptance:
      "Cover success, validation and failure responses.\nUse synthetic fixtures only.",
    constraints: "Keep existing response shapes stable.",
  },
  {
    ...blankCard("Transform", "sample-config"),
    sample: true,
    stopCondition:
      "Pause and ask for human input before choosing unresolved development defaults. Stop if the typed interface would change required configuration or expose secrets; request a decision using placeholder values only.",
    title: "Separate configuration from application code",
    summary: "Make each environment explicit and predictable.",
    objective: "Replace scattered configuration with a single typed interface.",
    context: "Use fictional environment names and placeholder values.",
    progress:
      "Configuration inventory drafted.\nBlocker: agree which defaults belong in development.",
    acceptance:
      "Validate required values at startup.\nDocument safe local defaults.",
    outputs: "Draft configuration schema.",
  },
  {
    ...blankCard("Validate", "sample-decision"),
    sample: true,
    stopCondition:
      "Pause for human review of the draft before treating the migration decision as agreed. Ask for clarification if risks, rollout or rollback lack supporting evidence, or open questions prevent an informed decision.",
    title: "Review the migration decision record",
    summary: "Check the tradeoffs and rollback approach.",
    objective: "Get agreement on an incremental migration.",
    progress: "Draft ready for a human review.",
    acceptance:
      "Risks, rollout and rollback documented.\nOpen questions recorded.",
    outputs: "Sample ADR outline: context, options, decision, consequences.",
  },
  {
    ...blankCard("Complete", "sample-baseline"),
    sample: true,
    stopCondition:
      "If the baseline is rerun, pause and ask for human input when build or test evidence is missing, or the same failure persists after two documented attempts without new evidence. Record the gap before claiming the local baseline is repeatable.",
    title: "Establish the modernization baseline",
    summary: "A shared starting point for the work ahead.",
    objective: "Create a repeatable local baseline.",
    acceptance: "Record build and test commands.\nList known gaps.",
    progress: "Sample baseline completed.",
    outputs: "Local setup notes and a fictional dependency inventory.",
  },
];

// Legacy documents and responses predate these optional fields.
export function withCardDefaults<
  T extends {
    stopCondition?: string;
    owner?: string;
    worker?: string;
    workerKind?: string;
    reviewer?: string;
  },
>(
  card: T,
): T & {
  stopCondition: string;
  owner: string;
  worker: string;
  workerKind: string;
  reviewer: string;
} {
  return {
    ...card,
    stopCondition: card.stopCondition ?? "",
    owner: card.owner ?? "",
    worker: card.worker ?? "",
    workerKind: card.workerKind ?? "human",
    reviewer: card.reviewer ?? "",
  };
}
