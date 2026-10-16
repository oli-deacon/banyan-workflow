"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { STATUSES } from "@/lib/board";
import {
  advanceDemoStep,
  demoCard,
  demoSteps,
  demoHandoff,
} from "@/lib/demo-scenario";
import { WorkflowPanel } from "../components/workflow-panel";
import { ActivityTimeline } from "../components/activity-timeline";

export default function Demo() {
  const [card, setCard] = useState(demoCard);
  const button = useRef<HTMLButtonElement>(null);
  const step = card.version - 1;
  const next = demoSteps[step];
  return (
    <main className="guided-demo">
      <header className="topbar">
        <Link className="brand" href="/">
          banyan <span className="brand-sub">/ guided demo</span>
        </Link>
        <Link className="button-link" href="/">
          Back to shared board
        </Link>
      </header>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">HUMANS + AGENTS</p>
          <h1>One task. A complete handoff.</h1>
        </div>
        <button
          onClick={() => {
            if (
              step &&
              !window.confirm(
                "Restart this simulation? The shared board is untouched.",
              )
            )
              return;
            setCard(demoCard());
            requestAnimationFrame(() => button.current?.focus());
          }}
        >
          Restart simulation
        </button>
      </div>
      <ol className="demo-stages" aria-label="Workflow stages">
        {STATUSES.map((status) => (
          <li
            key={status}
            aria-current={card.status === status ? "step" : undefined}
          >
            {status}
          </li>
        ))}
      </ol>
      <div className="demo-layout">
        <aside className="demo-guide">
          <div aria-live="polite" aria-atomic="true">
            <p className="eyebrow">
              {next
                ? `STEP ${step + 1} OF ${demoSteps.length}`
                : "WALKTHROUGH COMPLETE"}
            </p>
            <h2>{next?.title ?? "Phase review approved"}</h2>
            <p>
              {next?.explanation ??
                "Alex owns the outcome, Config Agent develops the change, Flanders reviews and auto-fixes first, and Sam makes the final human review decision. The timeline retains every question, decision and submission. This walkthrough stays within Transform; use the board’s Handoff action to advance a phase."}
            </p>
          </div>
          {next && (
            <button
              ref={button}
              className="primary"
              onClick={() =>
                setCard((current) => {
                  const step = demoSteps[current.version - 1];
                  return step ? advanceDemoStep(current, step) : current;
                })
              }
            >
              {next.button}
            </button>
          )}
          <ol className="demo-step-list">
            {demoSteps.map((item, i) => (
              <li key={item.title} className={i < step ? "step-complete" : ""}>
                {i < step ? "✓ " : `${i + 1}. `}
                {item.title}
              </li>
            ))}
          </ol>
        </aside>
        <article className="demo-work-item">
          <p className="eyebrow">FICTIONAL WORK ITEM</p>
          <h2>{card.title}</h2>
          <p>{card.objective}</p>
          <details className="demo-brief">
            <summary>Task brief & Stop Condition</summary>
            <h3>Constraints</h3>
            <p>{card.constraints}</p>
            <h3>Acceptance criteria</h3>
            <p>{card.acceptance}</p>
            <h3>Stop Condition</h3>
            <p>{card.stopCondition}</p>
          </details>
          <p className="handoff-note">
            <strong>Review handoff</strong>
            <br />
            Config Agent → Flanders (Agent · first review & auto-fix) → Sam
            Example (Human · final review)
          </p>
          <WorkflowPanel
            card={card}
            readOnly
            simulatedNext={demoHandoff(card)}
            onAction={async () => {}}
            onBusyChange={() => {}}
            onDirtyChange={() => {}}
          />
          <ActivityTimeline
            activity={card.activity}
            now={new Date(card.updatedAt).getTime()}
            publicDemo={false}
            simulated
            expanded
          />
        </article>
      </div>
    </main>
  );
}
