import { RemoteConsoleValue } from './remote-console.ts';

export function isInspectable(value: unknown): value is object {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

/** A compact label, without traversing objects or invoking their getters/toJSON. */
export function consoleValueText(value: unknown, quoteStrings = false): string {
  try {
    if (value instanceof RemoteConsoleValue) return value.label;
    if (typeof value === "string") return quoteStrings ? JSON.stringify(value) : value;
    if (typeof value === "bigint") return `${value}n`;
    if (typeof value === "function") return `ƒ ${value.name || "(anonymous)"}()`;
    if (!isInspectable(value)) return String(value);
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (value instanceof Error) return Error.prototype.toString.call(value);
    if (value instanceof Date) return Date.prototype.toString.call(value);
    if (value instanceof Map) return `Map(${value.size})`;
    if (value instanceof Set) return `Set(${value.size})`;
    const prototype = Object.getPrototypeOf(value);
    const constructor = prototype && Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
    return `${typeof constructor === "function" ? constructor.name : "Object"} {…}`;
  } catch {
    return "[Uninspectable value]";
  }
}

export interface ConsoleProperty {
  key: string;
  value?: unknown;
  text?: string;
}

/** Read one level only. Accessors are labeled instead of executed. */
export function consoleProperties(value: object): ConsoleProperty[] {
  try {
    const properties: ConsoleProperty[] = [];
    if (value instanceof Map) {
      Map.prototype.forEach.call(value, (entry: unknown, key: unknown) => {
        properties.push({ key: String(properties.length), value: { key, value: entry } });
      });
    } else if (value instanceof Set) {
      Set.prototype.forEach.call(value, (entry: unknown) => {
        properties.push({ key: String(properties.length), value: entry });
      });
    }
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) continue;
      properties.push("value" in descriptor ? { key: String(key), value: descriptor.value } : {
        key: String(key), text: descriptor.get ? "[Getter]" : "[Setter]",
      });
    }
    return properties;
  } catch {
    return [{ key: "", text: "[Unable to inspect properties]" }];
  }
}
