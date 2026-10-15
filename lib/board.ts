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
  "objective",
  "context",
  "references",
  "constraints",
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
    objective: "",
    context: "",
    references: "",
    constraints: "",
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
    title: "Establish the modernization baseline",
    summary: "A shared starting point for the work ahead.",
    objective: "Create a repeatable local baseline.",
    acceptance: "Record build and test commands.\nList known gaps.",
    progress: "Sample baseline completed.",
    outputs: "Local setup notes and a fictional dependency inventory.",
  },
];
