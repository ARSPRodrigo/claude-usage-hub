## v0.5.1-beta

### Heads-up

**The first start builds two database indexes.** On a database with over a
million usage entries this takes about a minute, during which the hub is not
yet serving requests. Hubs that already have the indexes skip the step.

Collectors do not need reinstalling.

### Fixed

**Dashboards, the leaderboard and per-person totals were very slow on large databases**

Queries scoped to an organization or a person had no suitable index, so SQLite
read most of the usage table. The database driver is synchronous, so while one
of these ran, every other request waited — a single dashboard load could stall
the whole hub for a minute. Two indexes, `(developer_id, timestamp)` and
`(organization_id, timestamp)`, fix this: a 7-day organization view went from
12–16 seconds to under 0.1 seconds, and one person's all-time total from 12–15
seconds to about 10 milliseconds.

The **All** time range on the leaderboard still adds up every row and remains
slow on very large databases.

**Manage → Models and the estimated-cost banner scanned the whole usage table**

Introduced in 0.5.0: opening the Overview page as a platform admin could block
the server for about 12 seconds. Models are now listed instantly, and the entry
count, cost and last-seen columns cover the last 30 days.

### Added

**Organization and workspace badge**

Developers and workspace admins, who cannot switch scope, now see a read-only
"Organization / Workspace" label in the top bar. Their leaderboard was already
limited to their own workspace without saying so anywhere.

**Members page: the workspace filter is always selectable**

With no organization chosen it lists every workspace as "Organization ·
Workspace", and picking one sets the organization filter to match.
