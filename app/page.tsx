"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  blankCard,
  FIELDS,
  STATUSES,
  safeLink,
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
  const [undo, setUndo] = useState<{
    id: string;
    status: Status;
    version: number;
  } | null>(null);
  const [settled, setSettled] = useState<string | null>(null);
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
      setNotice("");
      setUndo(null);
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
  async function move(id: string, status: Status, undoVersion?: number) {
    if (pending.current) return;
    const card = cards.find((item) => item.id === id);
    if (!card || (card.status === status && undoVersion === undefined)) return;
    const retainFocus =
      document.activeElement?.getAttribute("data-move-id") === id;
    pending.current = true;
    setBusy(true);
    try {
      const data = await api(`${API}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          expectedVersion: undoVersion ?? card.version,
        }),
      });
      setCards((current) =>
        current.map((item) => (item.id === id ? data.card : item)),
      );
      setStorageWarning("");
      setUndo(
        undoVersion === undefined
          ? { id, status: card.status, version: data.card.version }
          : null,
      );
      setSettled(id);
      setNotice(
        undoVersion === undefined
          ? `“${card.title}” moved to ${status}.`
          : `Move undone. “${card.title}” is back in ${status}.`,
      );
    } catch (error) {
      setNotice("");
      setUndo(null);
      setStorageWarning(
        `${undoVersion === undefined ? "Move" : "Undo"} could not be completed. ${(error as Error).message}`,
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
          <span aria-hidden="true">●</span>{" "}
          {!ready && busy
            ? "Connecting…"
            : mode === "public-demo"
              ? "Shared public demo"
              : "Personal workspace"}
        </span>
      </header>
      <section className="workspace-heading">
        <div className="workspace-name">
          <h1>Modernization</h1>
          <span>{ready ? `${cards.length} cards` : "Loading…"}</span>
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
        <p>
          {!ready && busy
            ? "Connecting to your board…"
            : mode === "public-demo"
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
          <strong>Public demo — synthetic data only.</strong> Anyone can view
          and edit these cards. Do not enter personal, customer or confidential
          work information. Use Refresh board to see others’ changes.
        </div>
      )}
      {storageWarning && (
        <div className="warning" role="alert">
          {storageWarning}
        </div>
      )}
      <div className={`toast ${notice && !editor ? "visible" : ""}`}>
        <span role="status" aria-live="polite">
          {notice && (
            <>
              <span className="success-check" aria-hidden="true">
                ✓
              </span>
              {notice}
            </>
          )}
        </span>
        {notice && undo && (
          <button
            disabled={busy}
            onClick={() => void move(undo.id, undo.status, undo.version)}
          >
            Undo
          </button>
        )}
        {notice && (
          <button
            aria-label="Dismiss notification"
            onClick={() => {
              setNotice("");
              setUndo(null);
            }}
          >
            ✕
          </button>
        )}
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
                    <span className="status-dot" aria-hidden="true">
                      {status === "Done" ? "✓" : ""}
                    </span>
                    {status}
                  </h2>
                  <span className="count">{items.length}</span>
                </header>
                <div className="card-list">
                  {items.map((card) => (
                    <article
                      className={`card ${dragging === card.id ? "dragging" : ""} ${settled === card.id ? "settled" : ""}`}
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
  const [editing, setEditing] = useState(!initial.version);
  const [moreDetail, setMoreDetail] = useState(!!initial.version);
  const editButton = useRef<HTMLButtonElement>(null);
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
    if (initial.version) editButton.current?.focus();
    else title.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      node.close();
    };
  }, [initial.version]);
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
            "button, input, textarea, select, summary, a[href], [tabindex]",
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
          if (!editing) return;
          const invalid = validateCard(draft);
          if (invalid) {
            setError(invalid);
            setMoreDetail(true);
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
              {initial.version
                ? editing
                  ? "Edit card"
                  : initial.title
                : "New card"}
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
            <p className="warning">
              Synthetic data only. This card and its edits are visible to
              everyone.
            </p>
          )}
          {!editing ? (
            <div className="card-reading">
              <span
                className={`status-badge tone-${STATUSES.indexOf(initial.status)}`}
              >
                <span className="status-dot" aria-hidden="true">
                  {initial.status === "Done" ? "✓" : ""}
                </span>
                {initial.status}
              </span>
              {initial.summary && (
                <p className="reading-summary">{initial.summary}</p>
              )}
              {(
                [
                  "objective",
                  "acceptance",
                  "context",
                  "references",
                  "constraints",
                  "progress",
                  "outputs",
                ] as const
              ).map(
                (key) =>
                  initial[key].trim() && (
                    <section
                      key={key}
                      className={`reading-section ${key === "objective" || key === "acceptance" ? "purpose-section" : ""}`}
                    >
                      <h3>
                        {detailFields.find(([field]) => field === key)![1]}
                      </h3>
                      {key === "references" ? (
                        initial.references
                          .split("\n")
                          .filter((link) => safeLink(link.trim()))
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
                          ))
                      ) : (
                        <p>{initial[key]}</p>
                      )}
                    </section>
                  ),
              )}
              {!detailFields.some(([key]) => initial[key].trim()) && (
                <p className="reading-empty">
                  A starting point is enough. Use Edit card to add an objective,
                  context or a next step when you’re ready.
                </p>
              )}
            </div>
          ) : (
            <>
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
              <button
                className="detail-toggle"
                type="button"
                aria-expanded={moreDetail}
                aria-controls="additional-detail"
                onClick={() => setMoreDetail(!moreDetail)}
              >
                {moreDetail ? "− Hide additional detail" : "+ Add more detail"}
                <span>Purpose, context and progress · optional</span>
              </button>
              <div id="additional-detail" hidden={!moreDetail}>
                {(
                  [
                    ["Purpose", ["objective", "acceptance"]],
                    ["Context", ["context", "references", "constraints"]],
                    ["Progress", ["progress", "outputs"]],
                  ] as const
                ).map(([group, keys]) => (
                  <section className="field-group" key={group}>
                    <h3>{group}</h3>
                    <div className="detail-grid">
                      {keys.map((key) => {
                        const [, label, placeholder] = detailFields.find(
                          ([field]) => field === key,
                        )!;
                        return (
                          <label key={key}>
                            {label}
                            <textarea
                              rows={key === "references" ? 2 : 3}
                              maxLength={20000}
                              value={draft[key]}
                              onChange={(event) =>
                                update(key, event.target.value)
                              }
                              placeholder={placeholder}
                            />
                            {key === "references" && (
                              <span className="field-hint">
                                One full http:// or https:// URL per line.
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
          {initial.activity && (
            <details className="activity">
              <summary>
                Activity history{" "}
                <span>
                  {initial.activity.length}{" "}
                  {initial.activity.length === 1 ? "event" : "events"}
                </span>
              </summary>
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
            </details>
          )}
        </fieldset>
        <footer className="detail-footer">
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <span className="save-hint">
            {editing
              ? dirty
                ? "Unsaved changes"
                : "Save when you’re ready"
              : "Saved to the board"}
          </span>
          <button type="button" disabled={saving} onClick={requestClose}>
            {editing ? "Cancel" : "Close"}
          </button>
          {!editing ? (
            <button
              key="edit"
              ref={editButton}
              className="primary"
              type="button"
              onClick={() => {
                setEditing(true);
                requestAnimationFrame(() => title.current?.focus());
              }}
            >
              Edit card
            </button>
          ) : (
            <button
              key="save"
              className="primary"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : initial.version
                  ? "Save changes"
                  : "Create card"}
            </button>
          )}
        </footer>
      </form>
    </dialog>
  );
}
