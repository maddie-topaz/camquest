import type { CSSProperties } from "react";

// The one place a per-item accent color turns into the `--item-color` CSS
// custom property that trait rows, companion cards, equipment chips and
// item slots all read. Content (traits/tendencies/companions/items) picks
// the hex once; components just forward it through this instead of each
// writing its own inline style cast.
export const accentStyle = (color: string): CSSProperties =>
  ({ "--item-color": color }) as CSSProperties;
