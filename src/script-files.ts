/** Editable project file, or a read-only HTTP(S) source. */
export interface ScriptFile {
  name: string;
  source: string;
  /** Effective URL after redirects; also identifies a read-only file. */
  url?: string;
}

export const MAIN_FILE = 'model.js';

export function scriptName(input: string): string {
  const value = input.trim();
  if (!value) throw new Error('Enter a filename or an HTTP(S) URL.');
  if (/^https?:\/\//i.test(value)) return new URL(value).href;
  if (/[:?#\\\u0000-\u001f]/.test(value) || value.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Use a relative filename, or an HTTP(S) URL.');
  }
  return /\.js$/i.test(value) ? value : `${value}.js`;
}

export async function fetchScriptFile(url: string, signal?: AbortSignal): Promise<ScriptFile> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not load ${url}: HTTP ${response.status}`);
  return { name: url, url: response.url || url, source: await response.text() };
}

export function projectSource(files: readonly ScriptFile[]): string {
  return JSON.stringify(files.map(file => [file.name, file.source, file.url]));
}

export function resolveScript(specifier: string, from: ScriptFile, files: ReadonlyMap<string, ScriptFile>): string {
  if (specifier === 'libcompass' || specifier === 'gl-matrix') return specifier;
  if (/^https?:\/\//i.test(specifier)) return new URL(specifier).href;
  if (from.url && /^(?:\.{1,2}\/|\/)/.test(specifier)) return new URL(specifier, from.url).href;
  const path = decodeURIComponent(new URL(specifier, `file:///${from.name.split('/').map(encodeURIComponent).join('/')}`).pathname.slice(1));
  for (const candidate of [specifier, path, `${path}.js`]) if (files.has(candidate)) return candidate;
  throw new Error(`Cannot resolve "${specifier}" from ${from.name}`);
}
