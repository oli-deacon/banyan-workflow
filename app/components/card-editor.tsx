import { useEffect, useRef, useState } from "react";
import { activityText, actorText, relativeTime } from "@/lib/activity";
import { STATUSES, safeLink, validateCard, type Card } from "@/lib/board";
import type { EditorCard, CardSummary } from "@/lib/card-types";
import type { RecordCard } from "@/lib/server/model";

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

export function CardEditor({
  publicDemo,
  initial: opened,
  latest,
  now,
  onLoadLatest,
  onClose,
  onSave,
}: {
  publicDemo: boolean;
  initial: EditorCard;
  latest?: CardSummary;
  now: number;
  onLoadLatest: (id: string) => Promise<RecordCard>;
  onClose: () => void;
  onSave: (card: EditorCard) => Promise<void>;
}) {
  const [initial, setInitial] = useState(opened);
  const [confirmLatest, setConfirmLatest] = useState(false);
  const [draft, setDraft] = useState(opened);
  const newer =
    !!latest?.version && !!initial.version && latest.version > initial.version;
  const [editing, setEditing] = useState(!initial.version);
  const [moreDetail, setMoreDetail] = useState(!!initial.version);
  const editButton = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLInputElement>(null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  function requestClose() {
    if (savingRef.current || loadingLatest) return;
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
          if (!editing || newer || loadingLatest || (initial.version && !dirty))
            return;
          const invalid = validateCard(draft);
          if (invalid) {
            setError(invalid);
            setMoreDetail(true);
            if (!draft.title.trim()) title.current?.focus();
            return;
          }
          if (savingRef.current || loadingLatest) return;
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
              disabled={saving || loadingLatest}
              aria-label="Close details"
              onClick={requestClose}
            >
              ✕
            </button>
          </div>
        </header>
        <fieldset disabled={saving || loadingLatest} className="detail-body">
          {newer && (
            <div className="update-banner" role="status">
              <strong>A newer version is available.</strong>
              <p>
                {editing
                  ? "Your draft is untouched. Copy any changes you want to keep before loading the latest card."
                  : "This card changed since you opened it."}
              </p>
              <button
                type="button"
                disabled={loadingLatest}
                onClick={async () => {
                  if (dirty && !confirmLatest) {
                    setConfirmLatest(true);
                    return;
                  }
                  setLoadingLatest(true);
                  try {
                    const card = await onLoadLatest(initial.id);
                    setInitial(card);
                    setDraft(card);
                    setConfirmLatest(false);
                    setError("");
                  } catch (error) {
                    setError((error as Error).message);
                  } finally {
                    setLoadingLatest(false);
                  }
                }}
              >
                {confirmLatest
                  ? "Discard draft and load latest"
                  : "Load latest card"}
              </button>
              {confirmLatest && (
                <>
                  <p role="alert">
                    This will replace your unsaved changes. Copy anything you
                    want to keep first.
                  </p>
                  <button type="button" onClick={() => setConfirmLatest(false)}>
                    Keep my draft
                  </button>
                </>
              )}
            </div>
          )}
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
              <p className="activity-note">
                {publicDemo
                  ? "Visitors are anonymous; entries may be from different people."
                  : "Changes saved to this card."}{" "}
                {initial.activity.length === 500
                  ? "Showing the latest 500 events."
                  : ""}
              </p>
              <ol>
                {[...initial.activity].reverse().map((event) => (
                  <li key={event.version}>
                    <span className="activity-marker" aria-hidden="true">
                      {event.to === "Done"
                        ? "✓"
                        : event.action === "created" ||
                            event.action === "seeded"
                          ? "+"
                          : "↗"}
                    </span>
                    <div>
                      <strong>{activityText(event)}</strong>
                      <p>
                        {actorText(event.actor)} ·{" "}
                        <time
                          dateTime={event.at}
                          title={new Date(event.at).toLocaleString()}
                        >
                          {relativeTime(event.at, now)}
                        </time>
                      </p>
                      <details className="event-details">
                        <summary>Details</summary>
                        <p>
                          {new Date(event.at).toLocaleString()} · Revision{" "}
                          {event.version}
                        </p>
                      </details>
                    </div>
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
          <button
            type="button"
            disabled={saving || loadingLatest}
            onClick={requestClose}
          >
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
              disabled={
                saving ||
                loadingLatest ||
                newer ||
                (!!initial.version && !dirty)
              }
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
