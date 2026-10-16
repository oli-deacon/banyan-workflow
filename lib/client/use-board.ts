"use client";
import type { WorkflowCommand } from "../workflow";

import { useEffect, useRef, useState } from "react";
import { STATUSES, type Status } from "../board";
import {
  summarizeCard,
  type CardSummary,
  type EditorCard,
} from "../card-types";
import { loadBoard, loadCard, saveCard, moveCard, commandCard } from "./api";

export function useBoard(dragging: string | null) {
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<{
    id: string;
    status: Status;
    version: number;
  } | null>(null);
  const [settled, setSettled] = useState<string | null>(null);
  const [writeWarning, setWriteWarning] = useState("");
  const [readWarning, setReadWarning] = useState("");
  const [mode, setMode] = useState("unavailable");
  const [busy, setBusy] = useState(true);
  const pending = useRef(false);
  const readEpoch = useRef(0);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [syncWarning, setSyncWarning] = useState("");
  const [clock, setClock] = useState(0);
  useEffect(() => {
    let active = true;
    let reading = false;
    async function sync() {
      if (
        document.visibilityState !== "visible" ||
        pending.current ||
        reading ||
        dragging
      )
        return;
      reading = true;
      const epoch = readEpoch.current;
      try {
        const data = await loadBoard();
        if (!active || pending.current || epoch !== readEpoch.current) return;
        setCards(data.cards);
        setReadWarning("");
        setMode(data.mode);
        setReady(true);
        setCheckedAt(Date.now());
        setSyncWarning("");
      } catch {
        if (active && epoch === readEpoch.current)
          setSyncWarning(
            "Updates paused. We’ll retry automatically; your open draft is safe.",
          );
      } finally {
        reading = false;
      }
    }
    const tick = setInterval(() => void sync(), 5 * 60 * 1000);
    const clockTick = setInterval(() => setClock(Date.now()), 60 * 1000);
    const resume = () => {
      void sync();
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      active = false;
      clearInterval(tick);
      clearInterval(clockTick);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [dragging, ready]);
  async function refresh() {
    if (pending.current) return;
    pending.current = true;
    readEpoch.current += 1;
    setBusy(true);
    try {
      const data = await loadBoard();
      setCards(data.cards);
      setNotice("");
      setUndo(null);
      setMode(data.mode);
      setReadWarning("");
      setReady(true);
      setCheckedAt(Date.now());
      setSyncWarning("");
    } catch (error) {
      setReadWarning((error as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    pending.current = true;
    readEpoch.current += 1;
    loadBoard()
      .then((data) => {
        if (active) {
          setCards(data.cards);
          setMode(data.mode);
          setReady(true);
          setCheckedAt(Date.now());
        }
      })
      .catch((error) => {
        if (active) setReadWarning((error as Error).message);
      })
      .finally(() => {
        if (active) {
          pending.current = false;
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(card: EditorCard) {
    if (pending.current)
      throw new Error(
        "Another request is still running. Please try again in a moment.",
      );
    pending.current = true;
    readEpoch.current += 1;
    setBusy(true);
    try {
      const existing = card.version !== undefined;
      const saved = await saveCard(card);
      setCards((current) =>
        current.some((item) => item.id === saved.id)
          ? current.map((item) =>
              item.id === saved.id ? summarizeCard(saved) : item,
            )
          : [...current, summarizeCard(saved)],
      );
      setWriteWarning("");
      setUndo(null);
      setNotice(
        existing
          ? `Changes saved to “${saved.title}”.`
          : `“${saved.title}” created. You’re ready to begin.`,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function move(id: string, status: Status, reviewVersion?: number, isUndo = false) {
    if (pending.current) return;
    const card = cards.find((item) => item.id === id);
    if (!card || (card.status === status && !isUndo)) return;
    const retainFocus =
      document.activeElement?.getAttribute("data-move-id") === id;
    pending.current = true;
    readEpoch.current += 1;
    setBusy(true);
    try {
      const saved = await moveCard(id, status, reviewVersion ?? card.version);
      setCards((current) =>
        current.map((item) => (item.id === id ? summarizeCard(saved) : item)),
      );
      setWriteWarning("");
      setUndo(
        !isUndo && STATUSES.indexOf(status) > STATUSES.indexOf(card.status)
          ? { id, status: card.status, version: saved.version }
          : null,
      );
      setSettled(id);
      setNotice(
        !isUndo
          ? status === "Complete"
            ? `“${card.title}” is done. A little more clarity.`
            : `“${card.title}” moved to ${status}.`
          : `Move undone. “${card.title}” is back in ${status}.`,
      );
      return true;
    } catch (error) {
      setNotice("");
      setUndo(null);
      setWriteWarning(
        `${!isUndo ? "Move" : "Undo"} could not be completed. ${(error as Error).message}`,
      );
    } finally {
      pending.current = false;
      setBusy(false);
      if (retainFocus)
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLSelectElement>(
              `[data-move-id="${CSS.escape(id)}"]`,
            )
            ?.focus(),
        );
    }
  }
  useEffect(() => {
    if (!settled) return;
    const timer = setTimeout(() => setSettled(null), 900);
    return () => clearTimeout(timer);
  }, [settled]);

  async function act(
    id: string,
    expectedVersion: number,
    command: WorkflowCommand,
  ) {
    if (pending.current)
      throw new Error(
        "Another request is still running. Please try again in a moment.",
      );
    pending.current = true;
    readEpoch.current += 1;
    setBusy(true);
    try {
      const saved = await commandCard(id, expectedVersion, command);
      setCards((current) =>
        current.map((item) => (item.id === id ? summarizeCard(saved) : item)),
      );
      setUndo(null);
      setNotice("");
      setWriteWarning("");
      return saved;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function getCard(id: string) {
    const card = await loadCard(id);
    setCards((current) =>
      current.map((item) =>
        item.id === card.id && item.version <= card.version
          ? summarizeCard(card)
          : item,
      ),
    );
    return card;
  }
  return {
    cards,
    ready,
    busy,
    mode,
    notice,
    undo,
    settled,
    readWarning,
    writeWarning,
    syncWarning,
    now: Math.max(clock, checkedAt || 0),
    refresh,
    save,
    move,
    getCard,
    act,
    dismissNotice: () => {
      setNotice("");
      setUndo(null);
    },
  };
}
