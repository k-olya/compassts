import { useEffect, useState } from 'react';
import { hasUnrenderedChanges, useCadStore } from './store.ts';

export default function RenderStatus() {
  const rendering = useCadStore(state => state.rendering);
  const startedAt = useCadStore(state => state.renderStartedAt);
  const duration = useCadStore(state => state.renderDuration);
  const error = useCadStore(state => state.error);
  const changed = useCadStore(hasUnrenderedChanges);
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    if (startedAt === null) return;
    setNow(performance.now());
    const timer = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(timer);
  }, [startedAt]);
  const elapsed = rendering && startedAt !== null ? Math.max(0, now - startedAt) : duration;
  const status = rendering ? 'Rendering…' : error ? 'Render failed · Previous model retained' : changed ? 'Changes not rendered' : 'Rendered';
  return <span>{status}{elapsed !== null && elapsed > 1000 ? ` · ${(elapsed / 1000).toFixed(1)} s` : ''}</span>;
}
