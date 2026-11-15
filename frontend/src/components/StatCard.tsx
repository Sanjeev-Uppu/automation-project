import { formatNumber, percent } from "../utils/format";

interface Props {
  label: string; count: number; total?: number; color?: string; active?: boolean; onClick?: () => void; emphasis?: boolean;
}

export function StatCard({ label, count, total, color, active, onClick, emphasis }: Props) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-sm text-ink-soft">
        {color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />}
        <span className="truncate">{label}</span>
      </span>
      <span className={`mt-2 block font-display font-semibold tabular-nums ${emphasis ? "text-4xl text-plum-600" : "text-3xl text-ink"}`}>
        {formatNumber(count)}
      </span>
      {total !== undefined && total > 0 && !emphasis && (
        <span className="mt-0.5 block text-xs text-ink-faint">{percent(count, total)}% of project</span>
      )}
    </>
  );
  const base = `card block w-full p-4 text-left ${active ? "!border-sand-500 !bg-sand-100 ring-2 ring-sand-400" : ""}`;
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={!!active} className={`${base} transition-colors hover:border-sand-500`}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  );
}
