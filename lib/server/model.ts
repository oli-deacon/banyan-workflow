import {
  blankWorkflow,
  withWorkflow,
  transition,
  WorkflowError,
  type Workflow,
  type WorkflowCommand,
  type WorkflowEvent,
} from "../workflow";
import {
  Card,
  FIELDS,
  isStatus,
  validateCard,
  withCardDefaults,
} from "../board";
import { publicDemo } from "./access";
export const BOARD_ID = "modernization";
export const DATABASE = "banyan_workflow";
export type Activity = {
  version: number;
  at: string;
  action: "created" | "edited" | "moved" | "seeded";
  actor: "local-developer" | "sample-seed" | "public-demo-visitor";
  fields: string[];
  workflow?: WorkflowEvent;
  assignment?: {
    owner: string;
    worker: string;
    workerKind: string;
    reviewer: string;
  };
  from?: string;
  to?: string;
};
export type RecordCard = Card & {
  workflow: Workflow;
  boardId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  activity: Activity[];
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "INVALID_REQUEST",
  ) {
    super(message);
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "Expected a JSON object.");
  return value as Record<string, unknown>;
}
export function exact(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new ApiError(400, "Unknown request field.");
}
export function parseCard(value: unknown): Card {
  const item = { ...object(value) };
  if (!("stopCondition" in item)) item.stopCondition = "";
  if (!("owner" in item)) item.owner = "";
  if (!("worker" in item)) item.worker = "";
  if (!("workerKind" in item)) item.workerKind = "human";
  if (!("reviewer" in item)) item.reviewer = "";
  exact(item, ["id", "status", "sample", ...FIELDS]);
  if (
    typeof item.id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) ||
    !isStatus(item.status) ||
    typeof item.sample !== "boolean" ||
    FIELDS.some((key) => typeof item[key] !== "string")
  )
    throw new ApiError(400, "Invalid card fields.");
  const card = item as Card;
  const error = validateCard(card);
  if (error) throw new ApiError(400, error);
  return {
    ...card,
    title: card.title.trim(),
    summary: card.summary.trim(),
    owner: card.owner.trim().replace(/\s+/g, " "),
    worker: card.worker.trim().replace(/\s+/g, " "),
    reviewer: card.reviewer.trim().replace(/\s+/g, " "),
  };
}
export function version(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new ApiError(400, "A valid expectedVersion is required.");
  return value as number;
}
export function newRecord(
  card: Card,
  boardId: string,
  seeded = false,
): RecordCard {
  const at = new Date().toISOString();
  return {
    ...withCardDefaults(card),
    workflow: blankWorkflow(),
    boardId,
    version: 1,
    createdAt: at,
    updatedAt: at,
    activity: [
      {
        version: 1,
        at,
        action: seeded ? "seeded" : "created",
        actor: seeded
          ? "sample-seed"
          : publicDemo()
            ? "public-demo-visitor"
            : "local-developer",
        fields: [],
        ...(card.owner || card.worker || card.reviewer
          ? {
              assignment: {
                owner: card.owner ?? "",
                worker: card.worker ?? "",
                workerKind: card.workerKind ?? "human",
                reviewer: card.reviewer ?? "",
              },
            }
          : {}),
      },
    ],
  };
}
export type CardPatch =
  Card | { status: Card["status"] } | { command: WorkflowCommand };
export function revision(current: RecordCard, patch: CardPatch): RecordCard {
  current = withWorkflow(withCardDefaults(current));
  if ("command" in patch) {
    try {
      const { workflow, status, event } = transition(current, patch.command);
      const at = new Date().toISOString();
      return {
        ...current,
        workflow,
        status,
        version: current.version + 1,
        updatedAt: at,
        activity: [
          ...current.activity,
          {
            version: current.version + 1,
            at,
            action: "edited" as const,
            actor: publicDemo()
              ? ("public-demo-visitor" as const)
              : ("local-developer" as const),
            fields: ["workflow"],
            from: current.status,
            to: status,
            workflow: event,
          },
        ].slice(-500),
      };
    } catch (error) {
      if (error instanceof WorkflowError)
        throw new ApiError(400, error.message, "WORKFLOW_INVALID");
      throw error;
    }
  }
  const at = new Date().toISOString();
  const fields = Object.keys(patch).filter(
    (key) =>
      patch[key as keyof typeof patch] !== current[key as keyof RecordCard],
  );
  if (fields.length === 0) return current;
  const moved = current.status !== patch.status;
  const reopened = !moved && ["in_review", "approved"].includes(current.workflow.state);
  const assignment =
    fields.some((field) =>
      ["owner", "worker", "workerKind", "reviewer"].includes(field),
    ) && "owner" in patch
      ? {
          owner: patch.owner,
          worker: patch.worker,
          workerKind: patch.workerKind,
          reviewer: patch.reviewer,
        }
      : undefined;
  const activity: Activity = {
    version: current.version + 1,
    at,
    action: fields.length === 1 && moved ? "moved" : "edited",
    actor: publicDemo() ? "public-demo-visitor" : "local-developer",
    fields,
    ...(assignment ? { assignment } : {}),
    ...(reopened
      ? {
          workflow: {
            type: "brief_changed" as const,
            name: "Board editor",
            role: "human" as const,
            attempt: current.workflow.attempt + 1,
            note: "Card details changed. Previous evidence is retained in the timeline; submit fresh evidence for review.",
          },
        }
      : {}),
    ...(reopened
      ? { from: current.status, to: current.status }
      : moved
        ? { from: current.status, to: patch.status }
        : {}),
  };
  return {
    ...current,
    ...patch,
    ...(moved ? { workflow: blankWorkflow() } : {}),
    ...(reopened
      ? {
          status: current.status,
          workflow: {
            ...current.workflow,
            state: "working" as const,
            evidence: null,
            feedback: "",
            attempt: current.workflow.attempt + 1,
          },
        }
      : {}),
    version: current.version + 1,
    updatedAt: at,
    activity: [...current.activity, activity].slice(-500),
  };
}
