import { useEffect, useRef, useState } from "react";
import { STATUSES, type Status } from "@/lib/board";
import { STAGES, transitionError } from "@/lib/workflow";
import type { RecordCard } from "@/lib/server/model";

export function HandoffDialog({ card, target, onClose, onApprove }: {
  card: RecordCard; target: Status; onClose: () => void;
  onApprove: () => Promise<boolean | undefined>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const returning = STATUSES.indexOf(target) < STATUSES.indexOf(card.status);
  const criteria = returning
    ? ["I have recorded the rework needed in Progress & blockers."]
    : STAGES[card.status].criteria;
  const error = transitionError(card, target);
  useEffect(() => {
    const node = dialog.current!;
    const opener = document.activeElement as HTMLElement;
    node.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { node.close(); document.body.style.overflow = overflow; opener?.focus(); };
  }, []);
  return (
    <dialog ref={dialog} className="handoff-dialog" aria-labelledby="handoff-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
      <form onSubmit={async event => {
        event.preventDefault();
        if (busy || error || checked.length !== criteria.length || failed) return;
        setBusy(true);
        const saved = await onApprove();
        if (saved) onClose();
        else { setFailed(true); setBusy(false); }
      }}>
        <p className="eyebrow">{returning ? "RETURN FOR REWORK" : "HUMAN APPROVAL"}</p>
        <h2 id="handoff-title">{card.status} → {target}</h2>
        <p>{card.title}</p>
        <p className="handoff-help">Lead: {STAGES[card.status].leadAgent || "Accepted"}{STAGES[card.status].support.length > 0 ? ` · Support: ${STAGES[card.status].support.join(", ")}` : ""}</p>
        <p className="handoff-help">Review the evidence, then confirm each criterion. This approval moves the card and records the change in its activity history.</p>
        {!returning && <p className="stage-exit"><strong>Exit condition:</strong> {STAGES[card.status].exit}</p>}
        <div className="handoff-evidence">
          {(["objective", "context", "constraints", "acceptance", "references", "outputs", "progress"] as const).map(field => card[field] && (
            <details key={field} open={field === "outputs" || field === "progress"}>
              <summary>{field === "progress" ? "Progress & blockers" : field}</summary>
              <p>{card[field]}</p>
            </details>
          ))}
        </div>
        {error && <p className="warning" role="alert">{error} Close this review and resolve the requirement in the card first.</p>}
        {failed && <p className="warning" role="alert">The handoff could not be confirmed. Close this review, refresh the board and review the latest card before retrying.</p>}
        <fieldset disabled={busy || !!error || failed} className="handoff-checks">
          <legend>{returning ? "Rework confirmation" : "Handoff criteria"}</legend>
          {criteria.map((criterion, index) => (
            <label key={criterion}><input type="checkbox" checked={checked.includes(index)} onChange={event => setChecked(current => event.target.checked ? [...current, index] : current.filter(value => value !== index))} />{criterion}</label>
          ))}
        </fieldset>
        <footer className="handoff-actions">
          <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy || !!error || failed || checked.length !== criteria.length}>{busy ? "Saving…" : returning ? "Confirm return" : "Approve handoff"}</button>
        </footer>
      </form>
    </dialog>
  );
}
