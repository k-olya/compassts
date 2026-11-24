import type { ConsoleProperty } from './console-values.ts';

/** One lazy reference into the render worker, so console objects need not be cloned. */
export class RemoteConsoleValue {
  readonly label: string;
  readonly properties: () => Promise<ConsoleProperty[]>;
  constructor(label: string, properties: () => Promise<ConsoleProperty[]>) {
    this.label = label; this.properties = properties;
  }
}

export interface ConsoleReference { remoteId: number; label: string }
