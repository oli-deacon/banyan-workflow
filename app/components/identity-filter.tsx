"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CardSummary } from "@/lib/card-types";

type Kind = "human" | "agent" | "mixed";
type Option = { name: string; kind: Kind };

export function identityOptions(
  cards: CardSummary[],
  field: "owner" | "worker" | "reviewer",
): Option[] {
  const names = new Map<string, Kind>();
  for (const card of cards) {
    const name = card[field];
    if (!name) continue;
    const kind =
      field === "worker" && card.workerKind === "agent" ? "agent" : "human";
    const previous = names.get(name);
    names.set(name, previous && previous !== kind ? "mixed" : kind);
  }
  return [...names]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, kind]) => ({ name, kind }));
}

export function IdentityFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: "Owner" | "Worker" | "Reviewer";
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    width: number;
    maxHeight: number;
  }>({
    left: 0,
    top: 0,
    width: 300,
    maxHeight: 300,
  });
  const matches = options.filter((option) =>
    option.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const entries = [{ name: "", kind: "human" as Kind }, ...matches];
  const current = Math.min(active, entries.length - 1);
  function close(restore = false) {
    setOpen(false);
    if (restore) trigger.current?.focus();
  }
  function choose(name: string) {
    onChange(name);
    close(true);
  }
  function show() {
    const rect = trigger.current!.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom - 18;
    const above = rect.top - 18;
    const desired = Math.min(360, (options.length + 1) * 48 + 100);
    const useBelow = below >= desired || below >= above;
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      ...(useBelow
        ? { top: rect.bottom + 6 }
        : { bottom: window.innerHeight - rect.top + 6 }),
      width,
      maxHeight: Math.min(360, useBelow ? below : above),
    });
    setQuery("");
    const selected = options.findIndex((option) => option.name === value);
    setActive(selected < 0 ? 0 : selected + 1);
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const reposition = (event: Event) => {
      if (
        event.type === "resize" ||
        !root.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);
  useEffect(() => {
    if (open)
      list.current?.children[current]?.scrollIntoView({ block: "nearest" });
  }, [current, open, query]);
  const allLabel = `All ${label.toLowerCase()}s`;
  return (
    <div
      className={`identity-filter ${value ? "is-active" : ""}`}
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        }
      }}
    >
      <button
        type="button"
        className="identity-trigger"
        ref={trigger}
        aria-label={`Filter by ${label.toLowerCase()}: ${value || "Anyone"}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-popup` : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) show();
          }
        }}
      >
        <span className="filter-role">{label}:</span>
        <span className="filter-value" title={value || "Anyone"}>
          {value || "Anyone"}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m3 4.5 3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {value && (
        <button
          type="button"
          className="identity-clear"
          aria-label={`Clear ${label.toLowerCase()} filter`}
          onClick={() => {
            onChange("");
            close(true);
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m3 3 6 6m0-6-6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
      {open && (
        <div
          id={`${id}-popup`}
          role="dialog"
          aria-label={`${label} filter`}
          className="identity-popup"
          style={position}
        >
          <label className="identity-search">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="6.5"
                cy="6.5"
                r="4"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="m10 10 3 3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <input
              ref={search}
              role="combobox"
              aria-label={`Search ${label.toLowerCase()}s`}
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-activedescendant={`${id}-option-${current}`}
              value={query}
              placeholder={`Search ${label.toLowerCase()}s…`}
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive(
                    (current +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      entries.length) %
                      entries.length,
                  );
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  choose(entries[current].name);
                }
              }}
            />
          </label>
          <ul
            ref={list}
            id={`${id}-list`}
            tabIndex={-1}
            role="listbox"
            aria-label={`${label} choices`}
          >
            {entries.map((option, index) => (
              <li
                key={option.name}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={value === option.name}
                className={current === index ? "is-highlighted" : ""}
                onPointerMove={() => setActive(index)}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(option.name)}
              >
                <span
                  className={`identity-avatar ${option.kind}`}
                  aria-hidden="true"
                >
                  {!option.name ? (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <circle
                        cx="7"
                        cy="7"
                        r="3"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M2 17v-2a5 5 0 0 1 10 0v2m1-13a3 3 0 0 1 0 6m2 2a4 4 0 0 1 3 4v1"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : option.kind !== "human" ? (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <rect
                        x="3"
                        y="6"
                        width="14"
                        height="11"
                        rx="3"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M10 3v3M7 10v2m6-2v2M8 14h4"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    option.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => Array.from(part)[0])
                      .join("")
                      .toUpperCase()
                  )}
                </span>
                <span className="identity-option-name">
                  {option.name || allLabel}
                </span>
                {option.name && (
                  <span className="identity-kind">
                    {option.kind === "mixed"
                      ? "Human / Agent"
                      : option.kind === "agent"
                        ? "Agent"
                        : "Human"}
                  </span>
                )}
                <span className="identity-check" aria-hidden="true">
                  {value === option.name && (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path
                        d="m3 8 3 3 7-7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="identity-result" role="status">
            {matches.length
              ? `${matches.length} ${matches.length === 1 ? "match" : "matches"}`
              : query.trim()
                ? "No matches. Try another name."
                : `No ${label.toLowerCase()}s assigned yet.`}
          </p>
        </div>
      )}
    </div>
  );
}
