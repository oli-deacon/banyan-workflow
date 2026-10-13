"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  blankCard,
  FIELDS,
  STATUSES,
  validateCard,
  type Card,
  type Status,
} from "@/lib/board";

import type { RecordCard, Activity } from "@/lib/server/model";
type WorkflowCard = Card & { version?: number; activity?: Activity[] };
const API = "/api/boards/modernization/cards";
async function api(path = API, options?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(path, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error || "The server could not complete this request.",
      );
    return data;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name !== "AbortError" &&
      error.name !== "TypeError"
    )
      throw error;
    throw new Error(
      "Could not confirm the server response. Keep your draft and refresh the board before retrying; the earlier write may have succeeded.",
    );
  } finally {
    clearTimeout(timer);
  }
}
function payload(card: WorkflowCard) {
  return Object.fromEntries(
    ["id", "status", "sample", ...FIELDS].map((key) => [
      key,
      card[key as keyof Card],
    ]),
  );
}

const detailFields = [
  ["objective", "Objective", "What outcome are we working toward?"],
  ["context", "Input context", "Background, inputs and what is already known."],
  [
    "references",
    "Reference links",
    "One full https:// or http:// URL per line.",
  ],
  [
    "constraints",
    "Constraints",
    "Boundaries, dependencies and things to preserve.",
  ],
  [
    "acceptance",
    "Acceptance criteria",
    "What must be true for this work to be complete?",
  ],
  ["progress", "Progress & blockers", "What changed? What needs attention?"],
  ["outputs", "Outputs", "Decisions, deliverables and results."],
] as const;

