import { consoleValueText } from "./console-values.ts";

export interface ScriptLocation {
  line: number;
  column: number;
}

export interface ConsoleEntry {
  id: number;
  level: "log" | "info" | "warn" | "error" | "debug";
  text: string;
  parts?: ConsolePart[];
  location?: ScriptLocation;
  stack?: string;
}

export type ConsolePart = { text: string } | { value: unknown };

let nextEntryId = 0;

export type ConsoleOutput = (entry: ConsoleEntry | null) => void;

// Function adds two lines; the strict directive and block add two more.
const SCRIPT_OFFSET = 4;

function scriptTrace(stack = "") {
  const frames = stack.split("\n").filter(line => /compass-script\.js:\d+:\d+/.test(line));
  const mapped = frames.map(frame => frame.replace(/compass-script\.js:(\d+):(\d+)/g,
    (_, line: string, column: string) => `model.js:${Math.max(1, Number(line) - SCRIPT_OFFSET)}:${column}`));
  const match = mapped[0]?.match(/model\.js:(\d+):(\d+)/);
  return {
    stack: mapped.join("\n").trim(),
    location: match ? { line: Number(match[1]), column: Number(match[2]) } : undefined,
  };
}

export function errorEntry(error: unknown, location?: ScriptLocation, context?: string): ConsoleEntry {
  const trace = scriptTrace(error instanceof Error ? error.stack : undefined);
  return {
    id: nextEntryId++,
    level: "error",
    text: `${context ? `${context}: ` : ""}${error instanceof Error ? error.toString() : String(error)}`,
    location: location ?? trace.location,
    stack: trace.stack || (location ? `at model.js:${location.line}:${location.column}` : error instanceof Error ? error.stack : undefined),
  };
}

function format(args: unknown[]): ConsolePart[] {
  const parts: ConsolePart[] = [];
  const rest = [...args];
  if (typeof rest[0] === "string") {
    const first = rest.shift() as string;
    let offset = 0;
    for (const match of first.matchAll(/%[%sdifoOc]/g)) {
      parts.push({ text: first.slice(offset, match.index) });
      const token = match[0];
      if (token === "%%" || !rest.length) parts.push({ text: token === "%%" ? "%" : token });
      else {
        const value = rest.shift();
        if (token === "%o" || token === "%O") parts.push({ value });
        else if (token !== "%c") parts.push({ text: token === "%d" || token === "%i" ? String(parseInt(String(value), 10))
          : token === "%f" ? String(parseFloat(String(value))) : consoleValueText(value) });
      }
      offset = match.index + token.length;
    }
    parts.push({ text: first.slice(offset) });
  }
  for (const value of rest) {
    if (parts.length) parts.push({ text: " " });
    parts.push(typeof value === "string" ? { text: value } : { value });
  }
  return parts;
}

export function createScriptConsole(output: ConsoleOutput): Console {
  const timers = new Map<string, number>();
  const counts = new Map<string, number>();
  let depth = 0;
  return new Proxy(console, {
    get(target, key: keyof Console) {
      const original = target[key];
      if (typeof original !== "function") return original;
      return (...args: unknown[]) => {
        Reflect.apply(original, target, args);
        if (key === "clear") { output(null); return; }
        if (key === "groupEnd") { depth = Math.max(0, depth - 1); return; }
        if (key === "assert") {
          if (args.shift()) return;
          args = ["Assertion failed:", ...args];
        }
        const label = ["time", "timeLog", "timeEnd", "count", "countReset"].includes(key) ? String(args[0] ?? "default") : "";
        if (key === "time") { timers.set(label, performance.now()); return; }
        if (key === "timeLog" || key === "timeEnd") {
          const start = timers.get(label);
          args = start === undefined ? [`Timer '${label}' does not exist`] : [`${label}: ${(performance.now() - start).toFixed(3)} ms`, ...args.slice(1)];
          if (key === "timeEnd") timers.delete(label);
        }
        if (key === "countReset") { counts.delete(label); return; }
        if (key === "count") {
          const count = (counts.get(label) ?? 0) + 1;
          counts.set(label, count);
          args = [`${label}: ${count}`];
        }
        if (["profile", "profileEnd", "timeStamp"].includes(key)) return;
        const trace = scriptTrace(new Error().stack);
        const level = key === "assert" || key === "error" ? "error"
          : key === "warn" ? "warn" : key === "info" ? "info" : key === "debug" || key === "trace" ? "debug" : "log";
        const error = args.find(value => value instanceof Error);
        const parts: ConsolePart[] = [{ text: "  ".repeat(depth) }, ...format(args)];
        output({ id: nextEntryId++, level, parts,
          text: parts.map(part => "text" in part ? part.text : consoleValueText(part.value)).join(""), location: trace.location,
          stack: key === "trace" ? trace.stack : error instanceof Error ? scriptTrace(error.stack).stack : undefined });
        if (key === "group" || key === "groupCollapsed") depth++;
      };
    },
  });
}
