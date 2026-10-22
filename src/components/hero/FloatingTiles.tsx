import type { CSSProperties } from "react";

type Tile = {
  label: string;
  kind: "community" | "member";
  /** Position as % of the hero; tiles sit around the headline, not on it. */
  x: number;
  y: number;
  size: number;
  rotate: number;
  /** 0 = far (small, blurred, faint), 2 = near (sharp). */
  depth: 0 | 1 | 2;
  delay: number;
  /** Shown on small viewports; the rest are hidden there. */
  core?: boolean;
};

// UM, KC, NO are communities in the sample workspace; the rest are member initials.
const TILES: Tile[] = [
  { label: "UM", kind: "community", x: 12, y: 18, size: 76, rotate: -8, depth: 2, delay: 0, core: true },
  { label: "AO", kind: "member", x: 6, y: 56, size: 56, rotate: 6, depth: 1, delay: 1.4 },
  { label: "LM", kind: "member", x: 20, y: 80, size: 48, rotate: -4, depth: 0, delay: 2.6 },
  { label: "KC", kind: "community", x: 84, y: 14, size: 64, rotate: 9, depth: 1, delay: 0.8, core: true },
  { label: "VS", kind: "member", x: 93, y: 60, size: 44, rotate: -10, depth: 0, delay: 2.1 },
  { label: "NO", kind: "community", x: 82, y: 76, size: 80, rotate: -6, depth: 2, delay: 1.1, core: true },
  { label: "NS", kind: "member", x: 34, y: 8, size: 40, rotate: 12, depth: 0, delay: 3.2 },
  { label: "EK", kind: "member", x: 64, y: 90, size: 46, rotate: 5, depth: 1, delay: 0.4 },
];

export function FloatingTiles() {
  return (
    <div className="sw-hero-tiles" aria-hidden="true">
      {TILES.map((t) => (
        <div
          key={t.label}
          className="sw-hero-tile"
          data-kind={t.kind}
          data-depth={t.depth}
          data-core={t.core ? "" : undefined}
          style={
            {
              "--x": `${t.x}%`,
              "--y": `${t.y}%`,
              "--size": `${t.size}px`,
              "--rotate": `${t.rotate}deg`,
              "--delay": `${-t.delay}s`,
            } as CSSProperties
          }
        >
          <span className="sw-hero-tile-face">{t.label}</span>
        </div>
      ))}
    </div>
  );
}
