"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { blankCard, STATUSES, type Card, type Status } from "@/lib/board";
import type { CardSummary, EditorCard } from "@/lib/card-types";
import { useBoard } from "@/lib/client/use-board";
import { useCardGlow } from "@/lib/client/use-card-glow";
import { CardEditor } from "./components/card-editor";

export default function Board() {
  const { trackGlow, resetGlow } = useCardGlow();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);
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
  } = useBoard(dragging);
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
            onClick={() => void move(undo.id, undo.status, undo.version)}
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
                      className={`card ${card.status === "Done" ? "card-complete" : ""} ${dragging === card.id ? "dragging" : ""} ${settled === card.id ? "settled" : ""}`}
                      key={card.id}
                      draggable={!busy}
                      onPointerEnter={trackGlow}
                      onPointerMove={trackGlow}
                      onPointerLeave={resetGlow}
                      onPointerCancel={resetGlow}
                      onDragStart={(event) => {
                        resetGlow();
                        event.dataTransfer.setData("text/plain", card.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDragging(card.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                    >
                      <span className="card-edge-light" aria-hidden="true" />
                      <button
                        className="card-open"
                        aria-busy={opening === card.id}
                        disabled={opening !== null}
                        onClick={() => void open(card)}
                      >
                        <span className="card-title">
                          {card.status === "Done" && (
                            <svg
                              className="card-completion-mark"
                              viewBox="0 0 20 20"
                              fill="none"
                              aria-hidden="true"
                            >
                              <circle
                                cx="10"
                                cy="10"
                                r="8"
                                fill="currentColor"
                                opacity="0.12"
                              />
                              <path
                                d="m6 10 2.5 2.5L14 7"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                          <span>{card.title}</span>
                        </span>
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
                          <svg
                            className="move-icon"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M4 12 12 4M4 4h8v8"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </label>
                      </footer>
                    </article>
                  ))}
                </div>
                {items.length === 0 && (
                  <div className="empty">
                    <Canopy />
                    <strong>
                      {
                        [
                          "Room for a new idea.",
                          "A little breathing room.",
                          "Ready when you are.",
                          "Good work will land here.",
                        ][index]
                      }
                    </strong>
                    <p>
                      {
                        [
                          "Capture a next step, however small.",
                          "Move a card here when work begins.",
                          "Bring finished work here for a second look.",
                          "Move reviewed, completed work here.",
                        ][index]
                      }
                    </p>
                  </div>
                )}
                <button
                  disabled={busy || opening !== null}
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

function Canopy() {
  return (
    <svg className="canopy" viewBox="0 0 48 40" fill="none" aria-hidden="true">
      <path
        d="M24 36V18M24 29L12 20M24 24L36 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M23 20C9 23 4 15 7 8c9-3 18 1 16 12ZM25 16C23 5 32 1 41 5c1 9-5 14-16 11Z"
        fill="currentColor"
        fillOpacity=".16"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
