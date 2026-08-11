# Backlog Explorer

A VS Code extension that parses a workspace's `.backlog` folder and displays its
contents in a sidebar tree with a read-only detail view — the same data model as
the [`backlog`](https://github.com/hantsaniala/backlog) CLI and the
[`backlog-skills`](https://github.com/hantsaniala/backlog-skills) system.

Display only: the extension never writes to your `.backlog` folder, and makes no
network calls. It just reads markdown files with YAML frontmatter.

## Features

- **Sidebar view** — tasks grouped by status (Todo, In Progress, Review, On Hold,
  Done, Cancelled), plus Epics, Sprints, and the `backlog.md` dashboard, mirroring
  the `backlog` CLI's dashboard.
- **Detail view** — click any task, epic, or sprint to open a read-only panel with
  every parsed field: status, type, priority, severity, assignee, labels,
  components, story points, dates, and dependency relations (`depends_on`,
  `blocks`, `related_to`, children). Related items are clickable.
- **Tree search** — filter the sidebar by task ID, summary, or label. Click the
  search icon (or run **Backlog: Search Tasks**) and type: the tree updates live,
  status groups show matching/total counts (e.g. `Todo (2/5)`), and epics/sprints
  only appear when they contain a match. Press Enter to keep the filter or Esc to
  clear it.
- **Status / priority filter** — click the filter icon (or run
  **Backlog: Filter by Status/Priority**) for a multi-select picker of statuses
  and priorities. Both filters compose with the text search, status groups
  outside the selection are hidden, and the tree narrows live.
- **Clear filters** — a **Backlog: Clear Filters** button appears in the view
  title whenever any filter (text, status, or priority) is active.
- **Live refresh** — the view re-parses automatically when anything under
  `.backlog/` changes (create/edit/delete), debounced. A manual **Backlog: Refresh**
  command is also available.
- **Open source files** — jump from the tree or detail view straight to the
  underlying `tasks/<ID>.md` file.
- **Status bar** — running counts of Todo / In Progress / Done tasks.

## The `.backlog` format

Mirrors the `backlog` repo's model exactly (`model/task.go`, `model/backlog.go`):

```
.backlog/
├── project.md        # YAML frontmatter: project_id, name, external_projects
├── backlog.md        # optional status-grouped dashboard
├── AGENTS.md         # ignored by the parser
├── tasks/            # one markdown file per task: <ID>.md
├── epics/            # one markdown file per epic
└── sprints/          # one markdown file per sprint
```

A task file is YAML frontmatter between `---` separators plus a markdown body:

```markdown
---
id: "FE-TASK-001"
type: "task"              # task | bug | story | spike | chore
status: "todo"            # todo | in-progress | review | on-hold | done | cancelled
priority: "high"          # critical | high | medium | low
severity: null            # blocker | critical | major | minor | trivial (bugs)
assignee: null
reporter: null
labels: ["neovim", "plugin"]
components: ["tui"]
story_points: 5           # Fibonacci: 1, 2, 3, 5, 8, 13
epic: null
sprint: null
fix_version: null
resolution: null
parent: null
children: []
depends_on: []
blocks: []
related_to: []
due_date: null
created: "2026-06-12"
updated: "2026-06-12"
---
## Summary
One-line summary of the task

## Description
Longer description.

## Acceptance Criteria
- [ ] acceptance criterion
```

Epics carry `id`, `name`, `status`, `priority`, `labels`, `due_date`, `created`,
`updated`; sprints carry `id`, `name`, `start`, `end`, `goal`, `created`. Tasks
reference an epic via the `epic` field and a sprint via the `sprint` field.

Parser behavior mirrors the Go implementation:

- Files are split on the first two `---` separators; a file without frontmatter is
  **skipped** rather than crashing the view (shown implicitly by absence).
- The one-line summary is the first non-empty line under `## Summary` (falling back
  to the first non-empty non-header line), matching `model/task.go`.
- External projects from `external_projects` are loaded relative to the directory
  containing `.backlog/`; each project is loaded at most once, mirroring Go's
  `visited` map, and projects whose `project_id` does not match the configured
  prefix are skipped.
- `description` and `acceptance criteria` sections are extracted for the detail
  view — a small, documented extension beyond the Go model, which only extracts
  the summary.

### Fidelity notes (deliberate differences from the CLI)

- The sidebar groups epics under their own **Epics** section rather than folding
  them into the status lists. The CLI's `LoadBacklog` appends epic-derived
  `type: epic` tasks to its flat task list (used for health checks and search);
  this extension keeps epics separate so each item appears exactly once, and
  status counts therefore count real tasks only.
- `backlog.md` is offered as a one-click open (read-only) instead of being
  re-rendered by the extension — the dashboard is a generated artifact of the
  format and the extension never writes to `.backlog/`.

## Commands

| Command | Description |
| --- | --- |
| `Backlog: Refresh` | Re-parse the `.backlog` folder |
| `Backlog: Search Tasks` | Open the tree-search box (filter by ID, summary, label) |
| `Backlog: Filter by Status/Priority` | Multi-select picker to narrow the tree by state |
| `Backlog: Clear Filters` | Remove the active text, status, and priority filters |
| `Backlog: Open Detail View` | Open the parsed detail panel for the selected item |
| `Backlog: Open Task File` | Open the source markdown file for the selected item |
| `Backlog: Open Dashboard` | Open `.backlog/backlog.md` |

The view auto-activates on startup when the workspace contains a `.backlog`
folder; otherwise it shows an empty-state hint.

## Development

```bash
bun install          # install dependencies
bun run build        # bundle dist/extension.js + preview/parser.cjs with esbuild
bun test             # parser smoke tests against the sample fixture
bun run watch        # rebuild on change
```

Run the extension in the **Extension Development Host** with `F5`:

- **Run Extension** — opens the current workspace; use any folder containing a
  `.backlog/` directory.
- **Run Extension (sample fixture)** — opens the repo's own fixture
  (`src/test/fixtures/sample-backlog`), which has a populated `.backlog/`
  directory, so the tree and detail view are populated immediately.

Package a `.vsix`:

```bash
bun run package
```

### Browser preview

Since an extension has no browser UI, this repo ships a small preview server that
renders the **exact output of the shared parser** against the sample fixture:

```bash
bun run build        # generates preview/parser.cjs
bun run preview      # serves on 0.0.0.0:$PORT (default 4173)
bun run preview:smoke
```

## License

MIT
