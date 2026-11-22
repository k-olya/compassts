import type { ReactNode } from "react";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";

export default function SideToolbar({ label, children }: { label: string; children: ReactNode }) {
  return <OverlayScrollbarsComponent element="nav" className="side-toolbar" aria-label={label}
    options={{ overflow: { x: "hidden", y: "scroll" }, scrollbars: { theme: "os-theme-compass", autoHide: "leave" } }} defer>
    {children}
  </OverlayScrollbarsComponent>;
}

export function ToolbarSection({ label, children }: { label: string; children: ReactNode }) {
  return <div className="toolbar-section" role="group" aria-label={label}>{children}</div>;
}
