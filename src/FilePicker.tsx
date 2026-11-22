import { useEffect, useRef, useState } from 'react';
import { FiChevronDown, FiEdit2, FiLock, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useCadStore } from './store.ts';
import { MAIN_FILE } from './script-files.ts';

export default function FilePicker() {
  const { files, activeFile, selectFile, addFile, renameFile, deleteFile } = useCadStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const submit = async () => {
    setLoading(true); setError('');
    try {
      if (renaming) renameFile(renaming, input);
      else await addFile(input);
      setInput(''); setRenaming(null);
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  };
  return <div className="file-picker" ref={root}>
    <button ref={trigger} type="button" className="file-trigger" aria-label={`Script files: ${activeFile}`} aria-expanded={open} aria-controls="script-files"
      onClick={() => { setOpen(!open); setError(''); }} title={activeFile}>
      <span className="js-label">JS</span><span className="file-name">{activeFile}</span>
      {files.find(file => file.name === activeFile)?.url && <FiLock aria-label="Read only" />}<FiChevronDown aria-hidden="true" />
    </button>
    {open && <div className="file-dropdown" id="script-files" aria-label="Script files">
      <div className="file-list">
        {files.map(file => <div className={`file-row${file.name === activeFile ? ' file-active' : ''}`} key={file.name}>
          <button className="file-select" type="button" aria-current={file.name === activeFile ? 'true' : undefined} title={file.name}
            onClick={() => { selectFile(file.name); setOpen(false); }}>
            <span className="file-name">{file.name}</span>
            {file.name === MAIN_FILE ? <span className="file-badge">Main</span> : file.url && <FiLock aria-label="Read only" />}
          </button>
          {file.name !== MAIN_FILE && <>
            {!file.url && <button className="file-action" type="button" aria-label={`Rename ${file.name}`} title="Rename file" onClick={() => {
              setRenaming(file.name); setInput(file.name); setError(''); field.current?.focus();
            }}><FiEdit2 /></button>}
            <button className="file-action" type="button" aria-label={`Delete ${file.name}`} title="Delete file" onClick={() => {
              deleteFile(file.name); if (renaming === file.name) { setRenaming(null); setInput(''); }
            }}><FiTrash2 /></button>
          </>}
        </div>)}
      </div>
      <form className="file-add" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label className="sr-only" htmlFor="script-filename">{renaming ? 'New filename' : 'Filename or URL'}</label>
        <input ref={field} id="script-filename" value={input} onChange={event => setInput(event.target.value)} placeholder={renaming ? 'New filename' : 'Filename or https://…'} disabled={loading} autoComplete="off" />
        <button type="submit" disabled={loading || !input.trim()} aria-label={renaming ? 'Save filename' : 'Add file'}>
          {!renaming && <FiPlus aria-hidden="true" />}{loading ? 'Loading…' : renaming ? 'Save' : 'Add'}
        </button>
      </form>
      {renaming && <button type="button" className="file-cancel" onClick={() => { setRenaming(null); setInput(''); setError(''); }}>Cancel rename</button>}
      {error && <div className="file-error" role="alert">{error}</div>}
    </div>}
  </div>;
}
