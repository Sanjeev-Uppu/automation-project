import { RotateCcw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useDebounced } from "../hooks/useDebounced";
import { IssueFilters, ProjectSummary, UNASSIGNED } from "../types/api";

interface Props {
  value: IssueFilters; summary: ProjectSummary | null;
  onChange: (patch: Partial<IssueFilters>) => void; onReset: () => void; dirty: boolean;
}

function Select({ id, label, value, onChange, disabled, children }: { id: string; label: string; value: string; onChange: (v: string) => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <select id={id} className="field" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>{children}</select>
    </div>
  );
}

function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} type="date" className="field" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Filters({ value, summary, onChange, onReset, dirty }: Props) {
  const [text, setText] = useState(value.search);
  const debounced = useDebounced(text, 350);
  useEffect(() => { if (debounced !== value.search) onChange({ search: debounced }); }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setText(value.search); }, [value.search]);
  const off = !summary;
  return (
    <section aria-label="Filters" className="card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="f-search" className="field-label">Search ticket ID or summary</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
            <input id="f-search" type="search" className="field !pl-9" placeholder="e.g. 1021 or login" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        </div>
        <Select id="f-status" label="Status" value={value.status} disabled={off} onChange={(v) => onChange({ status: v })}>
          <option value="">{off ? "Loading…" : "All statuses"}</option>
          {summary?.statuses.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.count})</option>)}
        </Select>
        <Select id="f-assignee" label="Assignee" value={value.assignee} disabled={off} onChange={(v) => onChange({ assignee: v })}>
          <option value="">{off ? "Loading…" : "All assignees"}</option>
          {summary && summary.unassigned > 0 && <option value={UNASSIGNED}>Unassigned ({summary.unassigned})</option>}
          {summary?.assignees.map((a) => <option key={a.account_id} value={a.account_id}>{a.display_name} ({a.count})</option>)}
        </Select>
        <Select id="f-type" label="Issue type" value={value.issue_type} disabled={off} onChange={(v) => onChange({ issue_type: v })}>
          <option value="">{off ? "Loading…" : "All issue types"}</option>
          {summary?.issue_types.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.count})</option>)}
        </Select>
        <Select id="f-priority" label="Priority" value={value.priority} disabled={off} onChange={(v) => onChange({ priority: v })}>
          <option value="">{off ? "Loading…" : "All priorities"}</option>
          {summary?.priorities.map((p) => <option key={p.name} value={p.name}>{p.name} ({p.count})</option>)}
        </Select>
        <DateField id="f-ca" label="Created from" value={value.created_after} onChange={(v) => onChange({ created_after: v })} />
        <DateField id="f-cb" label="Created until" value={value.created_before} onChange={(v) => onChange({ created_before: v })} />
        <DateField id="f-ua" label="Updated from" value={value.updated_after} onChange={(v) => onChange({ updated_after: v })} />
        <DateField id="f-ub" label="Updated until" value={value.updated_before} onChange={(v) => onChange({ updated_before: v })} />
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" className="btn-ghost" onClick={onReset} disabled={!dirty}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset filters
        </button>
      </div>
    </section>
  );
}
