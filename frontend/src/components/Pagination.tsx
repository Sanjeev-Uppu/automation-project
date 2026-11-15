import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Pagination as P } from "../types/api";
import { formatNumber } from "../utils/format";

const SIZES = [10, 25, 50, 100];

export function Pagination({ p, onPage, onSize, disabled }: { p: P; onPage: (n: number) => void; onSize: (n: number) => void; disabled?: boolean }) {
  const start = Math.max(1, Math.min(p.page - 2, p.total_pages - 4));
  const pages = Array.from({ length: Math.min(5, p.total_pages) }, (_, i) => start + i);
  const from = p.total === 0 ? 0 : (p.page - 1) * p.page_size + 1;
  const to = Math.min(p.page * p.page_size, p.total);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-sm text-ink-soft">Showing {formatNumber(from)}–{formatNumber(to)} of {formatNumber(p.total)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Rows
          <select className="field !w-auto !py-1" value={p.page_size} onChange={(e) => onSize(Number(e.target.value))} disabled={disabled}>
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button type="button" className="btn-secondary !px-2.5" onClick={() => onPage(p.page - 1)} disabled={!p.has_prev || disabled} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        {pages.map((n) => (
          <button key={n} type="button" onClick={() => onPage(n)} disabled={disabled}
            aria-current={n === p.page ? "page" : undefined} aria-label={`Page ${n}`}
            className={`btn !px-3 ${n === p.page ? "bg-amethyst-600 text-white" : "border border-line bg-white hover:bg-sand-100"}`}>
            {n}
          </button>
        ))}
        <button type="button" className="btn-secondary !px-2.5" onClick={() => onPage(p.page + 1)} disabled={!p.has_next || disabled} aria-label="Next page">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
