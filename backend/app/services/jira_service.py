

"""Business logic on top of the Jira client: discovery, aggregation, issue lists."""



from __future__ import annotations



import asyncio

import csv

import io

import logging

from collections import Counter

from datetime import datetime, timezone

from typing import Any



from app.core.cache import TTLCache

from app.core.config import PROJECT_KEY_RE, Settings

from app.integrations.jira_client import JiraClient

from app.schemas.models import (

    AssigneeFacet,

    CacheMeta,

    DashboardProject,

    DashboardResponse,

    ErrorBody,

    FacetCount,

    Issue,

    IssuePage,

    JiraConnection,

    Pagination,

    ProjectInfo,

    ProjectsResponse,

    ProjectSummary,

    ReadinessResponse,

    StatusCount,

    StatusesResponse,

)

from app.services.jql import ISSUE_KEY_RE, IssueFilters, build_jql

from app.services.normalizer import normalize_issue



from app.core.errors import (

    AppError,

    InvalidParameter,

    JiraNotConfigured,

    ProjectNotConfigured,

)



logger = logging.getLogger(__name__)



STATS_FIELDS = "status,assignee,issuetype,priority"




ISSUE_FIELDS = (
    "summary,description,status,assignee,reporter,issuetype,"
    "priority,created,updated"
)




CATEGORY_ORDER = {

    "new": 0,

    "indeterminate": 1,

    "done": 2,

}



CSV_HEADERS = [

    "Ticket ID",

    "Summary",

    "Status",

    "Assignee",

    "Reporter",

    "Issue Type",

    "Priority",

    "Created Date",

    "Updated Date",

    "URL",

]



# Maximum number of project summaries loaded simultaneously.

MAX_CONCURRENT_PROJECTS = 5





def error_body(exc: AppError) -> ErrorBody:

    return ErrorBody(

        code=exc.code,

        message=exc.message,

        hint=exc.hint,

    )





def _csv_safe(value: Any) -> str:

    """Neutralise spreadsheet formula injection."""

    text = "" if value is None else str(value)



    return (

        "'" + text

        if text[:1] in ("=", "+", "-", "@", "\t", "\r")

        else text

    )





