// Colours come from Jira's status *category* (new / indeterminate / done), never from status names,
// so renamed or newly added statuses are coloured automatically.
const BASE: Record<string, string> = {
  new: "#D8B56D", // golden sand
  indeterminate: "#9966CC", // amethyst
  done: "#8E4585", // rich plum pink
};
const UNKNOWN = "#A99BB3";

function mix(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) + (255 - ((n >> shift) & 255)) * amount);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

/** Statuses sharing a category get progressively lighter shades so they stay distinguishable. */
export function statusColor(category: string | null | undefined, indexInCategory = 0): string {
  return mix(BASE[category ?? ""] ?? UNKNOWN, Math.min(indexInCategory * 0.22, 0.66));
}

export function badgeClass(category: string | null | undefined): string {
  return category === "new" || category === "indeterminate" || category === "done"
    ? `badge badge-${category}`
    : "badge badge-unknown";
}

export function colorMap<T extends { name: string; category: string | null }>(items: T[]): Record<string, string> {
  const seen: Record<string, number> = {};
  const out: Record<string, string> = {};
  for (const it of items) {
    const c = it.category ?? "";
    out[it.name] = statusColor(it.category, seen[c] ?? 0);
    seen[c] = (seen[c] ?? 0) + 1;
  }
  return out;
}
