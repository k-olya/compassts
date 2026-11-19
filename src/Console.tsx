import { useEffect, useRef } from "react";
import { FiX } from "react-icons/fi";
import { useCadStore } from "./store.ts";
import type { ScriptLocation } from "./script-console.ts";

export default function Console({ onNavigate }: { onNavigate: (location: ScriptLocation) => void }) {
  const entries = useCadStore(state => state.consoleEntries);
  const open = useCadStore(state => state.consoleOpen);
  const close = useCadStore(state => state.closeConsole);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);

  useEffect(() => {
    if (!open || !entries.length) follow.current = true;
    if (follow.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [entries, open]);

  const locationLink = (location: ScriptLocation, key?: number) => (
    <a key={key} className="console-location" href="#code-pane" title={`Go to line ${location.line}, column ${location.column}`}
      onClick={event => { event.preventDefault(); onNavigate(location); }}>
      model.js:{location.line}:{location.column}
    </a>
  );

  if (!open) return null;

  return (
    <section className="script-console" aria-label="Script console">
      <div className="console-header">
        <span>Console <span className="console-caption">Current run</span></span>
        <button type="button" onClick={close} aria-label="Close console" title="Close console"><FiX aria-hidden="true" /></button>
      </div>
      <div className="console-output" ref={scroll} role="log" aria-label="Console output" tabIndex={0}
        onScroll={() => { const host = scroll.current!; follow.current = host.scrollHeight - host.scrollTop - host.clientHeight < 24; }}>
        {entries.map((entry, index) => (
          <div className={`console-entry console-${entry.level}`} key={index} role={entry.level === "error" ? "alert" : undefined}>
            <span className="console-level">{entry.level}</span>
            <div className="console-message"><pre>{entry.text}</pre>{entry.stack && <pre className="console-stack">{
              entry.stack.split(/(model\.js:\d+:\d+)/g).map((part, index) => {
                const match = part.match(/^model\.js:(\d+):(\d+)$/);
                return match ? locationLink({ line: Number(match[1]), column: Number(match[2]) }, index) : part;
              })
            }</pre>}</div>
            {entry.location && locationLink(entry.location)}
          </div>
        ))}
      </div>
    </section>
  );
}
