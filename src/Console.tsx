import { useEffect, useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import { OverlayScrollbarsComponent, type OverlayScrollbarsComponentRef } from "overlayscrollbars-react";
import { useCadStore } from "./store.ts";
import type { ScriptLocation } from "./script-console.ts";
import { consoleProperties, consoleValueText, isInspectable, type ConsoleProperty } from "./console-values.ts";

function ConsoleValue({ value, ancestors = [], nested = false }: { value: unknown; ancestors?: object[]; nested?: boolean }) {
  const [properties, setProperties] = useState<ConsoleProperty[] | null>(null);
  if (!isInspectable(value)) return <span className={`console-value console-value-${typeof value}`}>{consoleValueText(value, nested)}</span>;
  if (ancestors.includes(value)) return <span className="console-muted">[Circular]</span>;
  return (
    <details className="console-object" onToggle={event => setProperties(event.currentTarget.open ? consoleProperties(value) : null)}>
      <summary title="Expand to inspect current properties">{consoleValueText(value)}</summary>
      {properties && <div className="console-properties">
        {properties.length ? properties.map((property, index) => (
          <div className="console-property" key={index}>
            <span className="console-property-key">{property.key}{property.key && ": "}</span>
            {property.text !== undefined ? <span className="console-muted">{property.text}</span>
              : <ConsoleValue value={property.value} ancestors={[...ancestors, value]} nested />}
          </div>
        )) : <span className="console-muted">No own properties</span>}
      </div>}
    </details>
  );
}

export default function Console({ onNavigate }: { onNavigate: (location: ScriptLocation) => void }) {
  const entries = useCadStore(state => state.consoleEntries);
  const open = useCadStore(state => state.consoleOpen);
  const close = useCadStore(state => state.closeConsole);
  const scroll = useRef<OverlayScrollbarsComponentRef>(null);
  const follow = useRef(true);

  useEffect(() => {
    if (!open || !entries.length) follow.current = true;
    const viewport = scroll.current?.osInstance()?.elements().viewport;
    if (follow.current && viewport) viewport.scrollTop = viewport.scrollHeight;
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
      <OverlayScrollbarsComponent className="console-output" ref={scroll} role="log" aria-label="Console output"
        options={{ overflow: { x: "scroll", y: "scroll" }, scrollbars: { theme: "os-theme-compass", autoHide: "leave" } }}
        events={{
          initialized: instance => {
            const { viewport } = instance.elements();
            viewport.tabIndex = 0;
            viewport.setAttribute("aria-label", "Console output");
            if (follow.current) viewport.scrollTop = viewport.scrollHeight;
          },
          scroll: instance => {
            const { viewport } = instance.elements();
            follow.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 24;
          },
        }} defer>
        {entries.map(entry => (
          <div className={`console-entry console-${entry.level}`} key={entry.id} role={entry.level === "error" ? "alert" : undefined}>
            <span className="console-level">{entry.level}</span>
            <div className="console-message">
              {entry.parts ? <div className="console-parts">{entry.parts.map((part, index) => "text" in part
                ? <span key={index}>{part.text}</span> : <ConsoleValue key={index} value={part.value} />)}</div> : <pre>{entry.text}</pre>}
              {entry.stack && <pre className="console-stack">{
              entry.stack.split(/(model\.js:\d+:\d+)/g).map((part, index) => {
                const match = part.match(/^model\.js:(\d+):(\d+)$/);
                return match ? locationLink({ line: Number(match[1]), column: Number(match[2]) }, index) : part;
              })
            }</pre>}</div>
            {entry.location && locationLink(entry.location)}
          </div>
        ))}
      </OverlayScrollbarsComponent>
    </section>
  );
}
