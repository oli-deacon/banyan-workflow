import { Card, FIELDS, isStatus, validateCard } from "../board";
import { publicDemo } from "./access";
export const BOARD_ID = "modernization";
export const DATABASE = "banyan_workflow";
export type Activity = {
  version: number;
  at: string;
  action: "created" | "edited" | "moved" | "seeded";
  actor: "local-developer" | "sample-seed" | "public-demo-visitor";
  fields: string[];
  from?: string;
  to?: string;
};
export type RecordCard = Card & {
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
  const item = object(value);
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
  return { ...card, title: card.title.trim(), summary: card.summary.trim() };
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
    ...card,
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
      },
    ],
  };
}
export function revision(
  current: RecordCard,
  patch: Card | { status: Card["status"] },
): RecordCard {
  const at = new Date().toISOString();
  const fields = Object.keys(patch).filter(
    (key) =>
      patch[key as keyof typeof patch] !== current[key as keyof RecordCard],
  );
  if (fields.length === 0) return current;
  const moved = current.status !== patch.status;
  const activity: Activity = {
    version: current.version + 1,
    at,
    action: fields.length === 1 && moved ? "moved" : "edited",
    actor: publicDemo() ? "public-demo-visitor" : "local-developer",
    fields,
    ...(moved ? { from: current.status, to: patch.status } : {}),
  };
  return {
    ...current,
    ...patch,
    version: current.version + 1,
    updatedAt: at,
    activity: [...current.activity, activity].slice(-500),
  };
}
