/**
 * A whole-degree Celsius label, e.g. "18°". Rounded for display only; render it
 * inside a `dir="ltr"` span so a negative value keeps its minus sign on the
 * left in the RTL layout.
 */
export function formatDegrees(celsius: number): string {
  // A rounded `-0` (e.g. from -0.3) stringifies as "0", never "-0".
  return `${Math.round(celsius)}°`
}
