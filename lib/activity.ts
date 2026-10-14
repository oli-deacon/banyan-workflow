import { commandLabel } from "./workflow";
import type { Activity } from "./server/model";

const fieldNames: Record<string, string> = {
  title: "title",
  summary: "summary",
  owner: "owner",
  worker: "assigned worker",
  workerKind: "worker type",
  reviewer: "reviewer",
  objective: "objective",
  context: "input context",
  references: "reference links",
  constraints: "constraints",
  stopCondition: "stop condition",
  acceptance: "acceptance criteria",
  progress: "progress & blockers",
  outputs: "outputs",
  sample: "sample label",
};
export function activityText(event: Activity): string {
  if (event.workflow) return commandLabel[event.workflow.type];
  if (event.action === "seeded") return "Added this sample card";
  if (event.action === "created") return "Created this card";
  const changed = event.fields
    .filter((field) => field !== "status")
    .map((field) => fieldNames[field] ?? field);
  const moved =
    event.from && event.to ? `Moved from ${event.from} to ${event.to}` : "";
  const edited = changed.length
    ? `Updated ${new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(changed)}`
    : "";
  return [moved, edited].filter(Boolean).join(". ") || "Saved this card";
}
export function actorText(actor: Activity["actor"]): string {
  return actor === "public-demo-visitor"
    ? "Demo visitor"
    : actor === "sample-seed"
      ? "Banyan sample"
      : "Local developer";
}
export function relativeTime(at: string | number, now = Date.now()): string {
  const elapsed = Math.max(0, now - new Date(at).getTime());
  if (elapsed < 60000) return "Just now";
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 60)
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
