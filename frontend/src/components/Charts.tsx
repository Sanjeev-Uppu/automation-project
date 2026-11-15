import type { StatusCount } from "../types/api";
import { colorMap } from "../utils/colors";
import { formatNumber, percent } from "../utils/format";

export function StatusDonut({ statuses, total }: { statuses: StatusCount[]; total: number }) {
  const colors = colorMap(statuses);
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  const label = `Tickets by status: ${statuses.filter((s) => s.count > 0).map((s) => `${s.name} ${s.count}`).join(", ") || "none"}`;
  return (
    <svg viewBox="0 0 140 140" role="img" aria-label={label} className="h-40 w-40 shrink-0">
      <circle cx="70" cy="70" r={R} fill="none" stroke="#F1E6CF" strokeWidth="16" />
      {total > 0 && statuses.filter((s) => s.count > 0).map((s) => {
        const len = (s.count / total) * C;
        const el = (
          <circle key={s.name} cx="70" cy="70" r={R} fill="none" stroke={colors[s.name]} strokeWidth="16"
            strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${C}`} strokeDashoffset={-offset}
            transform="rotate(-90 70 70)"><title>{`${s.name}: ${s.count}`}</title></circle>
        );
        offset += len;
        return el;
      })}
      <text x="70" y="68" textAnchor="middle" className="fill-ink font-display text-[26px] font-semibold">{formatNumber(total)}</text>
      <text x="70" y="86" textAnchor="middle" className="fill-ink-soft text-[10px]">tickets</text>
    </svg>
  );
}

export interface BarItem { name: string; count: number; color: string }

export function BarList({ items, total, label }: { items: BarItem[]; total: number; label: string }) {
  if (items.length === 0) return <p className="text-sm text-ink-faint">No data available.</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul aria-label={label} className="space-y-2.5">
      {items.map((i) => (
        <li key={i.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink">{i.name}</span>
            <span className="shrink-0 tabular-nums text-ink-soft">{formatNumber(i.count)} <span className="text-ink-faint">· {percent(i.count, total)}%</span></span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand-100">
            <div className="h-full rounded-full" style={{ width: `${(i.count / max) * 100}%`, background: i.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
