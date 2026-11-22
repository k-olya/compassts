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

export function SpatialCurvesIcon() {
  return <ToolIcon>
    <path d="M4 3v15l9 4m-9-4 16-8" opacity="0.4" />
    <path d="M4 14C7 3 14 22 20 5" strokeWidth="1.75" />
    <circle cx="4" cy="14" r="1.5" fill="currentColor" />
    <circle cx="20" cy="5" r="1.5" fill="currentColor" />
  </ToolIcon>;
}

export function SpatialSurfacesIcon() {
  return <ToolIcon>
    <path d="M3 7c6-8 12 8 18 0v11c-6 8-12-8-18 0Z" fill="currentColor" fillOpacity="0.12" />
    <path d="M3 12.5c6-8 12 8 18 0M9 6v11m6-4V8m0 5v6" opacity="0.5" />
  </ToolIcon>;
}

export function ArraysIcon() {
  return <ToolIcon>
    <rect x="3" y="3" width="6" height="6" rx="1" fill="currentColor" fillOpacity="0.2" />
    <rect x="15" y="3" width="6" height="6" rx="1" />
    <rect x="3" y="15" width="6" height="6" rx="1" />
    <rect x="15" y="15" width="6" height="6" rx="1" />
  </ToolIcon>;
}

export function HelpersIcon() {
  return <ToolIcon>
    <path d="M14 4a6 6 0 0 0-7 8l-4 4a3 3 0 0 0 5 5l4-4a6 6 0 0 0 8-7l-4 4-5-5Z" fill="currentColor" fillOpacity="0.12" />
    <circle cx="5.5" cy="18.5" r="0.75" fill="currentColor" />
  </ToolIcon>;
}

export function AnnotateIcon() {
  return <ToolIcon>
    <path d="m3 7 7-4 7 4-7 4Z" fill="currentColor" fillOpacity="0.12" />
    <path d="M3 7v8l7 4v-8m7-4v3" />
    <path d="M14 12h6l2 4-6 6-6-6Z" fill="currentColor" fillOpacity="0.2" />
    <circle cx="17.5" cy="15" r="0.8" fill="currentColor" />
  </ToolIcon>;
}

export function MeasureIcon() {
  return <ToolIcon>
    <path d="m3 16 13-13 5 5-13 13Z" fill="currentColor" fillOpacity="0.12" />
    <path d="m6 13 2 2m1-5 3 3m0-6 2 2m1-5 3 3" />
  </ToolIcon>;
}

export function DisplacementArrayIcon() {
  return <ToolIcon>
    <rect x="2" y="9" width="5" height="6" rx="0.5" fill="currentColor" fillOpacity="0.2" />
    <rect x="9.5" y="9" width="5" height="6" rx="0.5" />
    <rect x="17" y="9" width="5" height="6" rx="0.5" />
    <path d="M4.5 20h15m-2-2 2 2-2 2M4.5 4h15" opacity="0.5" />
  </ToolIcon>;
}

