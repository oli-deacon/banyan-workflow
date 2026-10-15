"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { blankCard, STATUSES, type Card, type Status } from "@/lib/board";
import type { CardSummary, EditorCard } from "@/lib/card-types";
import { useBoard } from "@/lib/client/use-board";
import { STAGES, nextStage } from "@/lib/workflow";
import type { RecordCard } from "@/lib/server/model";
import { HandoffDialog } from "./handoff-dialog";
import { CardEditor } from "./card-editor";

import { AgentSpecification } from "./agent-specification";

export default function Board({ specifications }: { specifications: Record<string, string> }) {
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
    dismissNotice,
  } = useBoard(null);
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
            const items = cards.filter((card) => card.status === status);
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
                      className={`card ${settled === card.id ? "settled" : ""}`}
                      key={card.id}
                    >
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
                      <footer className="card-footer">
                        {!card.sample && (
                          <span className="sample-label">WORK ITEM</span>
                        )}
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
                {items.length === 0 && <p className="empty-column">No cards</p>}
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
