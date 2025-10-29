// ABOUTME: Simple legend component for displaying vote colors and labels.
// ABOUTME: Inputs = color scale + optional title, Outputs = accessible list of swatches.
import type { VoteStatus } from '../types';

type LegendEntry = {
  label: string;
  color: string;
};

type LegendProps = {
  entries: LegendEntry[];
  title?: string;
};

export const Legend = ({ entries, title = 'Vote legend' }: LegendProps) => (
  <section className="legend" aria-label={title}>
    {entries.map((entry) => (
      <div className="legend-row" key={entry.label}>
        <span className="legend-swatch" style={{ backgroundColor: entry.color }} />
        <span>{entry.label}</span>
      </div>
    ))}
  </section>
);

export const buildLegendEntries = (
  scale: Record<VoteStatus, string>
): LegendEntry[] =>
  (Object.entries(scale) as Array<[VoteStatus, string]>).map(([label, color]) => ({
    label,
    color
  }));

export default Legend;
