/**
 * Parser for the .backlog folder format.
 *
 * Faithfully mirrors the Go implementation in github.com/hantsaniala/backlog
 * (model/task.go, model/backlog.go, model/epic.go, model/sprint.go,
 * model/project.go): same file layout, same frontmatter fields, same
 * skip-broken-files behavior, same status/priority ordering.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";

import {
  Backlog,
  Epic,
  Priority,
  ProjectConfig,
  ProjectSnapshot,
  Sprint,
  Status,
  Task,
  TaskFields,
  TaskType,
} from "./types";

export { STATUS_LABELS, STATUS_ORDER } from "./types";

const DEFAULT_STATUS: Status = "todo";
const DEFAULT_PRIORITY: Priority = "medium";
const DEFAULT_TYPE: TaskType = "task";

export function validStoryPoints(sp: number): boolean {
  return [1, 2, 3, 5, 8, 13].includes(sp);
}

export function statusScore(s: Status): number {
  switch (s) {
    case "todo":
      return 0;
    case "in-progress":
      return 1;
    case "review":
      return 2;
    case "on-hold":
      return 3;
    case "done":
      return 4;
    case "cancelled":
      return 5;
    default:
      return 99;
  }
}

export function priorityScore(p: Priority): number {
  switch (p) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
    default:
      return 99;
  }
}

/**
 * Split a markdown file into YAML frontmatter + body.
 * Matches Go's strings.SplitN(data, "---", 3): everything between the first
 * two "---" separators is frontmatter; the rest is body.
 */
export function splitFrontmatter(content: string): { frontmatter: string; body: string } | null {
  const first = content.indexOf("---");
  if (first === -1) return null;
  const second = content.indexOf("---", first + 3);
  if (second === -1) return null;
  return {
    frontmatter: content.slice(first + 3, second),
    body: content.slice(second + 3),
  };
}

/**
 * Extract the one-line summary: the first non-empty, non-header line inside
 * the "## Summary" section (falling back to the first non-empty non-header
 * line of the body, like the Go implementation does).
 */
export function extractSummary(body: string): string {
  const lines = body.split("\n");
  let fallback = "";
  let inSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "## Summary" || trimmed === "## Description") {
      inSection = true;
      continue;
    }
    if (inSection && trimmed.startsWith("## ")) {
      inSection = false;
      continue;
    }
    if (inSection && trimmed !== "") {
      return trimmed;
    }
    if (fallback === "" && trimmed !== "" && !trimmed.startsWith("#")) {
      fallback = trimmed;
    }
  }
  return fallback;
}

/** Extract all lines under a "## Header" section until the next "## " header. */
export function extractSection(body: string, header: string): string {
  const lines = body.split("\n");
  let inSection = false;
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === header) {
      inSection = true;
      continue;
    }
    if (inSection && trimmed.startsWith("## ")) {
      break;
    }
    if (inSection) {
      out.push(line);
    }
  }
  return out.join("\n").trim();
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }
  return [];
}

export function parseTask(filePath: string, projectID: string): Task {
  const content = fs.readFileSync(filePath, "utf8");
  const split = splitFrontmatter(content);
  if (!split) {
    throw new Error(`task ${filePath}: missing frontmatter`);
  }
  const data = (parseYaml(split.frontmatter) ?? {}) as TaskFields;

  const task: Task = {
    id: String(data.id ?? path.basename(filePath, ".md")),
    type: data.type ?? DEFAULT_TYPE,
    status: data.status ?? DEFAULT_STATUS,
    priority: data.priority ?? DEFAULT_PRIORITY,
    severity: data.severity ?? null,
    assignee: data.assignee ?? null,
    reporter: data.reporter ?? null,
    labels: asStringArray(data.labels),
    components: asStringArray(data.components),
    story_points: data.story_points ?? null,
    epic: data.epic ?? null,
    sprint: data.sprint ?? null,
    fix_version: data.fix_version ?? null,
    resolution: data.resolution ?? null,
    parent: data.parent ?? null,
    children: asStringArray(data.children),
    depends_on: asStringArray(data.depends_on),
    blocks: asStringArray(data.blocks),
    related_to: asStringArray(data.related_to),
    due_date: data.due_date ?? null,
    created: data.created ?? null,
    updated: data.updated ?? null,
    body: split.body.trim(),
    filename: path.basename(filePath),
    projectID,
    summary: "",
    description: "",
  };
  task.summary = extractSummary(task.body);
  task.description = extractSection(task.body, "## Description");
  return task;
}

