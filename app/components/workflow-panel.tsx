"use client";

import { useRef, useState } from "react";
import type { RecordCard } from "@/lib/server/model";
import {
  acceptanceItems,
  blankWorkflow,
  workStateLabel,
  type WorkflowCommand,
} from "@/lib/workflow";

export function WorkflowPanel({
  card,
  disabled = false,
  readOnly = false,
  simulatedNext,
  onAction,
  onBusyChange,
  onDirtyChange,
}: {
  card: RecordCard;
  disabled?: boolean;
  readOnly?: boolean;
  simulatedNext?: string;
  onAction: (command: WorkflowCommand) => Promise<void>;
  onBusyChange: (value: boolean) => void;
  onDirtyChange: (value: boolean) => void;
}) {
  const workflow = card.workflow ?? blankWorkflow();
  const [action, setAction] = useState<
    "request_input" | "submit_review" | "request_changes" | "approve" | null
  >(null);
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");
  const [links, setLinks] = useState("");
  const [tests, setTests] = useState("");
  const [checked, setChecked] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const criteria = acceptanceItems(card);
  function change(
    patch: Partial<{
      note: string;
      summary: string;
      links: string;
      tests: string;
      checked: number[];
    }>,
  ) {
    const next = { note, summary, links, tests, checked, ...patch };
    onDirtyChange(
      !!(
        next.note ||
        next.summary ||
        next.links ||
        next.tests ||
        next.checked.length
      ),
    );
  }
  async function run(command: WorkflowCommand) {
    if (pending.current || disabled) return;
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      await onAction(command);
      onDirtyChange(false);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  const noteAction = workflow.state === "awaiting_input" ? "resume" : action;
  const noteLabel =
    noteAction === "request_input"
      ? "Question for the owner"
      : noteAction === "resume"
        ? "Human decision"
        : noteAction === "approve"
          ? "Approval rationale"
          : "Changes required";
  const noteButton =
    noteAction === "resume"
      ? "Record decision and resume"
      : noteAction === "request_input"
        ? "Send question"
        : noteAction === "approve"
          ? "Approve and complete"
          : "Request changes";
  return (
    <section className="workflow-panel" aria-labelledby="workflow-heading">
      <div className="workflow-heading">
        <h3 id="workflow-heading">Work & handoffs</h3>
        <span className={`work-state state-${workflow.state}`}>
          {workStateLabel[workflow.state]}
        </span>
      </div>
      <p className="field-hint">
        Manually recorded workflow. No agent is connected or executed. Named
        roles are declared, not authenticated identities.
      </p>
      <dl className="role-grid">
        <div>
          <dt>Accountable owner · Human</dt>
          <dd>{card.owner || "Unassigned"}</dd>
        </div>
        <div>
          <dt>
            Assigned worker · {card.workerKind === "agent" ? "Agent" : "Human"}
          </dt>
          <dd>{card.worker || "Unassigned"}</dd>
        </div>
        <div>
          <dt>Reviewer · Human</dt>
          <dd>{card.reviewer || "Unassigned"}</dd>
        </div>
      </dl>
      {workflow.attempt > 0 && (
        <p className="field-hint">
          Work attempt {workflow.attempt} ·{" "}
          {readOnly && simulatedNext
            ? simulatedNext
            : workflow.state === "awaiting_input"
              ? `Next: ${card.owner} records a decision`
              : workflow.state === "in_review"
                ? `Next: ${card.reviewer} reviews the evidence`
                : workflow.state === "approved"
                  ? "Phase review approved · use Handoff on the board to advance"
                  : `Next: ${card.worker} records progress or submits evidence`}
        </p>
      )}
      {workflow.question && (
        <div className="handoff-note">
          <strong>Question</strong>
          <p>{workflow.question}</p>
          {workflow.decision && (
            <>
              <strong>Human decision</strong>
              <p>{workflow.decision}</p>
            </>
          )}
        </div>
      )}
      {workflow.feedback && (
        <div className="handoff-note">
          <strong>
            {workflow.state === "approved"
              ? "Approval rationale"
              : "Reviewer feedback"}
          </strong>
          <p>{workflow.feedback}</p>
        </div>
      )}
      {workflow.evidence && (
        <details className="evidence" open={workflow.state === "in_review"}>
          <summary>
            {workflow.state === "working"
              ? "Previous submission"
              : "Submitted evidence"}
          </summary>
          <p>{workflow.evidence.summary}</p>
          <strong>Test evidence</strong>
          <p>{workflow.evidence.tests}</p>
          <ul>
            {workflow.evidence.criteria.map((item, index) => (
              <li key={index}>
                {item.checked ? "✓" : "○"} {item.text}
              </li>
            ))}
          </ul>
          {workflow.evidence.links.map((link, index) => (
            <a
              className="reference-link"
              key={index}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link} ↗
            </a>
          ))}
        </details>
      )}
      {!readOnly && (
        <fieldset disabled={busy || disabled} className="workflow-controls">
          {workflow.state === "idle" && card.status !== "Complete" && (
            <>
              <p className="field-hint">
                Set all three roles, objective, acceptance criteria and Stop
                Condition before starting.
              </p>
              <button type="button" onClick={() => void run({ type: "start" })}>
                Record work started
              </button>
            </>
          )}
          {workflow.state === "idle" && card.status === "Complete" && (
            <p className="field-hint">
              Phase workflow complete. See activity history for recorded reviews and handoffs.
            </p>
          )}
          {workflow.state === "working" && !action && (
            <div className="workflow-buttons">
              <button type="button" onClick={() => setAction("request_input")}>
                Request human input
              </button>
              <button type="button" onClick={() => setAction("submit_review")}>
                Prepare review
              </button>
            </div>
          )}
          {workflow.state === "in_review" && !action && (
            <div className="workflow-buttons">
              <button
                type="button"
                onClick={() => setAction("request_changes")}
              >
                Request changes
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => setAction("approve")}
              >
                Approve work
              </button>
            </div>
          )}
          {action === "submit_review" ? (
            <div className="workflow-form">
              <label>
                Change summary
                <textarea
                  aria-label="Change summary"
                  value={summary}
                  maxLength={2000}
                  onChange={(e) => {
                    setSummary(e.target.value);
                    change({ summary: e.target.value });
                  }}
                />
              </label>
              <label>
                Output links
                <textarea
                  aria-label="Output links"
                  value={links}
                  maxLength={20000}
                  onChange={(e) => {
                    setLinks(e.target.value);
                    change({ links: e.target.value });
                  }}
                  placeholder="One full https:// URL per line — PR, diff or decision record"
                />
              </label>
              <label>
                Test evidence
                <textarea
                  aria-label="Test evidence"
                  value={tests}
                  maxLength={2000}
                  onChange={(e) => {
                    setTests(e.target.value);
                    change({ tests: e.target.value });
                  }}
                  placeholder="Commands, results and evidence links. State any limitations."
                />
              </label>
              <fieldset className="criteria-checks">
                <legend>Acceptance checks</legend>
                {criteria.map((criterion, index) => (
                  <label key={index}>
                    <input
                      type="checkbox"
                      checked={checked.includes(index)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...checked, index]
                          : checked.filter((i) => i !== index);
                        setChecked(next);
                        change({ checked: next });
                      }}
                    />
                    {criterion}
                  </label>
                ))}
              </fieldset>
              <button
                type="button"
                className="primary"
                onClick={() =>
                  void run({
                    type: "submit_review",
                    evidence: {
                      summary,
                      links: links
                        .split("\n")
                        .map((link) => link.trim())
                        .filter(Boolean),
                      tests,
                      criteria: criteria.map((text, index) => ({
                        text,
                        checked: checked.includes(index),
                      })),
                    },
                  })
                }
              >
                Submit for review
              </button>
            </div>
          ) : (
            noteAction &&
            noteAction !== "submit_review" && (
              <div className="workflow-form">
                <label>
                  {noteLabel}
                  <textarea
                    aria-label={noteLabel}
                    value={note}
                    maxLength={2000}
                    onChange={(e) => {
                      setNote(e.target.value);
                      change({ note: e.target.value });
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="primary"
                  onClick={() => void run({ type: noteAction, note })}
                >
                  {noteButton}
                </button>
              </div>
            )
          )}
          {(action ||
            note ||
            summary ||
            links ||
            tests ||
            checked.length > 0) && (
            <button
              type="button"
              className="workflow-cancel"
              onClick={() => {
                if (
                  (note || summary || links || tests || checked.length) &&
                  !window.confirm("Discard this unsaved workflow entry?")
                )
                  return;
                setAction(null);
                setNote("");
                setSummary("");
                setLinks("");
                setTests("");
                setChecked([]);
                onDirtyChange(false);
                setError("");
              }}
            >
              Cancel workflow entry
            </button>
          )}
        </fieldset>
      )}
      {busy && <p role="status">Saving workflow…</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {disabled && (
        <p className="field-hint">
          Load the latest card before recording a workflow action.
        </p>
      )}
    </section>
  );
}
