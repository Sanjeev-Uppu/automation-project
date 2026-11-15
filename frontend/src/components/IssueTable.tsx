import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, SearchX } from "lucide-react";
import type { Issue, SortBy, SortOrder } from "../types/api";
import { formatDate, UNAVAILABLE } from "../utils/format";
import { Skeleton } from "./Skeleton";
import { StatusBadge } from "./StatusBadge";

interface Props {
  items: Issue[] | null; loading: boolean; sortBy: SortBy; sortOrder: SortOrder;
  onSort: (by: SortBy) => void; onReset: () => void; pageSize: number;
}

function SortHeader({ label, field, props }: { label: string; field: SortBy; props: Props }) {
  const active = props.sortBy === field;
  const Icon = !active ? ArrowUpDown : props.sortOrder === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (props.sortOrder === "asc" ? "ascending" : "descending") : "none"} className="px-4 py-3 text-left font-medium">
      <button type="button" onClick={() => props.onSort(field)} className="inline-flex items-center gap-1.5 hover:text-plum-700">
        {label}<Icon className={`h-3.5 w-3.5 ${active ? "text-plum-600" : "text-ink-faint"}`} aria-hidden="true" />
      </button>
    </th>
  );
}

export function IssueTable(props: Props) {
  const { items, loading } = props;
  if (!items && loading) {
    return (
      <div role="status" aria-label="Loading tickets" className="space-y-2 p-4">
        {Array.from({ length: Math.min(props.pageSize, 8) }, (_, i) => <Skeleton key={i} className="h-11" />)}
      </div>
    );
  }
  if (items && items.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <SearchX className="h-9 w-9 text-sand-600" aria-hidden="true" />
        <h3 className="mt-3 font-display text-lg font-semibold">No tickets match these filters</h3>
        <p className="mt-1 max-w-sm text-sm text-ink-soft">Try a different status or search term, or clear the filters to see every ticket in this project.</p>
        <button type="button" onClick={props.onReset} className="btn-secondary mt-4">Clear filters</button>
      </div>
    );
  }
  return (
    <div className={`overflow-x-auto transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
      <table className="w-full min-w-[1080px] text-sm">
        <thead className="bg-sand-100/60 text-xs text-ink-soft">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-medium">Ticket ID</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Summary</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Status</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Assignee</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Reporter</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Issue Type</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Priority</th>
            <SortHeader label="Created" field="created" props={props} />
            <SortHeader label="Updated" field="updated" props={props} />
            <th scope="col" className="px-4 py-3 text-left font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {(items ?? []).map((i) => (
            <tr key={i.key} className="hover:bg-sand-100/40">
              <td className="whitespace-nowrap px-4 py-3">
                <a href={i.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-amethyst-700 underline-offset-2 hover:underline">{i.key}</a>
              </td>
              <td className="max-w-xs px-4 py-3"><span className="line-clamp-2">{i.summary ?? UNAVAILABLE}</span></td>
              <td className="px-4 py-3">{i.status ? <StatusBadge name={i.status.name} category={i.status.category} /> : UNAVAILABLE}</td>
              <td className="whitespace-nowrap px-4 py-3">{i.assignee?.display_name ?? <span className="text-ink-faint">Unassigned</span>}</td>
              <td className="whitespace-nowrap px-4 py-3">{i.reporter?.display_name ?? UNAVAILABLE}</td>
              <td className="whitespace-nowrap px-4 py-3">{i.issue_type?.name ?? UNAVAILABLE}</td>
              <td className="whitespace-nowrap px-4 py-3">{i.priority?.name ?? UNAVAILABLE}</td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(i.created)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(i.updated)}</td>
              <td className="px-4 py-3">
                <a href={i.url} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-2.5 !py-1 text-xs" aria-label={`Open ${i.key} in Jira`}>
                  Open in Jira <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