export default function Board() {
  const [cards, setCards] = useState<WorkflowCard[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [editor, setEditor] = useState<WorkflowCard | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState("unavailable");
  const [busy, setBusy] = useState(true);
  const pending = useRef(false);
  async function refresh() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const data = await api();
      setCards(data.cards);
      setMode(data.mode);
      setStorageWarning("");
      setReady(true);
    } catch (error) {
      setStorageWarning((error as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    pending.current = true;
    api()
      .then((data) => {
        if (active) {
          setCards(data.cards);
          setMode(data.mode);
          setReady(true);
        }
      })
      .catch((error) => {
        if (active) setStorageWarning((error as Error).message);
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
  async function save(card: WorkflowCard) {
    if (pending.current)
      throw new Error(
        "Another request is still running. Please try again in a moment.",
      );
    pending.current = true;
    setBusy(true);
    try {
      const existing = card.version !== undefined;
      const data = await api(
        existing ? `${API}/${encodeURIComponent(card.id)}` : API,
        {
          method: existing ? "PATCH" : "POST",
          body: JSON.stringify({
            card: payload(card),
            ...(existing ? { expectedVersion: card.version } : {}),
          }),
        },
      );
      const saved = data.card as RecordCard;
      setCards((current) =>
        current.some((item) => item.id === saved.id)
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved],
      );
      setStorageWarning("");
      setNotice(`${saved.title} saved on the server.`);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function move(id: string, status: Status) {
    if (pending.current) return;
    const card = cards.find((item) => item.id === id);
    if (!card || card.status === status) return;
    const retainFocus =
      document.activeElement?.getAttribute("data-move-id") === id;
    pending.current = true;
    setBusy(true);
    try {
      const data = await api(`${API}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, expectedVersion: card.version }),
      });
      setCards((current) =>
        current.map((item) => (item.id === id ? data.card : item)),
      );
      setStorageWarning("");
      setNotice(`${card.title} moved to ${status}.`);
    } catch (error) {
      setStorageWarning((error as Error).message);
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
  function open(card: WorkflowCard) {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ ...card, id: card.id || crypto.randomUUID() });
  }
  function close() {
    setEditor(null);
    requestAnimationFrame(() => {
      (opener.current?.isConnected
        ? opener.current
        : newButton.current
      )?.focus();
    });
  }
  return (
    <main>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Banyan home">
          <span className="brand-mark" aria-hidden="true">
            b
          </span>
          banyan<span className="brand-sub"> / workflow</span>
        </Link>
        <span className="local-tag">
          <span aria-hidden="true">●</span> {mode === "public-demo" ? "Shared public demo" : "Personal workspace"}
        </span>
      </header>
      <section className="workspace-heading">
        <div>
          <p className="eyebrow">WORKSPACE / MODERNIZATION</p>
          <h1>Work, moving forward.</h1>
          <p className="subtitle">
            Give every piece of work a clear next step.
          </p>
        </div>
        <button
          ref={newButton}
          className="primary"
          disabled={!ready || busy}
          onClick={() => open(blankCard())}
        >
          ＋ New card
        </button>
      </section>
      <div className="board-toolbar">
        <div className="board-title">
          Board <span>{cards.length} cards</span>
        </div>
        <p>
          {mode === "public-demo"
            ? "Shared demo · changes saved for everyone"
            : mode === "mongodb"
            ? "MongoDB · local development access"
            : mode === "mock"
              ? "MOCK MODE · memory only, resets on restart"
              : "Server connection unavailable"}
        </p>
        <button disabled={busy} onClick={() => void refresh()}>
          {busy ? "Working…" : "Refresh board"}
        </button>
      </div>
      {mode === "public-demo" && (
        <div className="warning">
          <strong>Public demo — synthetic data only.</strong> Anyone can view and edit these cards.
          Do not enter personal, customer or confidential work information. Use Refresh board to see others’ changes.
        </div>
      )}
      {storageWarning && (
        <div className="warning" role="alert">
          {storageWarning}
        </div>
      )}
      <div className="sr-only" role="status" aria-live="polite">
        {notice}
      </div>
      {!ready ? (
        <p className="loading">
          {storageWarning
            ? "The board could not load. Check the message above, then refresh."
            : "Loading your workspace…"}
        </p>
      ) : (
        <div className="board" aria-label="Workflow board">
          {STATUSES.map((status, index) => {
            const items = cards.filter((card) => card.status === status);
            return (
              <section
                key={status}
                aria-label={status}
                className={`column tone-${index} ${over === status ? "drop-target" : ""}`}
                onDragOver={(event) => {
                  if (dragging) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setOver(status);
                  }
                }}
                onDragLeave={(event) => {
                  if (
                    !event.currentTarget.contains(event.relatedTarget as Node)
                  )
                    setOver(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (
                    dragging &&
                    event.dataTransfer.getData("text/plain") === dragging
                  )
                    move(dragging, status);
                  setDragging(null);
                  setOver(null);
                }}
              >
                <header className="column-heading">
                  <h2>
                    <span className="status-dot" />
                    {status}
                  </h2>
                  <span className="count">{items.length}</span>
                </header>
                <div className="card-list">
                  {items.map((card) => (
                    <article
                      className={`card ${dragging === card.id ? "dragging" : ""}`}
                      key={card.id}
                      draggable={!busy}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", card.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDragging(card.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                    >
                      <button className="card-open" onClick={() => open(card)}>
                        <span className="card-title">{card.title}</span>
                        <span className="card-summary">
                          {card.summary ||
                            "Add a summary to give this work context."}
                        </span>
                      </button>
                      <footer className="card-footer">
                        <span className="sample-label">
                          {card.sample ? "SAMPLE" : "WORK ITEM"}
                        </span>
                        <label className="move-control">
                          <span>Move</span>
                          <select
                            disabled={busy}
                            data-move-id={card.id}
                            aria-label={`Move ${card.title}`}
                            value={card.status}
                            onChange={(event) =>
                              move(card.id, event.target.value as Status)
                            }
                          >
                            {STATUSES.map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </select>
                          <span aria-hidden="true">↗</span>
                        </label>
                      </footer>
                    </article>
                  ))}
                </div>
                {items.length === 0 && (
                  <p className="empty">
                    Nothing here yet.
                    <br />
                    Move a card here or create one.
                  </p>
                )}
                <button
                  disabled={busy}
                  className="add-card"
                  onClick={() => open(blankCard(status))}
                >
                  ＋ Add card<span className="sr-only"> to {status}</span>
                </button>
              </section>
            );
          })}
        </div>
      )}
      <footer className="workspace-footer">
        <span>Built for a little more clarity.</span>
        <span>
          Example cards are synthetic sample data. No agents or integrations run
          here.
        </span>
      </footer>
      {editor && (
        <CardEditor
          publicDemo={mode === "public-demo"}
          initial={editor}
          onClose={close}
          onSave={async (card) => {
            await save(card);
            close();
          }}
        />
      )}
    </main>
  );
}

function CardEditor({
  publicDemo,
  initial,
  onClose,
  onSave,
}: {
  publicDemo: boolean;
  initial: WorkflowCard;
  onClose: () => void;
  onSave: (card: WorkflowCard) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  function requestClose() {
    if (savingRef.current) return;
    if (!dirty || window.confirm("Discard your unsaved changes?")) onClose();
  }
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    title.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      node.close();
    };
  }, []);
  function update(key: keyof Card, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }
  return (
    <dialog
      ref={dialog}
      className={`detail-panel ${expanded ? "expanded" : ""}`}
      aria-labelledby="detail-heading"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button, input, textarea, select, a[href], [tabindex]",
          ),
        ).filter(
          (element) =>
            !element.matches(":disabled") &&
            element.tabIndex >= 0 &&
            element.getClientRects().length > 0,
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          const invalid = validateCard(draft);
          if (invalid) {
            setError(invalid);
            if (!draft.title.trim()) title.current?.focus();
            return;
          }
          if (savingRef.current) return;
          savingRef.current = true;
          setSaving(true);
          setError("");
          try {
            await onSave(draft);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            savingRef.current = false;
            setSaving(false);
          }
        }}
      >
        <header className="detail-header">
          <div>
            <p className="eyebrow">
              {draft.sample ? "SAMPLE WORK ITEM" : "WORK ITEM"}
            </p>
            <h2 id="detail-heading">
              {initial.version ? "Card details" : "New card"}
            </h2>
          </div>
          <div className="panel-actions">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Collapse panel" : "Expand panel"}
              aria-pressed={expanded}
            >
              {expanded ? "↙" : "↗"}
              <span>{expanded ? "Collapse" : "Expand"}</span>
            </button>
            <button
              type="button"
              disabled={saving}
              aria-label="Close details"
              onClick={requestClose}
            >
              ✕
            </button>
          </div>
        </header>
        <fieldset disabled={saving} className="detail-body">
          {publicDemo && (
            <p className="warning">Synthetic data only. This card and its edits are visible to everyone.</p>
          )}
          <div className="detail-intro">
            <label>
              Title <span className="required">Required</span>
              <input
                ref={title}
                value={draft.title}
                onChange={(event) => update("title", event.target.value)}
                maxLength={160}
                required
                aria-invalid={!!error && !draft.title.trim()}
                placeholder="What needs to move forward?"
              />
            </label>
            <label>
              Summary
              <textarea
                rows={2}
                maxLength={400}
                value={draft.summary}
                onChange={(event) => update("summary", event.target.value)}
                placeholder="A short description for the board."
              />
            </label>
            <label className="status-field">
              Status
              <select
                value={draft.status}
                onChange={(event) => update("status", event.target.value)}
              >
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="detail-grid">
            {detailFields.map(([key, label, placeholder]) => (
              <label key={key}>
                {label}
                <textarea
                  rows={key === "references" ? 2 : 3}
                  maxLength={20000}
                  value={draft[key]}
                  onChange={(event) => update(key, event.target.value)}
                  placeholder={placeholder}
                />
                {key === "references" && (
                  <span className="field-hint">
                    One full http:// or https:// URL per line. Links open in a
                    new tab.
                  </span>
                )}
              </label>
            ))}
          </div>
          {draft.references
            .split("\n")
            .filter((link) => {
              try {
                return ["https:", "http:"].includes(
                  new URL(link.trim()).protocol,
                );
              } catch {
                return false;
              }
            })
            .map((link, index) => (
              <a
                className="reference-link"
                key={index}
                href={link.trim()}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.trim()} ↗
              </a>
            ))}
          {initial.activity && (
            <section className="activity">
              <h3>Activity history</h3>
              <p>
                Latest {initial.activity.length} events · current version{" "}
                {initial.version}
              </p>
              <ol>
                {[...initial.activity].reverse().map((event) => (
                  <li key={event.version}>
                    <strong>
                      v{event.version} · {event.action}
                    </strong>{" "}
                    · {new Date(event.at).toLocaleString()}
                    <br />
                    {event.actor}
                    {event.from ? ` · ${event.from} → ${event.to}` : ""}
                    {event.fields.length ? ` · ${event.fields.join(", ")}` : ""}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </fieldset>
        <footer className="detail-footer">
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <span className="save-hint">
            {dirty ? "Unsaved changes" : "Changes save to the server"}
          </span>
          <button type="button" disabled={saving} onClick={requestClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={saving}>
            {saving
              ? "Saving…"
              : initial.version
                ? "Save changes"
                : "Create card"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