export function parseEpic(filePath: string, projectID: string): Epic {
  const content = fs.readFileSync(filePath, "utf8");
  const split = splitFrontmatter(content);
  if (!split) {
    throw new Error(`epic ${filePath}: missing frontmatter`);
  }
  const data = (parseYaml(split.frontmatter) ?? {}) as Partial<Epic>;
  const epic: Epic = {
    id: String(data.id ?? path.basename(filePath, ".md")),
    name: data.name ?? "",
    status: data.status ?? DEFAULT_STATUS,
    priority: data.priority ?? DEFAULT_PRIORITY,
    labels: asStringArray(data.labels),
    due_date: data.due_date ?? null,
    created: data.created ?? null,
    updated: data.updated ?? null,
    body: split.body.trim(),
    filename: path.basename(filePath),
    projectID,
    children: [],
  };
  return epic;
}

export function parseSprint(filePath: string, projectID: string): Sprint {
  const content = fs.readFileSync(filePath, "utf8");
  const split = splitFrontmatter(content);
  if (!split) {
    throw new Error(`sprint ${filePath}: missing frontmatter`);
  }
  const data = (parseYaml(split.frontmatter) ?? {}) as Partial<Sprint>;
  const sprint: Sprint = {
    id: String(data.id ?? path.basename(filePath, ".md")),
    name: data.name ?? "",
    start: data.start ?? null,
    end: data.end ?? null,
    goal: data.goal ?? null,
    created: data.created ?? null,
    filename: path.basename(filePath),
    projectID,
    tasks: [],
  };
  return sprint;
}

export function loadProjectConfig(configPath: string): ProjectConfig {
  const data = fs.readFileSync(configPath, "utf8");
  const split = splitFrontmatter(data);
  if (!split) {
    throw new Error(`missing frontmatter in ${configPath}`);
  }
  const parsed = (parseYaml(split.frontmatter) ?? {}) as Partial<ProjectConfig>;
  return {
    project_id: parsed.project_id ?? "PROJ",
    name: parsed.name ?? "",
    external_projects: parsed.external_projects ?? {},
  };
}

export function loadProject(backlogRoot: string): ProjectSnapshot {
  const absRoot = path.resolve(backlogRoot);
  const config = loadProjectConfig(path.join(absRoot, "project.md"));

  const snap: ProjectSnapshot = {
    config,
    root: absRoot,
    tasks: new Map(),
    epics: new Map(),
    sprints: [],
  };

  const taskDir = path.join(absRoot, "tasks");
  if (fs.existsSync(taskDir)) {
    for (const entry of fs.readdirSync(taskDir, { withFileTypes: true })) {
      if (entry.isDirectory() || !entry.name.endsWith(".md")) continue;
      try {
        const task = parseTask(path.join(taskDir, entry.name), config.project_id);
        snap.tasks.set(task.id, task);
      } catch {
        // Mirror Go: silently skip unparseable task files.
      }
    }
  }

  const epicDir = path.join(absRoot, "epics");
  if (fs.existsSync(epicDir)) {
    for (const entry of fs.readdirSync(epicDir, { withFileTypes: true })) {
      if (entry.isDirectory() || !entry.name.endsWith(".md")) continue;
      try {
        const epic = parseEpic(path.join(epicDir, entry.name), config.project_id);
        snap.epics.set(epic.id, epic);
      } catch {
        // Skip unparseable epics.
      }
    }
  }

  const sprintDir = path.join(absRoot, "sprints");
  if (fs.existsSync(sprintDir)) {
    for (const entry of fs.readdirSync(sprintDir, { withFileTypes: true })) {
      if (entry.isDirectory() || !entry.name.endsWith(".md")) continue;
      try {
        const sprint = parseSprint(path.join(sprintDir, entry.name), config.project_id);
        snap.sprints.push(sprint);
      } catch {
        // Skip unparseable sprints.
      }
    }
    snap.sprints.sort((a, b) => a.id.localeCompare(b.id));
  }

  return snap;
}

export function resolvePath(base: string, rel: string): string {
  if (path.isAbsolute(rel)) return path.normalize(rel);
  return path.normalize(path.join(base, rel));
}

