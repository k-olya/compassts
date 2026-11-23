import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { fetchScriptFile, MAIN_FILE, scriptName, type ScriptFile } from './script-files.ts';

export const MAX_PROJECT_BYTES = 64 * 1024 * 1024;

export interface Project {
  name: string;
  files: ScriptFile[];
}

interface Manifest {
  name: string;
  files: { name: string; url?: string }[];
}

export function projectUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); }
  catch { throw new Error('Use an absolute HTTP(S) project URL.'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Use an absolute HTTP(S) project URL.');
  return url;
}

/** A .cts is a ZIP of editable scripts and an ordered manifest; URL sources stay external. */
export function writeProject(name: string, files: readonly ScriptFile[]) {
  const entries: Record<string, Uint8Array> = Object.create(null);
  for (const file of files) if (!file.url) entries[file.name] = strToU8(file.source);
  entries['project.json'] = strToU8(JSON.stringify({
    version: 1,
    name: name.trim() || 'Untitled',
    files: files.map(({ name, url }) => url ? { name, url } : { name }),
  }, null, 2));
  if (Object.values(entries).reduce((size, file) => size + file.byteLength, 0) > MAX_PROJECT_BYTES) {
    throw new Error('Project contents must be 64 MiB or smaller.');
  }
  const archive = zipSync(entries);
  if (archive.byteLength > MAX_PROJECT_BYTES) throw new Error('Project archives must be 64 MiB or smaller.');
  return archive;
}

/** Validate everything before fetching external scripts or replacing the current project. */
export async function readProject(data: Uint8Array, signal?: AbortSignal): Promise<Project> {
  if (data.byteLength > MAX_PROJECT_BYTES) throw new Error('Project archives must be 64 MiB or smaller.');
  let expanded = 0;
  const entries = unzipSync(data, { filter: file => {
    if (file.name !== 'project.json' && !/\.js$/i.test(file.name)) return false;
    expanded += file.originalSize;
    if (expanded > MAX_PROJECT_BYTES) throw new Error('Project contents must be 64 MiB or smaller.');
    return true;
  } });
  if (!Object.hasOwn(entries, 'project.json')) throw new Error('The archive is missing project.json.');
  const manifest = readManifest(JSON.parse(strFromU8(entries['project.json'])));
  for (const file of manifest.files) if (!file.url && !Object.hasOwn(entries, file.name)) throw new Error(`Missing script: ${file.name}`);
  return loadFiles(manifest, name => strFromU8(entries[name]), signal);
}

function readManifest(input: unknown): Manifest {
  const manifest = input as {
    version?: unknown; name?: unknown; files?: unknown;
  } | null;
  if (!manifest || manifest.version !== 1 || typeof manifest.name !== 'string' || !manifest.name.trim() || !Array.isArray(manifest.files)) {
    throw new Error('Invalid project.json: expected version 1, a project name and a file list.');
  }
  const names = new Set<string>();
  const files = manifest.files.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || !('name' in entry) || typeof entry.name !== 'string') {
      throw new Error('Every project file must have a name.');
    }
    const name = entry.name;
    if (scriptName(name) !== name || names.has(name)) throw new Error(`Invalid or duplicate project filename: ${name}`);
    names.add(name);
    if ('url' in entry) {
      if (typeof entry.url !== 'string' || !/^https?:\/\//i.test(name) || !/^https?:\/\//i.test(entry.url)) {
        throw new Error(`Invalid external script URL: ${name}`);
      }
      projectUrl(entry.url);
      return { name, url: entry.url };
    }
    if (/^https?:\/\//i.test(name)) throw new Error(`Missing external script URL: ${name}`);
    return { name };
  });
  const main = files.find(file => file.name === MAIN_FILE && !file.url);
  if (!main) throw new Error('A project must contain an editable model.js.');
  return { name: manifest.name.trim(), files };
}

async function loadFiles(manifest: Manifest, localSource: (name: string) => string | Promise<string>, signal?: AbortSignal): Promise<Project> {
  signal?.throwIfAborted();
  const loaded = await Promise.all(manifest.files.map(async file => file.url ? fetchScriptFile(file.name, signal)
    : { name: file.name, source: await localSource(file.name) }));
  return { name: manifest.name, files: [loaded.find(file => file.name === MAIN_FILE)!, ...loaded.filter(file => file.name !== MAIN_FILE)] };
}

/** Load a ZIP or a manifest, resolving editable scripts beside the final manifest URL. */
export async function readWebProject(input: string, signal?: AbortSignal): Promise<Project> {
  const url = projectUrl(input);
  const response = await fetch(url.href, { signal });
  if (!response.ok) throw new Error(`Could not load ${url.href}: HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > MAX_PROJECT_BYTES) throw new Error('Projects must be 64 MiB or smaller.');
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength > MAX_PROJECT_BYTES) throw new Error('Projects must be 64 MiB or smaller.');
  if (data[0] === 0x50 && data[1] === 0x4b) return readProject(data, signal);
  const manifest = readManifest(JSON.parse(strFromU8(data)));
  const base = projectUrl(response.url || url.href);
  let expanded = data.byteLength;
  return loadFiles(manifest, async name => {
    const file = await fetchScriptFile(new URL(name.split('/').map(encodeURIComponent).join('/'), base).href, signal);
    expanded += strToU8(file.source).byteLength;
    if (expanded > MAX_PROJECT_BYTES) throw new Error('Project contents must be 64 MiB or smaller.');
    return file.source;
  }, signal);
}
