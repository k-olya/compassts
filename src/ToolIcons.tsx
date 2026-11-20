import type { ReactNode } from "react";

function ToolIcon({ children }: { children: ReactNode }) {
  return <svg className="cad-tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>;
}

export function SolidToolsIcon() {
  return <ToolIcon>
    <path d="m12 2.5 9 5-9 5-9-5Z" fill="currentColor" fillOpacity="0.12" />
    <path d="m12 12.5 9-5v9l-9 5Z" fill="currentColor" fillOpacity="0.06" />
    <path d="M3 7.5v9l9 5v-9" />
  </ToolIcon>;
}

export function PlanarToolsIcon() {
  return <ToolIcon>
    <path d="M4 3v17h17M2 5l2-2 2 2m13 13 2 2-2 2" />
    <path d="M8 7h9v9H8Z" fill="currentColor" fillOpacity="0.12" />
  </ToolIcon>;
}

export function ExtrudeIcon() {
  return <ToolIcon>
    <path d="m2 10 6.5-3.5L15 10l-6.5 3.5Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M2 10v7.5L8.5 21l6.5-3.5V10m-6.5 3.5V21" />
    <path d="M20 14V3m-2.5 2.5L20 3l2.5 2.5" strokeWidth="1.75" />
    <path d="m2 17.5 6.5-3.5 6.5 3.5" opacity="0.35" strokeDasharray="1.5 2" />
  </ToolIcon>;
}

export function SweepIcon() {
  return <ToolIcon>
    <path d="M2 18C2 7 7 3 18 3v6C11 9 8 11 8 18" fill="currentColor" fillOpacity="0.08" />
    <path d="M5 18C5 9 10 6 18 6" opacity="0.45" strokeDasharray="2 2" />
    <ellipse cx="5" cy="18" rx="3" ry="2.5" fill="currentColor" fillOpacity="0.12" />
    <ellipse cx="18" cy="6" rx="2.5" ry="3" fill="currentColor" fillOpacity="0.12" />
  </ToolIcon>;
}

export function ChamferIcon() {
  return <ToolIcon>
    <path d="M3 8.5 11 4l6 3.5-8 4.5Z" fill="currentColor" fillOpacity="0.08" />
    <path d="m9 12 8-4.5 4 4-8 4.5Z" fill="currentColor" fillOpacity="0.3" />
    <path d="M3 8.5v9L13 23v-7m8-4.5v7L13 23" />
    <path d="m17 2 5 3-2 2" opacity="0.4" strokeDasharray="1.5 2" />
  </ToolIcon>;
}

export function SketchIcon() {
  return <ToolIcon>
    <path d="M12 5H3v16h15v-9" fill="currentColor" fillOpacity="0.06" />
    <path d="m10 14 1-4 8-8 3 3-8 8-4 1Zm7-10 3 3m-9 3 3 3" />
    <path d="M6 17c2-3 4 3 8-1" opacity="0.65" />
  </ToolIcon>;
}

export function LineSegmentIcon() {
  return <ToolIcon>
    <path d="m6.5 17.5 11-11" strokeWidth="1.75" />
    <rect x="2.5" y="16.5" width="5" height="5" rx="0.5" fill="currentColor" fillOpacity="0.16" />
    <rect x="16.5" y="2.5" width="5" height="5" rx="0.5" fill="currentColor" fillOpacity="0.16" />
  </ToolIcon>;
}

export function PlanarCurveIcon() {
  return <ToolIcon>
    <path d="M4 17V5m16 2v12" opacity="0.4" />
    <circle cx="4" cy="4" r="1.25" opacity="0.6" />
    <circle cx="20" cy="20" r="1.25" opacity="0.6" />
    <path d="M4 19C4 4 20 20 20 5" strokeWidth="1.75" />
    <rect x="2" y="17" width="4" height="4" rx="0.5" fill="currentColor" fillOpacity="0.16" />
    <rect x="18" y="3" width="4" height="4" rx="0.5" fill="currentColor" fillOpacity="0.16" />
  </ToolIcon>;
}
