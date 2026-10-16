"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { STATUSES } from "@/lib/board";
import { advanceDemoStep, demoHandoff } from "@/lib/demo-scenario";
import { PHASE_DEMO, phaseTransformSteps, phaseDemoCard, preparePhaseEvidence, approvePhaseHandoff } from "@/lib/phase-demo";
import { STAGES, nextStage } from "@/lib/workflow";
import { WorkflowPanel } from "../components/workflow-panel";
import { ActivityTimeline } from "../components/activity-timeline";
import { HandoffDialog } from "../components/handoff-dialog";

import { AgentSpecification } from "../components/agent-specification";

export default function Walkthrough({ specifications }: { specifications: Record<string, string> }) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const agentOpener = useRef<HTMLButtonElement | null>(null);
  function agentLink(agent: string) {
    return <button type="button" className="agent-link" aria-label={`View ${agent} specification`}
      onClick={event => { agentOpener.current = event.currentTarget; setSelectedAgent(agent); }}>{agent}</button>;
  }
  const [card, setCard] = useState(phaseDemoCard);
  const [prepared, setPrepared] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [transformStep, setTransformStep] = useState(0);
  const complete = card.status === "Complete";
  const phase = complete ? null : PHASE_DEMO[card.status as keyof typeof PHASE_DEMO];
  const stage = STAGES[card.status];
  const next = nextStage(card.status);
  const workStep = card.status === "Transform" ? phaseTransformSteps[transformStep] : undefined;
  function restart() {
    if ((prepared || card.version > 1) && !window.confirm("Restart this simulation? The shared board is untouched.")) return;
    setCard(phaseDemoCard()); setPrepared(false); setTransformStep(0);
  }
  return (
    <main className="guided-demo">
      <header className="topbar">
        <Link className="brand" href="/">banyan <span className="brand-sub">/ guided demo</span></Link>
        <Link className="button-link" href="/">Back to shared board</Link>
      </header>
      <div className="workspace-heading">
        <div><p className="eyebrow">HUMANS + AGENTS</p><h1>One unit. Six phases.</h1></div>
        <button onClick={restart}>Restart simulation</button>
      </div>
      <p className="demo-notice">Simulation · fictional data and evidence. No agent is connected or executed. Nothing is saved to the shared board, deployed or rolled back.</p>
      <ol className="demo-stages" aria-label="Workflow stages">
        {STATUSES.map((status, index) => <li key={status} aria-current={card.status === status ? "step" : undefined}>
          {index < STATUSES.indexOf(card.status) ? "✓ " : ""}{status}
        </li>)}
      </ol>
      <div className="demo-layout">
        <aside className="demo-guide">
          <div aria-live="polite" aria-atomic="true">
            <p className="eyebrow">{complete ? "WALKTHROUGH COMPLETE" : `PHASE ${STATUSES.indexOf(card.status) + 1} OF 6`}</p>
            <h2>{complete ? "Operationally accepted" : card.status}</h2>
            <p>{complete ? "Six human-approved handoffs are recorded below. The unit is Complete because operational acceptance and rollback readiness were reviewed. Future findings return to the relevant phase." : phase?.input}</p>
          </div>
          {phase && <>
            <h3>Agent contributions</h3>
            <ul className="demo-contributions">{phase.contributions.map(({ agent, work }) => <li key={agent}><strong>{agentLink(agent)}</strong><p>{work}</p></li>)}</ul>
            <h3>Exit condition</h3><p>{stage.exit}</p>
            <h3>Human decision</h3><p>{phase.decision}</p>
            <p className="field-hint">Next: {next}{next !== "Complete" && next ? <> · {agentLink(STAGES[next].leadAgent)}</> : " · operational acceptance"}</p>
          </>}
        </aside>
        <article className="demo-work-item">
          <p className="eyebrow">FICTIONAL WORK ITEM</p><h2>{card.title}</h2><p>{card.objective}</p>
          <details className="demo-brief"><summary>Task brief & Stop Condition</summary><h3>Constraints</h3><p>{card.constraints}</p><h3>Acceptance criteria</h3><p>{card.acceptance}</p><h3>Stop Condition</h3><p>{card.stopCondition}</p></details>
          {workStep && <section className="demo-transform">
            <p className="eyebrow">TRANSFORM · STEP {transformStep + 1} OF {phaseTransformSteps.length}</p>
            <h3>{workStep.title}</h3>
            <p>{workStep.explanation.replaceAll("Config Agent", "developer-agent")}</p>
            <p className="field-hint">This detailed example replays the clarification and Flanders review loop. The approved specification remains the authority for the local default.</p>
            <button className="primary" onClick={() => {
              setCard(current => advanceDemoStep(current, workStep));
              setTransformStep(current => current + 1);
            }}>{workStep.button}</button>
          </section>}
          {!complete && !prepared && !workStep && <button className="primary" onClick={() => { setCard(preparePhaseEvidence(card)); setPrepared(true); }}>Show {card.status} evidence</button>}
          {prepared && <section className="demo-evidence" aria-label="Phase evidence">
            <h3>Evidence for human review</h3><p>{card.outputs}</p>
            <p><strong>Reviewing human:</strong> {card.reviewer}</p>
            <p>Review each exit criterion before advancing. The agent’s output alone does not move the card.</p>
            <button className="primary" onClick={() => setReviewing(true)}>Review handoff to {next}</button>
          </section>}
          {card.status === "Transform" && <WorkflowPanel card={card} readOnly simulatedNext={demoHandoff(card)} onAction={async () => {}} onBusyChange={() => {}} onDirtyChange={() => {}} />}
          <ActivityTimeline activity={card.activity} now={new Date(card.updatedAt).getTime()} publicDemo={false} simulated expanded />
        </article>
      </div>
      {selectedAgent && <AgentSpecification selected={selectedAgent} specifications={specifications} onSelect={setSelectedAgent}
        onClose={() => {
          setSelectedAgent(null);
          requestAnimationFrame(() => agentOpener.current?.focus());
        }} />}
      {reviewing && next && <HandoffDialog card={card} target={next} onClose={() => setReviewing(false)} onApprove={async () => {
        setCard(approvePhaseHandoff(card, true)); setPrepared(false); setReviewing(false); return true;
      }} />}
    </main>
  );
}
