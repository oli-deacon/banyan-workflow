import { MongoClient, type Collection } from "mongodb";
import { type Card, samples } from "../board";
import {
  ApiError,
  BOARD_ID,
  DATABASE,
  newRecord,
  revision,
  type RecordCard,
} from "./model";
export interface Store {
  list(boardId: string): Promise<RecordCard[]>;
  create(boardId: string, card: Card, seed?: boolean): Promise<RecordCard>;
  update(
    boardId: string,
    id: string,
    expected: number,
    patch: Card | { status: Card["status"] },
  ): Promise<RecordCard>;
}
const missing = () => new ApiError(404, "Card not found.", "NOT_FOUND");
const conflict = () =>
  new ApiError(
    409,
    "This card changed since you opened it. Your draft is still here. Copy any edits you need, close the panel and refresh the board before editing again.",
    "VERSION_CONFLICT",
  );
export class MemoryStore implements Store {
  private records = new Map<string, RecordCard>();
  async list(board: string) {
    return structuredClone(
      [...this.records.values()].filter((card) => card.boardId === board),
    );
  }
  async create(board: string, card: Card, seed = false) {
    const key = board + ":" + card.id;
    const old = this.records.get(key);
    if (old) {
      if (seed) return structuredClone(old);
      throw new ApiError(
        409,
        "Card ID already exists. Refresh the board to check whether the earlier save succeeded.",
        "DUPLICATE_ID",
      );
    }
    const record = newRecord(card, board, seed);
    this.records.set(key, record);
    return structuredClone(record);
  }
  async update(
    board: string,
    id: string,
    expected: number,
    patch: Card | { status: Card["status"] },
  ) {
    const key = board + ":" + id;
    const old = this.records.get(key);
    if (!old) throw missing();
    if (old.version !== expected) throw conflict();
    const next = revision(old, patch);
    this.records.set(key, next);
    return structuredClone(next);
  }
}
export class MongoStore implements Store {
  constructor(private collection: Collection<RecordCard>) {}
  async list(boardId: string) {
    return this.collection
      .find({ boardId }, { projection: { _id: 0 } })
      .sort({ createdAt: 1, id: 1 })
      .toArray();
  }
  async create(boardId: string, card: Card, seed = false) {
    const record = newRecord(card, boardId, seed);
    try {
      if (seed) {
        await this.collection.updateOne(
          { boardId, id: card.id },
          { $setOnInsert: record },
          { upsert: true },
        );
        return (await this.collection.findOne(
          { boardId, id: card.id },
          { projection: { _id: 0 } },
        ))!;
      }
      await this.collection.insertOne({ ...record });
      return record;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        if (seed)
          return (await this.collection.findOne(
            { boardId, id: card.id },
            { projection: { _id: 0 } },
          ))!;
        throw new ApiError(
          409,
          "Card ID already exists. Refresh the board to check whether the earlier save succeeded.",
          "DUPLICATE_ID",
        );
      }
      throw error;
    }
  }
  async update(
    boardId: string,
    id: string,
    expected: number,
    patch: Card | { status: Card["status"] },
  ) {
    const old = await this.collection.findOne(
      { boardId, id },
      { projection: { _id: 0 } },
    );
    if (!old) throw missing();
    if (old.version !== expected) throw conflict();
    const next = revision(old, patch);
    const saved = await this.collection.findOneAndUpdate(
      { boardId, id, version: expected },
      { $set: next },
      { returnDocument: "after", projection: { _id: 0 } },
    );
    if (!saved) throw conflict();
    return saved;
  }
}
export async function seed(store: Store) {
  for (const card of samples) await store.create(BOARD_ID, card, true);
}
const globalStore = globalThis as typeof globalThis & {
  banyanStore?: Promise<Store>;
};
export function storageMode() {
  return process.env.BANYAN_STORAGE;
}
export async function getStore(): Promise<Store> {
  if (!globalStore.banyanStore) {
    globalStore.banyanStore = (async () => {
      if (storageMode() === "mock" && process.env.NODE_ENV !== "production") {
        const store = new MemoryStore();
        await seed(store);
        return store;
      }
      if (storageMode() !== "mongodb" || !process.env.MONGODB_URI)
        throw new ApiError(
          503,
          "Database is not configured. Set up the approved Banyan connection, or explicitly start local mock mode.",
          "NOT_CONFIGURED",
        );
      const client = new MongoClient(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        maxPoolSize: 5,
      });
      try {
        await client.connect();
        const collection = client.db(DATABASE).collection<RecordCard>("cards");
        await collection.createIndex({ boardId: 1, id: 1 }, { unique: true });
        return new MongoStore(collection);
      } catch {
        await client.close();
        throw new ApiError(
          503,
          "Cannot connect to the Banyan database. No changes were saved. Check server connection settings.",
          "DATABASE_UNAVAILABLE",
        );
      }
    })().catch((error) => {
      delete globalStore.banyanStore;
      throw error;
    });
  }
  return globalStore.banyanStore;
}
