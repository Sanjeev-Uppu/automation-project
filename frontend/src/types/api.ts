
export interface ErrorBody {
  code: string;
  message: string;
  hint?: string | null;
}

export interface Person {
  account_id: string | null;
  display_name: string;
}

export interface StatusRef {
  id: string | null;
  name: string;
  category: string | null;
}

export interface NamedRef {
  id: string | null;
  name: string;
}

export interface Issue {
  id: string;
  key: string;
  url: string;
  summary: string | null;
  status: StatusRef | null;
  assignee: Person | null;
  reporter: Person | null;
  issue_type: NamedRef | null;
  priority: NamedRef | null;
  created: string | null;
  updated: string | null;
}

export interface CacheMeta {
  fetched_at: string;
  cached: boolean;
  ttl_seconds: number;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface IssuePage {
  items: Issue[];
  pagination: Pagination;
  jql: string;
  meta: CacheMeta;
}

export interface StatusCount {
  id: string | null;
  name: string;
  category: string | null;
  category_name: string | null;
  count: number;
}

export interface FacetCount {
  id: string | null;
  name: string;
  count: number;
}

export interface AssigneeFacet {
  account_id: string;
  display_name: string;
  count: number;
}

export interface ProjectSummary {
  key: string;
  name: string;
  url: string;
  total: number;
  statuses: StatusCount[];
  issue_types: FacetCount[];
  priorities: FacetCount[];
  assignees: AssigneeFacet[];
  unassigned: number;
  meta: CacheMeta;
}

export interface ProjectInfo {
  key: string;
  name: string | null;
  url: string;
  ok: boolean;
  error: ErrorBody | null;
}

export interface ProjectsResponse {
  jira_site: string;
  projects: ProjectInfo[];
}

export interface DashboardProject {
  key: string;
  url: string;
  ok: boolean;
  summary: ProjectSummary | null;
  error: ErrorBody | null;
}

export interface DashboardResponse {
  jira_site: string;
  projects: DashboardProject[];
  synced_at: string | null;
  cached: boolean;
}

export interface Readiness {
  status: "ready" | "not_ready";
  jira: {
    connected: boolean;
    site: string | null;
    account: string | null;
    checked_at: string;
    error: ErrorBody | null;
  };
}

export type SortBy = "created" | "updated";
export type SortOrder = "asc" | "desc";

export interface IssueFilters {
  status: string;
  search: string;
  assignee: string;
  issue_type: string;
  priority: string;
  created_after: string;
  created_before: string;
  updated_after: string;
  updated_before: string;
  sort_by: SortBy;
  sort_order: SortOrder;
  page: number;
  page_size: number;
}

export const UNASSIGNED = "__unassigned__";

export const DEFAULT_FILTERS: IssueFilters = {
  status: "",
  search: "",
  assignee: "",
  issue_type: "",
  priority: "",
  created_after: "",
  created_before: "",
  updated_after: "",
  updated_before: "",
  sort_by: "created",
  sort_order: "desc",
  page: 1,
  page_size: 25,
};

// ==========================================
// Testing Dashboard Types
// ==========================================

export type TestingCategory = "manual" | "automation";

export interface TestingTicket {
  jira_issue_id: string;
  jira_key: string;
  project_key: string;
  jira_url: string;
  summary: string | null;
  description: string | null;
  category: TestingCategory;
  status: string | null;
  priority: string | null;
  issue_type: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  reporter_id: string | null;
  reporter_name: string | null;
  jira_created_at: string | null;
  jira_updated_at: string | null;
}

export interface TestingTicketPage {
  category: TestingCategory;
  items: TestingTicket[];
  pagination: Pagination;
}

export interface TestingDashboardSummary {
  manual: number;
  automation: number;
  total: number;
}

export interface TestingProjectSyncStatus {
  project_key: string;
  status: string;
  total_indexed: number;
  last_started_at: string | null;
  last_completed_at: string | null;
  last_error: string | null;
  updated_at: string | null;
}

export interface TestingSyncStatusResponse {
  projects: TestingProjectSyncStatus[];
}

export interface TestingSyncResult {
  status: string;
  projects_found: number;
  projects_completed: number;
  projects_failed: number;
  total_indexed: number;
  results: Array<{
    project_key: string;
    status: string;
    indexed: number;
    error?: string | null;
  }>;
}
