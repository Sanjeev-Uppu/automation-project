const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const numFmt = new Intl.NumberFormat();

const parse = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const UNAVAILABLE = "—";
export const formatDate = (iso: string | null | undefined) => { const d = parse(iso); return d ? dateFmt.format(d) : UNAVAILABLE; };
export const formatDateTime = (iso: string | null | undefined) => { const d = parse(iso); return d ? dateTimeFmt.format(d) : UNAVAILABLE; };
export const formatTime = (d: Date) => timeFmt.format(d);
export const formatNumber = (n: number) => numFmt.format(n);
export const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
