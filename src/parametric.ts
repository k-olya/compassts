/** Widget kinds supported by the script's parametric() helper. */
export type ParametricType = 'number' | 'text' | 'select' | 'checkbox';

/** Primitive value returned by a control of the given kind. */
export type ParametricValue<T extends ParametricType = ParametricType> = T extends 'number' ? number : T extends 'checkbox' ? boolean : string;

export interface ParametricControl {
  name: string;
  type: ParametricType;
  min: number;
  max: number;
  step: number;
  options: readonly string[];
  defaultValue: ParametricValue;
  value: ParametricValue;
}

/** Validate a value against its widget and constrain numbers to the configured range. */
export function parameterValue(control: Omit<ParametricControl, 'value' | 'defaultValue'>, value: ParametricValue): ParametricValue {
  if (control.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Number controls require a finite numeric value');
    return Math.min(control.max, Math.max(control.min, value));
  }
  if (control.type === 'checkbox') {
    if (typeof value !== 'boolean') throw new TypeError('Checkbox controls require a boolean value');
  } else {
    if (typeof value !== 'string') throw new TypeError('Text and select controls require string values');
    if (control.type === 'select' && (control.options.length ? !control.options.includes(value) : value !== '')) {
      throw new RangeError('Select value must be one of its options');
    }
  }
  return value;
}

function definition(input: Parameters<typeof parametric>[0], name: string): ParametricControl {
  let type = input.type;
  if (type === undefined) {
    if (typeof input.value === 'number') type = 'number';
    else if (typeof input.value === 'boolean') type = 'checkbox';
    else if (typeof input.value === 'string') type = input.options === undefined ? 'text' : 'select';
    else throw new TypeError('Supply a control type or a number, string or boolean value');
  }
  if (!['number', 'text', 'select', 'checkbox'].includes(type)) throw new TypeError('Unknown parametric control type');
  if (typeof name !== 'string' || !name.trim()) throw new TypeError('Control name must be a nonempty string');
  const { min = 0, max = 1, step = 0.001, options = [] } = input;
  if (![min, max, step].every(Number.isFinite) || min > max || step <= 0) throw new RangeError('Control bounds must be finite, min <= max, and step > 0');
  if (!Array.isArray(options) || options.some(option => typeof option !== 'string')) throw new TypeError('Control options must be strings');
  const control = { name, type, min, max, step, options: [...new Set(options)] };
  const value = parameterValue(control, input.value ?? (type === 'number' ? 0.5 : type === 'checkbox' ? true : type === 'select' ? options[0] ?? '' : ''));
  return { ...control, defaultValue: value, value };
}

let counter = 0;

/**
 * Declare a control in the model view and return its current primitive value.
 * Compassts script helper; not part of the UI-agnostic libcompass library.
 * @param options.type - Widget kind: number, text, select, or checkbox. If omitted, infer it from value:
 * number, boolean, or string (select with options, text without options). Supply either type or value.
 * @param options.name - Stable control name; defaults to control1, control2, ... from a hidden counter.
 * @param options.min - Number slider/edit minimum, default 0.
 * @param options.max - Number slider/edit maximum, default 1.
 * @param options.step - Number slider/edit increment, default 0.001.
 * @param options.options - Select choices as strings; defaults to an empty list.
 * @param options.value - Initial value: 0.5 for number, true for checkbox, the first select option,
 * or an empty string for text and selects without options. Numbers are constrained to min/max.
 * @returns The current number, string or boolean, usable directly in modeling expressions.
 * @remarks Controls are discovered when scripts run. Changes require Render (or Ctrl/Cmd+Enter).
 * Values persist between runs by name; changing a declaration's type/default resets that control.
 * Auto-names restart each run; use explicit names when reordering controls. Duplicate names throw.
 * Outside the app's script runtime this helper returns the default value without creating a widget.
 * @example
 * ```js
 * const holeRadius = parametric({ type: 'number', name: 'Hole radius', min: 1, max: 18, value: 10 });
 * s.add(circle({ radius: holeRadius }));
 * ```
 */
export function parametric<T extends ParametricType | undefined = undefined, V extends ParametricValue = ParametricValue>(options: {
  /** Optional widget kind. Otherwise infer from value; strings with options create selects. */
  type?: T;
  /** Stable name; defaults to controlN using a built-in counter. */
  name?: string;
  /** Numeric minimum, default 0. */
  min?: number;
  /** Numeric maximum, default 1. */
  max?: number;
  /** Numeric step, default 0.001. */
  step?: number;
  /** Select choices; defaults to none. */
  options?: readonly string[];
  /** Default value: number 0.5, checkbox true, first select option, otherwise empty text. */
  value?: [T] extends [undefined] ? V : ParametricValue<Exclude<T, undefined>>;
}): [T] extends [undefined] ? V extends number ? number : V extends boolean ? boolean : string : ParametricValue<Exclude<T, undefined>> {
  const control = definition(options, options.name ?? `control${counter + 1}`);
  if (options.name === undefined) counter++;
  return control.value as [T] extends [undefined] ? V extends number ? number : V extends boolean ? boolean : string : ParametricValue<Exclude<T, undefined>>;
}

/** Keep edits only for a matching declaration; reset incompatible types/defaults and invalid select choices. */
export function retainParameterValues(controls: readonly ParametricControl[], previous: readonly ParametricControl[]): ParametricControl[] {
  const known = new Map(previous.map(control => [control.name, control]));
  return controls.map(control => {
    const old = known.get(control.name);
    if (!old || old.type !== control.type || old.defaultValue !== control.defaultValue) return control;
    try { return { ...control, value: parameterValue(control, old.value) }; }
    catch { return control; }
  });
}

/** Each evaluation owns its controls and counter, including all imported modules. */
export function createParametricRuntime(previous: readonly ParametricControl[] = [], onControls?: (controls: ParametricControl[]) => void): {
  parametric: typeof parametric; controls: ParametricControl[];
} {
  const controls: ParametricControl[] = [];
  let counter = 0;
  return { controls, parametric: ((options: Parameters<typeof parametric>[0]) => {
    const control = definition(options, options.name ?? `control${counter + 1}`);
    if (controls.some(existing => existing.name === control.name)) throw new Error(`Duplicate parametric control name: ${control.name}`);
    if (options.name === undefined) counter++;
    const current = retainParameterValues([control], previous)[0];
    controls.push(current);
    onControls?.([...controls]);
    return current.value;
  }) as typeof parametric };
}
