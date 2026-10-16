"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { blankCard, STATUSES, type Card, type Status } from "@/lib/board";
import type { CardSummary, EditorCard } from "@/lib/card-types";
import { useBoard } from "@/lib/client/use-board";
import { useCardGlow } from "@/lib/client/use-card-glow";
import { needsAttention, type Attention } from "@/lib/attention";
import { IdentityFilter, identityOptions } from "./identity-filter";
import { workStateLabel, STAGES, nextStage } from "@/lib/workflow";
import type { RecordCard } from "@/lib/server/model";
import { HandoffDialog } from "./handoff-dialog";
import { CardEditor } from "./card-editor";

import { AgentSpecification } from "./agent-specification";

export default function Board({ specifications }: { specifications: Record<string, string> }) {
  const [ownerFilter, setOwnerFilter] = useState("");
  const [workerFilter, setWorkerFilter] = useState("");
  const [reviewerView, setReviewerView] = useState("");
  const [attention, setAttention] = useState<Attention>("all");
  const { trackGlow, resetGlow } = useCardGlow();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const agentOpener = useRef<HTMLButtonElement | null>(null);
  function agentButton(agent: string) {
    return <button type="button" className="agent-link" aria-label={`View ${agent} specification`}
      onClick={event => { agentOpener.current = event.currentTarget; setSelectedAgent(agent); }}>
      {agent}
    </button>;
  }
  const [handoff, setHandoff] = useState<{ card: RecordCard; target: Status } | null>(null);
  const [editor, setEditor] = useState<EditorCard | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState("");
  const openingRef = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const {
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
    now,
    refresh,
    save,
    move,
    getCard,
    act,
    dismissNotice,
  } = useBoard(null);
  const scoped = cards.filter(
    (card) =>
      (!ownerFilter || card.owner === ownerFilter) &&
      (!workerFilter || card.worker === workerFilter) &&
      (!reviewerView || card.reviewer === reviewerView),
  );
  const visible = scoped.filter((card) =>
    needsAttention(card, attention, reviewerView),
  );
  const filtered =
    !!ownerFilter || !!workerFilter || !!reviewerView || attention !== "all";
  async function review(id: string, target: Status) {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(id);
    setOpenError("");
    try {
      const card = await getCard(id);
      if (card.status !== target) setHandoff({ card, target });
    } catch (error) { setOpenError((error as Error).message); }
    finally { openingRef.current = false; setOpening(null); }
  }
  async function open(card: Card | CardSummary) {
    if (openingRef.current) return;
    opener.current = document.activeElement as HTMLElement;
    if (!("version" in card)) {
      setEditor({ ...card, id: card.id || crypto.randomUUID() });
      return;
    }
    openingRef.current = true;
    setOpening(card.id);
    setOpenError("");
    try {
      setEditor(await getCard(card.id));
    } catch (error) {
      setOpenError((error as Error).message);
    } finally {
      openingRef.current = false;
      setOpening(null);
    }
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
        <div className="workspace-actions">
          <Link className="button-link" href="/demo">Try the guided demo</Link>
          <button disabled={busy} onClick={() => void refresh()}>
            {busy ? "Working…" : "Refresh board"}
          </button>
          <button
            ref={newButton}
            className="primary"
            disabled={!ready || busy || opening !== null}
            onClick={() => open(blankCard())}
          >
            ＋ New card
          </button>
        </div>
      </section>
      <p className="workflow-intro">AI-DLC workflow · Human-approved handoffs</p>
      {(mode === "mongodb" || mode === "mock") && (
        <p className="storage-label">
          {mode === "mongodb"
            ? "MongoDB · local development access"
            : "MOCK MODE · memory only, resets on restart"}
        </p>
      )}
      {syncWarning && (
        <p className="warning" role="status">
          {syncWarning}
        </p>
      )}
      {mode === "public-demo" && (
        <p className="demo-notice">
          <strong>Public demo · Synthetic data only.</strong> Anyone can view
          and edit. No personal, customer or confidential information.
        </p>
      )}
      {ready && (
        <section className="attention-bar" aria-label="Work attention filters">
          <div className="attention-tabs">
            {(
              [
                ["all", "All work"],
                ["input", "Needs human input"],
                ["review", "Awaiting review"],
                ["mine", "Ready for my review"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={attention === value}
                disabled={value === "mine" && !reviewerView}
                onClick={() => setAttention(value)}
              >
                {label}{" "}
                <span>
                  {
                    scoped.filter((card) =>
                      needsAttention(card, value, reviewerView),
                    ).length
                  }
                </span>
              </button>
            ))}
          </div>
          <div className="filter-controls">
            <span className="filter-caption">Filter</span>
            <IdentityFilter
              label="Owner"
              value={ownerFilter}
              options={identityOptions(cards, "owner")}
              onChange={setOwnerFilter}
            />
            <IdentityFilter
              label="Worker"
              value={workerFilter}
              options={identityOptions(cards, "worker")}
              onChange={setWorkerFilter}
            />
            <IdentityFilter
              label="Reviewer"
              value={reviewerView}
              options={identityOptions(cards, "reviewer")}
              onChange={(value) => {
                setReviewerView(value);
                if (!value && attention === "mine") setAttention("all");
              }}
            />
            {filtered && (
              <button
                onClick={() => {
                  setOwnerFilter("");
                  setWorkerFilter("");
                  setReviewerView("");
                  setAttention("all");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          <p className="field-hint" role="status">
            Showing {visible.length} of {cards.length} cards.
          </p>
        </section>
      )}
      {[readWarning, writeWarning, openError].filter(Boolean).map((warning) => (
        <div key={warning} className="warning" role="alert">
          {warning}
        </div>
      ))}
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
            onClick={() => void move(undo.id, undo.status, undo.version, true)}
          >
            Undo
          </button>
        )}
        {notice && (
          <button aria-label="Dismiss notification" onClick={dismissNotice}>
            ✕
          </button>
        )}
      </div>
      {!ready ? (
        <p className="loading">
          {readWarning
            ? "The board could not load. Check the message above, then refresh."
            : "Loading your workspace…"}
        </p>
      ) : (
        <div className="board" aria-label="Workflow board">
          {STATUSES.map((status, index) => {
            const items = visible.filter((card) => card.status === status);
            return (
              <section
                key={status}
                aria-label={status}
                className={`column tone-${index}`}
              >
                <header className="column-heading">
                  <h2>
                    <span className="status-dot" aria-hidden="true">
                      {status === "Complete" ? "✓" : ""}
                    </span>
                    {status}
                  </h2>
                  <span className="count">{items.length}</span>
                </header>
                <div className="column-work">
                <div className="card-list">
                  {items.map((card) => (
                    <article
                      onPointerMove={trackGlow}
                      onPointerLeave={resetGlow}
                      className={`card ${card.status === "Complete" ? "card-complete" : ""} ${settled === card.id ? "settled" : ""}`}
                      key={card.id}
                    >
                      <span className="card-edge-light" aria-hidden="true" />
                      <button
                        className="card-open"
                        aria-busy={opening === card.id}
                        disabled={opening !== null}
                        onClick={() => void open(card)}
                      >
                        <span className="card-title">{card.title}</span>
                        <span className="card-summary">
                          {card.summary ||
                            "Add a summary to give this work context."}
                        </span>
                      </button>
                      {card.workState !== "idle" && (
                        <span
                          className={`work-state card-work-state state-${card.workState}`}
                        >
                          {workStateLabel[card.workState]}
                        </span>
                      )}
                      {(card.worker || card.reviewer) && (
                        <p className="card-roles">
                          {card.worker && (
                            <span>
                              {card.workerKind === "agent" ? "Agent" : "Human"}:{" "}
                              {card.worker}
                            </span>
                          )}
                          {card.reviewer && (
                            <span>Review: {card.reviewer}</span>
                          )}
                        </p>
                      )}
                      <footer className="card-footer">
                        <div className="card-meta">
                          {!card.sample && (
                            <span className="sample-label">WORK ITEM</span>
                          )}
                          <span className="card-owner">
                            <span className="owner-label">Owner</span>
                            <span
                              className="owner-name"
                              title={card.owner || "Unassigned"}
                            >
                              {card.owner || "Unassigned"}
                            </span>
                          </span>
                        </div>
                        <label className="move-control">
                          <span>Handoff</span>
                          <select
                            disabled={busy || opening !== null}
                            data-move-id={card.id}
                            aria-label={`Move ${card.title}`}
                            value={card.status}
                            onChange={(event) =>
                              review(card.id, event.target.value as Status)
                            }
                          >
                            {STATUSES.filter((_, targetIndex) => targetIndex <= index + 1).map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </select>
                          <span aria-hidden="true">↗</span>
                        </label>
                      </footer>
                    </article>
                  ))}
                </div>
                {items.length === 0 && <p className="empty-column">{filtered ? "No matching cards." : "No cards"}</p>}
                {status === "Discover" && <button
                  disabled={busy || opening !== null}
                  className="add-card"
                  onClick={() => open(blankCard())}
                >
                  ＋ Add card<span className="sr-only"> to {status}</span>
                </button>}
                </div>
                <div className="stage-contract">
                  <p className="stage-agents">
                    <strong>Lead:</strong> {STAGES[status].leadAgent ? agentButton(STAGES[status].leadAgent) : "No active agent"}
                    {STAGES[status].support.length > 0 && <><br /><strong>Support:</strong> {STAGES[status].support.map((agent, index) => <span key={agent}>{index > 0 && ", "}{agentButton(agent)}</span>)}</>}
                  </p>
                  {STAGES[status].exit && <p className="stage-exit"><strong>Exit:</strong> {STAGES[status].exit}</p>}
                  <details>
                    <summary>{status === "Complete" ? "Completion" : "AI contribution & handoff"}</summary>
                    <p>{STAGES[status].leads}</p>
                    <ul>{STAGES[status].criteria.map(criterion => <li key={criterion}>{criterion}</li>)}</ul>
                    {nextStage(status) && <p><strong>Trigger:</strong> human approval → {nextStage(status)}</p>}
                  </details>
                </div>
              </section>
            );
          })}
        </div>
      )}
      {selectedAgent && <AgentSpecification
        selected={selectedAgent}
        specifications={specifications}
        onSelect={setSelectedAgent}
        onClose={() => {
          setSelectedAgent(null);
          requestAnimationFrame(() => agentOpener.current?.focus());
        }}
      />}
      {handoff && <HandoffDialog card={handoff.card} target={handoff.target}
        onClose={() => {
          const id = handoff.card.id;
          setHandoff(null);
          requestAnimationFrame(() => document.querySelector<HTMLSelectElement>(`[data-move-id="${CSS.escape(id)}"]`)?.focus());
        }}
        onApprove={() => move(handoff.card.id, handoff.target, handoff.card.version)} />}
      {editor && (
        <CardEditor
          publicDemo={mode === "public-demo"}
          initial={editor}
          latest={cards.find((card) => card.id === editor.id)}
          now={now}
          onLoadLatest={getCard}
          onAction={act}
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
