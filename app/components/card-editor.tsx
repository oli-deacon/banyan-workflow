import { useEffect, useRef, useState } from "react";
import { ActivityTimeline } from "./activity-timeline";
import { WorkflowPanel } from "./workflow-panel";
import type { WorkflowCommand } from "@/lib/workflow";
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
  [
    "stopCondition",
    "Stop Condition",
    "When should work pause and request human input?",
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
  onAction,
}: {
  publicDemo: boolean;
  initial: EditorCard;
  latest?: CardSummary;
  now: number;
  onLoadLatest: (id: string) => Promise<RecordCard>;
  onClose: () => void;
  onSave: (card: EditorCard) => Promise<void>;
  onAction: (
    id: string,
    version: number,
    command: WorkflowCommand,
  ) => Promise<RecordCard>;
}) {
  const [workflowDirty, setWorkflowDirty] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const workflowBusyRef = useRef(false);
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
  const dirty =
    workflowDirty || JSON.stringify(draft) !== JSON.stringify(initial);
  function requestClose() {
    if (savingRef.current || workflowBusyRef.current || loadingLatest) return;
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
          if (savingRef.current || workflowBusyRef.current || loadingLatest)
            return;
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
              disabled={saving || loadingLatest || workflowBusy}
              aria-label="Close details"
              onClick={requestClose}
            >
              ✕
            </button>
          </div>
        </header>
        <fieldset
          disabled={saving || loadingLatest || workflowBusy}
          className="detail-body"
        >
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
                    setWorkflowDirty(false);
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
              <p className="reading-owner">
                <span>Owner</span> {initial.owner || "Unassigned"}
              </p>
              {initial.version && (
                <WorkflowPanel
                  key={initial.version}
                  card={initial as RecordCard}
                  disabled={newer}
                  onDirtyChange={setWorkflowDirty}
                  onBusyChange={(value) => {
                    workflowBusyRef.current = value;
                    setWorkflowBusy(value);
                  }}
                  onAction={async (command) => {
                    const saved = await onAction(
                      initial.id,
                      initial.version!,
                      command,
                    );
                    setInitial(saved);
                    setDraft(saved);
                    setWorkflowDirty(false);
                  }}
                />
              )}
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
                  "stopCondition",
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
              {(initial as RecordCard).workflow &&
                ["in_review", "approved"].includes(
                  (initial as RecordCard).workflow.state,
                ) && (
                  <p className="warning">
                    Saving card changes reopens work and requires fresh evidence
                    and review. Previous submissions remain in the timeline.
                  </p>
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
                <label>
                  Owner
                  <input
                    aria-label="Owner"
                    aria-describedby="owner-hint"
                    value={draft.owner}
                    onChange={(event) => update("owner", event.target.value)}
                    maxLength={100}
                    placeholder="Unassigned"
                    autoComplete="off"
                  />
                  <span id="owner-hint" className="field-hint">
                    {publicDemo
                      ? "Use a fictional name for this public demo. Leave blank for unassigned."
                      : "The human accountable for the outcome. Leave blank for unassigned."}
                  </span>
                </label>
                <label>
                  Assigned worker
                  <input
                    aria-label="Assigned worker"
                    value={draft.worker}
                    maxLength={100}
                    placeholder="Unassigned"
                    onChange={(event) => update("worker", event.target.value)}
                  />
                </label>
                <label>
                  Worker type
                  <select
                    aria-label="Worker type"
                    value={draft.workerKind}
                    onChange={(event) =>
                      update("workerKind", event.target.value)
                    }
                  >
                    <option value="human">Human</option>
                    <option value="agent">Agent</option>
                  </select>
                </label>
                <label>
                  Reviewer
                  <input
                    aria-label="Reviewer"
                    value={draft.reviewer}
                    maxLength={100}
                    placeholder="Human reviewer"
                    onChange={(event) => update("reviewer", event.target.value)}
                  />
                </label>
                <label className="status-field">
                  Status
                  <select
                    disabled={
                      !!initial.version &&
                      (initial as RecordCard).workflow?.state !== "idle" &&
                      !!(initial as RecordCard).workflow
                    }
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
                    [
                      "Context",
                      ["context", "references", "constraints", "stopCondition"],
                    ],
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
                              aria-label={
                                key === "stopCondition" ? label : undefined
                              }
                              aria-describedby={
                                key === "stopCondition"
                                  ? "stop-condition-hint"
                                  : undefined
                              }
                              rows={key === "references" ? 2 : 3}
                              maxLength={20000}
                              value={draft[key]}
                              onChange={(event) =>
                                update(key, event.target.value)
                              }
                              placeholder={placeholder}
                            />
                            {key === "stopCondition" && (
                              <span
                                id="stop-condition-hint"
                                className="field-hint"
                              >
                                Defines when to pause and request human input.
                                This is workflow context; it does not run or
                                stop an agent.
                              </span>
                            )}
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
            <ActivityTimeline
              activity={initial.activity}
              now={now}
              publicDemo={publicDemo}
              expanded={
                (initial as RecordCard).workflow?.state !== undefined &&
                (initial as RecordCard).workflow?.state !== "idle"
              }
            />
          )}
        </fieldset>
        <footer className="detail-footer">
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <span className="save-hint">
            {workflowDirty
              ? "Unsaved workflow entry · save or cancel it before editing."
              : editing
                ? dirty
                  ? "Unsaved changes"
                  : "Save when you’re ready"
                : "Saved to the board"}
          </span>
          <button
            type="button"
            disabled={saving || loadingLatest || workflowBusy}
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
              disabled={workflowBusy || workflowDirty}
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