export function RotationArrayIcon() {
  return <ToolIcon>
    <path d="M14 4a8 8 0 0 1 3 2m3 4a8 8 0 0 1 0 4m-3 4a8 8 0 0 1-3 2m-4 0a8 8 0 0 1-3-2m-3-4a8 8 0 0 1 0-4m3-4a8 8 0 0 1 3-2" opacity="0.45" />
    <path d="M10 2h4v4h-4ZM17 6h4v4h-4ZM17 14h4v4h-4ZM10 18h4v4h-4ZM3 14h4v4H3ZM3 6h4v4H3Z" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" fillOpacity="0.2" />
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

export function RoundIcon() {
  return <ToolIcon>
    <path d="M3 8.5 11 4l6 3.5-8 4.5Z" fill="currentColor" fillOpacity="0.08" />
    <path d="m9 12 8-4.5c2.5 1.5 4 3 4 6l-8 4.5c0-3-1.5-4.5-4-6Z" fill="currentColor" fillOpacity="0.3" />
    <path d="M3 8.5v9L13 23v-5m8-4.5v5L13 23" />
    <path d="M17 2v3m3-2-3 2-2-1" opacity="0.45" />
  </ToolIcon>;
}

export function IntersectIcon() {
  return <ToolIcon>
    <path d="M3 4h12v12H3ZM9 8h12v12H9Z" opacity="0.45" />
    <path d="M9 8h6v8H9Z" fill="currentColor" fillOpacity="0.3" strokeWidth="1.75" />
    <path d="m9 12 3-4m-3 8 6-8m-3 8 3-4" opacity="0.6" />
  </ToolIcon>;
}

export function DifferenceIcon() {
  return <ToolIcon>
    <path d="M3 4h12v4H9v8H3Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M9 8h12v12H9Z" opacity="0.4" strokeDasharray="2 2" />
    <path d="M16 3h6" strokeWidth="1.75" />
  </ToolIcon>;
}

export function ExtrudeCutIcon() {
  return <ToolIcon>
    <path d="m2 10 9-5 9 5-9 5Z" fill="currentColor" fillOpacity="0.1" />
    <path d="M2 10v8l9 5 9-5v-8m-9 5v8" />
    <ellipse cx="11" cy="10" rx="3" ry="1.5" fill="currentColor" fillOpacity="0.2" />
    <path d="M11 2v8m-2-2 2 2 2-2" strokeWidth="1.75" />
    <path d="M8 10v7m6-7v7m-6 0c0 2 6 2 6 0" opacity="0.5" strokeDasharray="1.5 2" />
  </ToolIcon>;
}

export function SketchIcon() {
  return <ToolIcon>
    <path d="M12 5H3v16h15v-9" fill="currentColor" fillOpacity="0.06" />
    <path d="m10 14 1-4 8-8 3 3-8 8-4 1Zm7-10 3 3m-9 3 3 3" />
    <path d="M6 17c2-3 4 3 8-1" opacity="0.65" />
  </ToolIcon>;
}

export function TrimCurveIcon() {
  return <ToolIcon>
    <path d="M3 19C3 7 10 7 12 12" strokeWidth="1.75" />
    <path d="M12 12c2 5 9 5 9-7" opacity="0.4" strokeDasharray="2 2" />
    <path d="m8 17 8-10" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <path d="m13 4 5 1-1 5" opacity="0.65" />
  </ToolIcon>;
}

export function TrimSurfaceIcon() {
  return <ToolIcon>
    <path d="m2 9 9-5 3 5-8 9Z" fill="currentColor" fillOpacity="0.2" />
    <path d="m11 4 10 5-5 12-10-3" opacity="0.4" strokeDasharray="2 2" />
    <path d="M5 21 17 5" strokeWidth="1.75" />
    <path d="m2 13 9-5m-7 8 9-5" opacity="0.5" />
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

export function CircleIcon() {
  return <ToolIcon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 12h8.5" opacity="0.5" />
    <path d="M10 12h4m-2-2v4" strokeWidth="1.75" />
  </ToolIcon>;
}

export function EllipseIcon() {
  return <ToolIcon>
    <ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(-25 12 12)" />
    <path d="m4 15.7 16-7.4m-10-1 4 9.4" opacity="0.4" strokeDasharray="2 2" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </ToolIcon>;
}

export function SpatialCurveFromPlanarIcon() {
  return <ToolIcon>
    <path d="m2 18 8-4 12 4-8 4Z" fill="currentColor" fillOpacity="0.08" opacity="0.5" />
    <path d="M5 18c3-7 9 6 14-1" opacity="0.4" strokeDasharray="2 2" />
    <path d="M5 8c3-7 9 6 14-1M12 17V6m-2 2 2-2 2 2" />
  </ToolIcon>;
}

export function PolylineIcon() {
  return <ToolIcon>
    <path d="m4 18 5-12 7 10 4-12" />
    <path d="M2.5 16.5h3v3h-3Zm5-12h3v3h-3Zm7 10h3v3h-3Zm4-12h3v3h-3Z" fill="currentColor" fillOpacity="0.2" />
  </ToolIcon>;
}

export function RoundPolylineIcon() {
  return <ToolIcon>
    <path d="M4 20V4h16" opacity="0.4" strokeDasharray="2 2" />
    <path d="M4 20v-6A10 10 0 0 1 14 4h6" strokeWidth="1.75" />
    <path d="m14 14-7-7" opacity="0.5" />
    <circle cx="14" cy="14" r="1" fill="currentColor" />
    <circle cx="4" cy="20" r="1.5" fill="currentColor" />
    <circle cx="20" cy="4" r="1.5" fill="currentColor" />
  </ToolIcon>;
}

export function RectangleIcon() {
  return <ToolIcon>
    <path d="M4 6h16v12H4Z" fill="currentColor" fillOpacity="0.08" />
    <path d="m4 6 16 12" opacity="0.4" strokeDasharray="2 2" />
    <rect x="2.5" y="4.5" width="3" height="3" fill="currentColor" />
    <rect x="18.5" y="16.5" width="3" height="3" fill="currentColor" />
  </ToolIcon>;
}

export function SvgPathIcon() {
  return <ToolIcon>
    <path d="M4 12C4 0 20 17 20 4" strokeWidth="1.75" />
    <rect x="2.5" y="10.5" width="3" height="3" fill="currentColor" />
    <rect x="18.5" y="2.5" width="3" height="3" fill="currentColor" />
    <text x="12" y="22" textAnchor="middle" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">SVG</text>
  </ToolIcon>;
}

export function ArcIcon() {
  return <ToolIcon>
    <path d="M4 18A12 12 0 0 1 20 6" strokeWidth="1.75" />
    <path d="m4 18 12-1 4-11" opacity="0.4" strokeDasharray="2 2" />
    <circle cx="4" cy="18" r="1.5" fill="currentColor" />
    <circle cx="20" cy="6" r="1.5" fill="currentColor" />
    <path d="M14 17h4m-2-2v4" opacity="0.65" />
  </ToolIcon>;
}

export function SpatialLineIcon() {
  return <ToolIcon>
    <path d="m3 21 18-18m-6 0h6v6" />
    <circle cx="9" cy="15" r="2.5" fill="currentColor" fillOpacity="0.2" />
    <path d="m4 14 6 6" opacity="0.4" />
  </ToolIcon>;
}

export function PlaneIcon() {
  return <ToolIcon>
    <path d="m2 15 12-9 8 3-12 9Z" fill="currentColor" fillOpacity="0.12" />
    <path d="m10 18 4-12m-8 6 12 3" opacity="0.4" />
    <circle cx="2" cy="15" r="1.25" fill="currentColor" />
    <circle cx="14" cy="6" r="1.25" fill="currentColor" />
    <circle cx="22" cy="9" r="1.25" fill="currentColor" />
  </ToolIcon>;
}

export function RotateIcon() {
  return <ToolIcon>
    <path d="M19 8a8 8 0 1 0 1 7M19 3v5h-5" />
    <path d="M12 5v14" opacity="0.4" strokeDasharray="2 2" />
    <circle cx="12" cy="12" r="2" fill="currentColor" fillOpacity="0.2" />
  </ToolIcon>;
}

export function DisplaceIcon() {
  return <ToolIcon>
    <path d="M2 13h8v8H2Z" opacity="0.4" strokeDasharray="2 2" />
    <path d="M14 2h8v8h-8Z" fill="currentColor" fillOpacity="0.12" />
    <path d="m6 17 12-11m-6 0h6v6" />
  </ToolIcon>;
}
