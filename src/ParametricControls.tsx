import { useEffect, useId, useState } from "react";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import { hasUnrenderedChanges, useCadStore } from "./store.ts";
import type { ParametricControl } from "./parametric.ts";

function NumberEdit({ control, id }: { control: ParametricControl; id: string }) {
  const [draft, setDraft] = useState(String(control.value));
  useEffect(() => setDraft(String(control.value)), [control.value]);
  return <input id={id} type="number" min={control.min} max={control.max} step={control.step} value={draft}
    onChange={event => {
      setDraft(event.target.value);
      if (Number.isFinite(event.target.valueAsNumber)) useCadStore.getState().setParameter(control.name, event.target.valueAsNumber);
    }} onBlur={() => setDraft(String(control.value))} />;
}

export default function ParametricControls() {
  const controls = useCadStore(state => state.controls);
  const changed = useCadStore(hasUnrenderedChanges);
  const error = useCadStore(state => state.error);
  const rendering = useCadStore(state => state.rendering);
  const render = useCadStore(state => state.render);
  const setParameter = useCadStore(state => state.setParameter);
  const prefix = useId();
  if (!controls.length) return null;
  return <section id="parameters-widget" className="parametric-controls" aria-label="Parameters">
    <OverlayScrollbarsComponent className="parametric-body" options={{ scrollbars: { theme: "os-theme-compass", autoHide: "leave" } }} defer>
      {controls.map((control, index) => {
        const id = `${prefix}-${index}`;
        return <div className="parametric-row" key={control.name}>
          <label htmlFor={id} title={control.name}>{control.name}</label>
          {control.type === 'number' ? <div className="parametric-number">
            <input type="range" aria-label={`${control.name} slider`} min={control.min} max={control.max} step={control.step}
              value={control.value as number} disabled={control.min === control.max}
              onChange={event => setParameter(control.name, event.target.valueAsNumber)} />
            <NumberEdit control={control} id={id} />
          </div> : control.type === 'checkbox' ? <input id={id} type="checkbox" checked={control.value as boolean}
            onChange={event => setParameter(control.name, event.target.checked)} />
            : control.type === 'select' ? <select id={id} value={control.value as string} disabled={!control.options.length}
              onChange={event => setParameter(control.name, event.target.value)}>
              {!control.options.length && <option value="">No options</option>}
              {control.options.map(option => <option key={option} value={option}>{option}</option>)}
            </select> : <input id={id} type="text" value={control.value as string} onChange={event => setParameter(control.name, event.target.value)} />}
        </div>;
      })}
    </OverlayScrollbarsComponent>
    <div className="parametric-footer"><button type="button" className="render-button" onClick={render} disabled={rendering || (!changed && !error)}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11L13 8z" /></svg>{rendering ? 'Rendering…' : 'Render'}
    </button></div>
  </section>;
}