export function linkEpicChildren(epics: Map<string, Epic>, tasks: Task[]): void {
  for (const epic of epics.values()) {
    epic.children = [];
    for (const task of tasks) {
      if (task.epic === epic.id) {
        epic.children.push(task);
      }
    }
  }
}

export function loadBacklog(backlogRoot: string): Backlog {
  // Mirrors Go's `visited map[string]bool`: each project is loaded at most
  // once, and externals pointing back at an already-loaded root are skipped.
  const visited = new Set<string>();
  const current = loadProject(backlogRoot);
  visited.add(current.root);

  const externals: ProjectSnapshot[] = [];
  for (const [prefix, relPath] of Object.entries(current.config.external_projects)) {
    const absPath = path.resolve(resolvePath(path.dirname(backlogRoot), relPath));
    if (visited.has(absPath)) continue;
    visited.add(absPath);
    try {
      const snap = loadProject(absPath);
      if (snap.config.project_id !== prefix) continue;
      externals.push(snap);
    } catch {
      // Silently skip unloadable external projects (mirrors Go).
    }
  }

  const allTasks: Task[] = [];
  for (const task of current.tasks.values()) {
    task.projectID = current.config.project_id;
    allTasks.push(task);
  }
  for (const snap of externals) {
    for (const task of snap.tasks.values()) {
      task.projectID = snap.config.project_id;
      allTasks.push(task);
    }
  }
  allTasks.sort((a, b) => a.id.localeCompare(b.id));

  const allEpics = new Map<string, Epic>();
  for (const [id, epic] of current.epics) {
    epic.projectID = current.config.project_id;
    allEpics.set(id, epic);
  }
  for (const snap of externals) {
    for (const [id, epic] of snap.epics) {
      epic.projectID = snap.config.project_id;
      allEpics.set(id, epic);
    }
  }
  linkEpicChildren(allEpics, allTasks);

  return { current, externals, allTasks, allEpics };
}

export function findBacklogRoot(start: string): string | null {
  let dir = start;
  for (;;) {
    const candidate = path.join(dir, ".backlog");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function statusCounts(
  tasks: Task[],
  projectID = ""
): Record<Status, number> {
  const counts: Record<Status, number> = {
    todo: 0,
    "in-progress": 0,
    review: 0,
    "on-hold": 0,
    done: 0,
    cancelled: 0,
  };
  for (const task of tasks) {
    if (projectID === "" || task.projectID === projectID) {
      counts[task.status] += 1;
    }
  }
  return counts;
}

export function tasksByStatus(tasks: Task[], status: Status): Task[] {
  return tasks
    .filter((t) => t.status === status)
    .sort((a, b) => priorityScore(a.priority) - priorityScore(b.priority) || a.id.localeCompare(b.id));
}

export function tasksBySprint(tasks: Task[], sprintName: string): Task[] {
  return tasks
    .filter((t) => t.sprint === sprintName)
    .sort((a, b) => priorityScore(a.priority) - priorityScore(b.priority) || a.id.localeCompare(b.id));
}

/**
 * Tree-search filter. Matches a task when the (case-insensitive) filter
 * string appears in its id, its one-line summary, or any of its labels.
 */
export function taskMatchesFilter(task: Task, filter: string): boolean {
  const f = filter.trim().toLowerCase();
  if (f === "") return true;
  if (task.id.toLowerCase().includes(f)) return true;
  if (task.summary.toLowerCase().includes(f)) return true;
  return task.labels.some((label) => label.toLowerCase().includes(f));
}

/** Filter tasks, preserving order. An empty/whitespace filter matches all. */
export function filterTasks(tasks: Task[], filter: string): Task[] {
  return tasks.filter((t) => taskMatchesFilter(t, filter));
}

/**
 * State filter for the tree: narrows tasks by status and/or priority.
 * Empty arrays mean "no constraint" for that dimension.
 */
export function taskPassesStateFilter(
  task: Task,
  statuses: Status[],
  priorities: Priority[]
): boolean {
  if (statuses.length > 0 && !statuses.includes(task.status)) return false;
  if (priorities.length > 0 && !priorities.includes(task.priority)) return false;
  return true;
}

export function taskByID(tasks: Task[], epics: Map<string, Epic>, id: string): Task | Epic | undefined {
  const found = tasks.find((t) => t.id === id);
  if (found) return found;
  return epics.get(id);
}
