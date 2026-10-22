import type { CSSProperties } from "react";

type Tile = {
  alt: string;
  src: string;
  /** White-mark logos need a dark glass circle to stay visible on the light hero. */
  dark?: boolean;
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

const TILES: Tile[] = [
  { alt: "Unicorn Mafia", src: "/communities/unicorn-mafia.png", x: 12, y: 18, size: 84, rotate: -8, depth: 2, delay: 0, core: true },
  { alt: "Hackradar", src: "/communities/hackradar.png", x: 6, y: 58, size: 60, rotate: 6, depth: 1, delay: 1.4 },
  { alt: "Hack Nation", src: "/communities/hack-nation.png", x: 33, y: 9, size: 48, rotate: 10, depth: 0, delay: 3.2 },
  { alt: "basedcollective", src: "/communities/basedcollective.png", dark: true, x: 84, y: 14, size: 66, rotate: 9, depth: 1, delay: 0.8, core: true },
  { alt: "accelerateME", src: "/communities/accelerateme.png", x: 82, y: 74, size: 82, rotate: -6, depth: 2, delay: 1.1, core: true },
];

export function FloatingTiles() {
  return (
    <div className="sw-hero-tiles" aria-hidden="true">
      {TILES.map((t) => (
        <div
          key={t.alt}
          className="sw-hero-tile"
          data-kind={t.dark ? "dark" : "light"}
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
          <span className="sw-hero-tile-face">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size decorative logo */}
            <img src={t.src} alt="" width={Math.round(t.size * 0.68)} height={Math.round(t.size * 0.68)} />
          </span>
        </div>
      ))}
    </div>
  );
}