class JiraService:



    def __init__(

        self,

        settings: Settings,

        client: JiraClient,

        cache: TTLCache | None = None,

    ):

        self.settings = settings

        self.client = client

        self.cache = cache or TTLCache(settings.cache_ttl_seconds)



    # ------------------------------------------------------------

    # Helpers

    # ------------------------------------------------------------



    async def require_project(self, key: str) -> str:
        """
        Validate project key syntax and confirm that the project is
        accessible to the currently connected Jira account.
        """

        normalized = key.strip().upper()

        if not PROJECT_KEY_RE.match(normalized):
            raise InvalidParameter(
                f"'{key}' is not a valid Jira project key."
            )

        self._ensure_configured()

        # Project discovery is cached and shared by the projects/dashboard APIs.
        discovery = await self._discover_projects()

        available_keys = {
            str(project.get("key", "")).strip().upper()
            for project in discovery.value
            if project.get("key")
        }

        if normalized not in available_keys:
            raise ProjectNotConfigured(
                f"Project '{normalized}' is not available "
                "to the connected Jira account.",
                hint=(
                    "Check whether the project exists and whether "
                    "the connected Jira account has permission to access it."
                ),
            )

        return normalized


    def _meta(

        self,

        fetched_at: datetime,

        hit: bool,

    ) -> CacheMeta:

        return CacheMeta(

            fetched_at=fetched_at,

            cached=hit,

            ttl_seconds=self.settings.cache_ttl_seconds,

        )



    def _project_url(self, key: str) -> str:

        return f"{self.settings.jira_base_url}/browse/{key}"



    def _ensure_configured(self) -> None:

        problems = self.settings.config_problems()



        if problems:

            raise JiraNotConfigured(

                "Jira credentials are missing or invalid in the "

                "backend configuration: "

                + "; ".join(problems)

                + ".",

                hint=(

                    "Edit backend/.env "

                    "(see backend/.env.example), "

                    "then restart the backend."

                ),

            )



    # ------------------------------------------------------------

    # Jira connection readiness

    # ------------------------------------------------------------



    async def check_connection(

        self,

        force: bool = False,

    ) -> ReadinessResponse:



        now = datetime.now(timezone.utc)



        try:

            self._ensure_configured()



            res = await self.cache.get_or_load(

                "myself",

                self.client.myself,

                force=force,

                ttl=min(

                    30,

                    self.settings.cache_ttl_seconds,

                ),

            )



            me = res.value



            conn = JiraConnection(

                connected=True,

                site=self.settings.jira_host,

                account=me.get("displayName"),

                checked_at=res.fetched_at,

            )



            return ReadinessResponse(

                status="ready",

                jira=conn,

            )



        except AppError as exc:



            conn = JiraConnection(

                connected=False,

                site=self.settings.jira_host or None,

                checked_at=now,

                error=error_body(exc),

            )



            return ReadinessResponse(

                status="not_ready",

                jira=conn,

            )



    # ------------------------------------------------------------

    # Project discovery

    # ------------------------------------------------------------



    async def _project_meta(

        self,

        key: str,

        force: bool = False,

    ):



        return await self.cache.get_or_load(

            f"project:{key}",

            lambda: self.client.get_project(key),

            force=force,

            ttl=(

                self.settings.project_meta_ttl_seconds

                if self.settings.cache_ttl_seconds

                else 0

            ),

        )



    async def _discover_projects(

        self,

        force: bool = False,

    ):

        """

        Discover all Jira projects accessible to the current account.



        Uses JiraClient.list_projects(), which handles pagination.

        Results are cached to avoid unnecessary Jira requests.

        """



        return await self.cache.get_or_load(

            "projects:all",

            self.client.list_projects,

            force=force,

            ttl=(

                self.settings.project_meta_ttl_seconds

                if self.settings.cache_ttl_seconds

                else 0

            ),

        )



    async def list_projects(

        self,

        force: bool = False,

    ) -> ProjectsResponse:



        self._ensure_configured()



        result = await self._discover_projects(force=force)



        projects: list[ProjectInfo] = []



        for project in result.value:



            key = project.get("key")



            if not key:

                continue



            key = str(key).upper()



            if not PROJECT_KEY_RE.match(key):

                logger.warning(

                    "Ignoring Jira project with invalid key format"

                )

                continue



            projects.append(

                ProjectInfo(

                    key=key,

                    name=project.get("name"),

                    url=self._project_url(key),

                    ok=True,

                )

            )



        projects.sort(

            key=lambda project: project.key.upper()

        )



        return ProjectsResponse(

            jira_site=self.settings.jira_host,

            projects=projects,

        )



    # ------------------------------------------------------------

    # Project statistics

    # ------------------------------------------------------------



    async def _load_stats(

        self,

        key: str,

        force: bool,

    ) -> dict[str, Any]:



        meta_res, statuses_raw = await asyncio.gather(

            self._project_meta(key, force),

            self.client.get_project_statuses(key),

        )



        meta = meta_res.value



        statuses: dict[str, dict[str, Any]] = {}



        # Include statuses configured for the project.

        for issue_type in statuses_raw:



            for st in issue_type.get("statuses", []):



                cat = st.get("statusCategory") or {}



                statuses.setdefault(

                    str(st["id"]),

                    {

                        "id": str(st["id"]),

                        "name": st["name"],

                        "category": cat.get("key"),

                        "category_name": cat.get("name"),

                        "count": 0,

                    },

                )



        issue_types: Counter[

            tuple[str | None, str]

        ] = Counter()



        priorities: Counter[

            tuple[str | None, str]

        ] = Counter()



        assignees: Counter[

            tuple[str, str]

        ] = Counter()



        unassigned = 0

        total = 0



        # Retrieve every issue using Jira pagination.

        async for issue in self.client.iter_search(

            f'project = "{key}"',

            STATS_FIELDS,

            self.settings.stats_page_size,

        ):



            total += 1



            fields = issue.get("fields") or {}



            # Status statistics.

            st = fields.get("status") or {}



            if st.get("name"):



                sid = str(

                    st.get("id") or st["name"]

                )



                cat = st.get("statusCategory") or {}



                entry = statuses.setdefault(

                    sid,

                    {

                        "id": sid,

                        "name": st["name"],

                        "category": cat.get("key"),

                        "category_name": cat.get("name"),

                        "count": 0,

                    },

                )



                entry["count"] += 1



            # Issue type statistics.

            it = fields.get("issuetype") or {}



            if it.get("name"):



                issue_types[

                    (

                        str(it.get("id"))

                        if it.get("id")

                        else None,

                        it["name"],

                    )

                ] += 1



            # Priority statistics.

            pr = fields.get("priority") or {}



            if pr.get("name"):



                priorities[

                    (

                        str(pr.get("id"))

                        if pr.get("id")

                        else None,

                        pr["name"],

                    )

                ] += 1



            # Assignee statistics.

            asg = fields.get("assignee") or {}



            if asg.get("accountId"):



                assignees[

                    (

                        asg["accountId"],

                        asg.get("displayName")

                        or asg["accountId"],

                    )

                ] += 1



            else:

                unassigned += 1



        # Include project issue types even when unused.

        for it in meta.get("issueTypes", []):



            ident = (

                str(it["id"])

                if it.get("id")

                else None

            )



            if not any(

                name == it["name"]

                for _, name in issue_types

            ):



                issue_types[

                    (ident, it["name"])

                ] += 0



        ordered_statuses = sorted(

            statuses.values(),

            key=lambda status: CATEGORY_ORDER.get(

                status["category"],

                3,

            ),

        )



        return {

            "name": meta.get("name") or key,

            "total": total,

            "statuses": ordered_statuses,

            "issue_types": sorted(

                issue_types.items(),

                key=lambda item: item[0][1].lower(),

            ),

            "priorities": sorted(

                priorities.items(),

                key=lambda item: -item[1],

            ),

            "assignees": sorted(

                assignees.items(),

                key=lambda item: item[0][1].lower(),

            ),

            "unassigned": unassigned,

        }



    # ------------------------------------------------------------

    # Project summary

    # ------------------------------------------------------------



    async def project_summary(

        self,

        key: str,

        force: bool = False,

    ) -> ProjectSummary:



        key = await self.require_project(key)



        self._ensure_configured()



        res = await self.cache.get_or_load(

            f"stats:{key}",

            lambda: self._load_stats(key, force),

            force=force,

        )



        data = res.value



        return ProjectSummary(

            key=key,

            name=data["name"],

            url=self._project_url(key),

            total=data["total"],

            statuses=[

                StatusCount(**status)

                for status in data["statuses"]

            ],

            issue_types=[

                FacetCount(

                    id=ident,

                    name=name,

                    count=count,

                )

                for (ident, name), count

                in data["issue_types"]

            ],

            priorities=[

                FacetCount(

                    id=ident,

                    name=name,

                    count=count,

                )

                for (ident, name), count

                in data["priorities"]

            ],

            assignees=[

                AssigneeFacet(

                    account_id=account_id,

                    display_name=display_name,

                    count=count,

                )

                for (account_id, display_name), count

                in data["assignees"]

            ],

            unassigned=data["unassigned"],

            meta=self._meta(

                res.fetched_at,

                res.hit,

            ),

        )



    # ------------------------------------------------------------

    # Project statuses

    # ------------------------------------------------------------



    async def project_statuses(

        self,

        key: str,

        force: bool = False,

    ) -> StatusesResponse:



        summary = await self.project_summary(

            key,

            force,

        )



        return StatusesResponse(

            project_key=summary.key,

            statuses=summary.statuses,

            meta=summary.meta,

        )



    # ------------------------------------------------------------

    # Dynamic dashboard

    # ------------------------------------------------------------



    async def dashboard(

        self,

        force: bool = False,

    ) -> DashboardResponse:



        self._ensure_configured()



        # Discover projects directly from Jira.

        discovery = await self._discover_projects(

            force=force

        )



        project_keys: list[str] = []



        for project in discovery.value:



            key = project.get("key")



            if not key:

                continue



            key = str(key).upper()



            if PROJECT_KEY_RE.match(key):

                project_keys.append(key)



        project_keys = sorted(set(project_keys))



        semaphore = asyncio.Semaphore(

            MAX_CONCURRENT_PROJECTS

        )



        async def one(key: str) -> DashboardProject:



            async with semaphore:



                try:



                    summary = await self.project_summary(

                        key,

                        force=force,

                    )



                    return DashboardProject(

                        key=key,

                        url=self._project_url(key),

                        ok=True,

                        summary=summary,

                    )



                except AppError as exc:



                    logger.warning(

                        "Project load failed",

                        extra={

                            "ctx": {

                                "project": key,

                                "code": exc.code,

                            }

                        },

                    )



                    return DashboardProject(

                        key=key,

                        url=self._project_url(key),

                        ok=False,

                        error=error_body(exc),

                    )



        # Load discovered projects with controlled concurrency.

        projects = await asyncio.gather(

            *(one(key) for key in project_keys)

        )



        successful = [

            project.summary.meta

            for project in projects

            if project.summary

        ]



        return DashboardResponse(

            jira_site=self.settings.jira_host,

            projects=list(projects),

            synced_at=min(

                (

                    meta.fetched_at

                    for meta in successful

                ),

                default=None,

            ),

            cached=(

                bool(successful)

                and all(

                    meta.cached

                    for meta in successful

                )

            ),

        )



    # ------------------------------------------------------------

    # Issue retrieval helpers

    # ------------------------------------------------------------



    async def _issue_keys(

        self,

        jql: str,

        force: bool,

    ):



        async def load() -> list[str]:



            issues = await self.client.search_all(

                jql,

                "key",

                self.settings.key_page_size,

            )



            return [

                issue["key"]

                for issue in issues

                if ISSUE_KEY_RE.match(

                    issue.get("key", "")

                )

            ]



        return await self.cache.get_or_load(

            f"keys:{jql}",

            load,

            force=force,

        )



    # ------------------------------------------------------------

    # Project issue listing

    # ------------------------------------------------------------



    async def list_issues(

        self,

        key: str,

        filters: IssueFilters,

        page: int,

        page_size: int,

        force: bool = False,

    ) -> IssuePage:



        key = await self.require_project(key)



        self._ensure_configured()



        jql = build_jql(key, filters)



        offset = (page - 1) * page_size



        async def load() -> tuple[list[Issue], int]:



            keys = (

                await self._issue_keys(

                    jql,

                    force,

                )

            ).value



            window = keys[

                offset:offset + page_size

            ]



            if not window:

                return [], len(keys)



            detail_jql = (

                f"key in ({', '.join(window)})"

            )



            raws = await self.client.search_all(

                detail_jql,

                ISSUE_FIELDS,

                self.settings.detail_page_size,

            )



            by_key = {

                raw["key"]: raw

                for raw in raws

            }



            items = [

                normalize_issue(

                    by_key[issue_key],

                    self.settings.jira_base_url,

                )

                for issue_key in window

                if issue_key in by_key

            ]



            return items, len(keys)



        res = await self.cache.get_or_load(

            f"issues:{jql}:{offset}:{page_size}",

            load,

            force=force,

        )



        items, total = res.value



        total_pages = max(

            1,

            -(-total // page_size),

        )



        return IssuePage(

            items=items,

            pagination=Pagination(

                page=page,

                page_size=page_size,

                total=total,

                total_pages=total_pages,

                has_next=page < total_pages,

                has_prev=page > 1,

            ),

            jql=jql,

            meta=self._meta(

                res.fetched_at,

                res.hit,

            ),

        )



    # ------------------------------------------------------------

    # Individual issue retrieval

    # ------------------------------------------------------------



    async def get_issue(

        self,

        project_key: str,

        issue_key: str,

    ) -> Issue:



        project_key = await self.require_project(project_key)



        self._ensure_configured()



        issue_key = issue_key.strip().upper()



        if (

            not ISSUE_KEY_RE.match(issue_key)

            or not issue_key.startswith(

                project_key + "-"

            )

        ):

            raise InvalidParameter(

                f"'{issue_key}' is not a valid "

                f"{project_key} ticket key."

            )



        raw = await self.client.get_issue(

            issue_key,

            ISSUE_FIELDS,

        )



        return normalize_issue(

            raw,

            self.settings.jira_base_url,

        )



    # ------------------------------------------------------------

    # CSV export

    # ------------------------------------------------------------



    async def export_csv(

        self,

        key: str,

        filters: IssueFilters,

    ) -> tuple[str, int]:



        key = await self.require_project(key)



        self._ensure_configured()



        jql = build_jql(key, filters)



        raws = await self.client.search_all(

            jql,

            ISSUE_FIELDS,

            self.settings.detail_page_size,

        )



        buffer = io.StringIO()



        writer = csv.writer(buffer)



        writer.writerow(CSV_HEADERS)



        for raw in raws:



            issue = normalize_issue(

                raw,

                self.settings.jira_base_url,

            )



            writer.writerow(

                [

                    _csv_safe(value)

                    for value in (

                        issue.key,

                        issue.summary,

                        (

                            issue.status.name

                            if issue.status

                            else None

                        ),

                        (

                            issue.assignee.display_name

                            if issue.assignee

                            else "Unassigned"

                        ),

                        (

                            issue.reporter.display_name

                            if issue.reporter

                            else None

                        ),

                        (

                            issue.issue_type.name

                            if issue.issue_type

                            else None

                        ),

                        (

                            issue.priority.name

                            if issue.priority

                            else None

                        ),

                        (

                            issue.created.isoformat()

                            if issue.created

                            else None

                        ),

                        (

                            issue.updated.isoformat()

                            if issue.updated

                            else None

                        ),

                        issue.url,

                    )

                ]

            )



        return buffer.getvalue(), len(raws)
