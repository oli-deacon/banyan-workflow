import { Fragment, useEffect, useRef, type ReactNode } from "react";

// Render the small Markdown vocabulary used by our repository specifications.
// All content stays React text; embedded HTML is never executed.
function inline(text: string, onSelect: (agent: string) => void): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    if (part.startsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const role = link[2] === "README.md" ? "shared" : link[2].match(/^(pm|architect|developer|quality|verifier)-agent\.md$/)?.[0].replace(".md", "");
      if (role) return <button className="agent-link" type="button" key={index} onClick={() => onSelect(role)}>{link[1]}</button>;
      if (/^https?:\/\//.test(link[2])) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
      return <span key={index}>{link[1]}</span>;
    }
    return part;
  });
}

function SpecificationContent({ source, onSelect }: { source: string; onSelect: (agent: string) => void }) {
  const blocks = source.trim().split(/\n\s*\n/);
  return blocks.map((block, index) => {
    if (block.startsWith("# ")) return null; // The panel header supplies the title.
    if (block.startsWith("## ")) return <h3 key={index}>{block.slice(3)}</h3>;
    const lines = block.split("\n");
    if (lines.length > 1 && lines[0].startsWith("|")) {
      const rows = lines.filter(line => !/^\|[\s:|\-]+\|$/.test(line)).map(line => line.slice(1, -1).split("|").map(cell => cell.trim()));
      return <div className="spec-table" tabIndex={0} role="region" aria-label={rows[0].join(", ")} key={index}>
        <table><thead><tr>{rows[0].map((cell, i) => <th scope="col" key={i}>{inline(cell, onSelect)}</th>)}</tr></thead>
          <tbody>{rows.slice(1).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{inline(cell, onSelect)}</td>)}</tr>)}</tbody>
        </table>
      </div>;
    }
    if (lines.every(line => /^- /.test(line))) return <ul key={index}>{lines.map((line, i) => <li key={i}>{inline(line.slice(2), onSelect)}</li>)}</ul>;
    if (lines.every(line => /^\d+\. /.test(line))) return <ol key={index}>{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\d+\. /, ""), onSelect)}</li>)}</ol>;
    return <p key={index}>{lines.map((line, i) => <Fragment key={i}>{i > 0 && (lines[i - 1].endsWith("  ") ? <br /> : " ")}{inline(line.trim(), onSelect)}</Fragment>)}</p>;
  });
}

export function AgentSpecification({ selected, specifications, onSelect, onClose }: {
  selected: string;
  specifications: Record<string, string>;
  onSelect: (agent: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { node.close(); document.body.style.overflow = overflow; };
  }, []);
  useEffect(() => {
    heading.current?.focus();
    if (body.current) body.current.scrollTop = 0;
  }, [selected]);
  return <dialog ref={dialog} className="detail-panel agent-specification" aria-labelledby="agent-spec-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="detail-header">
      <div><p className="eyebrow">{selected === "shared" ? "SHARED CONTRACT" : "AGENT SPECIFICATION"}</p>
        <h2 id="agent-spec-title" ref={heading} tabIndex={-1}>{selected === "shared" ? "Phase ownership & handoffs" : selected}</h2>
      </div>
      <button type="button" aria-label="Close agent specification" onClick={onClose}>✕</button>
    </header>
    <nav className="spec-navigation" aria-label="Agent specifications">
      {Object.keys(specifications).map(agent => <button type="button" key={agent} aria-current={selected === agent ? "page" : undefined}
        onClick={() => onSelect(agent)}>{agent === "shared" ? "Shared handoff contract" : agent}</button>)}
    </nav>
    <div className="spec-body" ref={body}>
      <SpecificationContent source={specifications[selected]} onSelect={onSelect} />
    </div>
  </dialog>;
}
