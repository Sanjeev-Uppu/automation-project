import { ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { DashboardProject, FacetCount } from "../types/api";
import { colorMap } from "../utils/colors";
import { BarList, StatusDonut } from "./Charts";
import { ErrorState } from "./ErrorState";
import { StatCard } from "./StatCard";

const PALETTE = ["#9966CC", "#8E4585", "#D8B56D", "#BF98E0", "#CE97C7", "#E5C78A", "#653D91", "#B8934A"];
const facetItems = (f: FacetCount[]) => f.filter((x) => x.count > 0).map((x, i) => ({ name: x.name, count: x.count, color: PALETTE[i % PALETTE.length] }));

export function ProjectOverview({ project }: { project: DashboardProject }) {
  if (!project.ok || !project.summary) {
    return (
      <section aria-label={`${project.key} project`} className="space-y-3">
        <h2 className="font-display text-2xl font-semibold">{project.key}</h2>
        {project.error ? <ErrorState error={project.error} compact /> : null}
      </section>
    );
  }
  const s = project.summary;
  const colors = colorMap(s.statuses);
  return (
    <section aria-label={`${s.name} project`} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">{s.name}</h2>
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-plum-700">
            Project key {s.key} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
        <Link to={`/projects/${s.key}`} className="btn-secondary">Explore tickets <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total tickets" count={s.total} emphasis />
        {s.statuses.map((st) => <StatCard key={st.name} label={st.name} count={st.count} total={s.total} color={colors[st.name]} />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-display text-lg font-semibold">Tickets by status</h3>
          <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
            <StatusDonut statuses={s.statuses} total={s.total} />
            <div className="w-full min-w-0 flex-1">
              <BarList label="Tickets by status" total={s.total} items={s.statuses.map((x) => ({ name: x.name, count: x.count, color: colors[x.name] }))} />
            </div>
          </div>
        </div>
        <div className="card grid gap-6 p-5 sm:grid-cols-2">
          <div><h3 className="mb-3 font-display text-lg font-semibold">By priority</h3><BarList label="Tickets by priority" total={s.total} items={facetItems(s.priorities)} /></div>
          <div><h3 className="mb-3 font-display text-lg font-semibold">By issue type</h3><BarList label="Tickets by issue type" total={s.total} items={facetItems(s.issue_types)} /></div>
        </div>
      </div>
    </section>
  );
}
