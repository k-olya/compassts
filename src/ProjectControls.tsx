import { useCallback, useEffect, useRef, useState } from 'react';
import { FiFolder, FiSave } from 'react-icons/fi';
import { projectUrl, writeProject } from './project-archive.ts';
import { useCadStore } from './store.ts';

export default function ProjectControls() {
  const { projectName, setProjectName, files, loadProject } = useCadStore();
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opening = useRef(false);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [requestedUrl, setRequestedUrl] = useState(() => new URLSearchParams(window.location.search).get('url'));
  let remoteUrl: URL | undefined, urlError = '';
  if (requestedUrl !== null) {
    try { remoteUrl = projectUrl(requestedUrl); }
    catch (error) { urlError = error instanceof Error ? error.message : String(error); }
  }
  useEffect(() => {
    const modal = dialog.current;
    if (requestedUrl !== null && modal && !modal.open) {
      modal.showModal(); modal.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }, [requestedUrl]);
  const dismiss = () => { dialog.current?.close(); setRequestedUrl(null); };
  const open = useCallback(async (file: File | string) => {
    if (opening.current) return;
    opening.current = true; setLoading(true); setError('');
    try {
      await loadProject(file);
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { opening.current = false; setLoading(false); }
  }, [loadProject]);

  useEffect(() => {
    let depth = 0;
    const isFile = (event: DragEvent) => event.dataTransfer?.types.includes('Files');
    const enter = (event: DragEvent) => { if (isFile(event) && !dialog.current?.open) { event.preventDefault(); depth++; setDragging(true); } };
    const leave = (event: DragEvent) => { if (isFile(event) && --depth <= 0) { depth = 0; setDragging(false); } };
    const over = (event: DragEvent) => { if (isFile(event)) { event.preventDefault(); event.dataTransfer!.dropEffect = 'copy'; } };
    const drop = (event: DragEvent) => {
      if (!isFile(event)) return;
      event.preventDefault(); event.stopPropagation(); depth = 0; setDragging(false);
      if (dialog.current?.open) return;
      const files = event.dataTransfer!.files;
      if (files.length !== 1) setError('Drop one .cts or .js project file at a time.');
      else void open(files[0]);
    };
    window.addEventListener('dragenter', enter, true);
    window.addEventListener('dragleave', leave, true);
    window.addEventListener('dragover', over, true);
    window.addEventListener('drop', drop, true);
    return () => {
      window.removeEventListener('dragenter', enter, true);
      window.removeEventListener('dragleave', leave, true);
      window.removeEventListener('dragover', over, true);
      window.removeEventListener('drop', drop, true);
    };
  }, [open]);

  const save = () => {
    setError('');
    try {
      const url = URL.createObjectURL(new Blob([writeProject(projectName, files)], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url;
      const name = projectName.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\.cts$/i, '') || 'Untitled';
      link.download = `${name}.cts`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
  };

  return <div className="project-controls" aria-busy={loading}>
    <input className="project-name" aria-label="Project name" placeholder="Code-based CAD" value={projectName} disabled={loading}
      onChange={event => setProjectName(event.target.value)} onBlur={() => setProjectName(projectName.trim())}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
    <button type="button" className="project-action" aria-label="Save project" title="Save project (.cts)" disabled={loading} onClick={save}><FiSave aria-hidden="true" /></button>
    <button type="button" className="project-action" aria-label="Load project" title="Load project (.cts or .js), or drop a file here" disabled={loading} onClick={() => input.current?.click()}><FiFolder aria-hidden="true" /></button>
    <input ref={input} type="file" accept=".cts,.js" hidden aria-label="Project file" onChange={event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
      if (file) void open(file);
    }} />
    {loading && <span className="project-loading" role="status">Loading…</span>}
    {error && <div className="project-error" role="alert">{error}</div>}
    {dragging && <div className="project-drop-hint">Drop a .cts or .js project to open</div>}
    <dialog ref={dialog} className="project-dialog" aria-labelledby="web-project-title" aria-describedby="web-project-description" onCancel={() => setRequestedUrl(null)}>
      <h2 id="web-project-title">Do you trust this project URL?</h2>
      <p id="web-project-description">Only load projects from sources you trust. Project scripts can access this page when you press Render.</p>
      <p className="project-source">{remoteUrl ? <a href={remoteUrl.href} target="_blank" rel="noopener noreferrer">{requestedUrl}</a> : requestedUrl}</p>
      {urlError && <p className="project-url-error" role="alert">{urlError}</p>}
      <div className="project-dialog-actions">
        <button type="button" className="export-button" onClick={dismiss}>Cancel</button>
        <button type="button" className="render-button" disabled={!remoteUrl} onClick={() => {
          if (!remoteUrl) return;
          const url = remoteUrl.href; dismiss(); void open(url);
        }}>Trust and load</button>
      </div>
    </dialog>
  </div>;
}
