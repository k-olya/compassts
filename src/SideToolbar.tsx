import type { ReactNode } from "react";

export default function SideToolbar({ label, children }: { label: string; children: ReactNode }) {
  return <nav className="side-toolbar" aria-label={label}>{children}</nav>;
}

export function ToolbarSection({ label, children }: { label: string; children: ReactNode }) {
  return <div className="toolbar-section" role="group" aria-label={label}>{children}</div>;
}
