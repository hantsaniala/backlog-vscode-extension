/**
 * Data model for the .backlog folder format, mirroring the Go structs in
 * github.com/hantsaniala/backlog (model/task.go, model/epic.go,
 * model/sprint.go, model/project.go).
 */

export type TaskType = "task" | "bug" | "story" | "spike" | "chore" | "epic";

export type Status =
  | "todo"
  | "in-progress"
  | "review"
  | "on-hold"
  | "done"
  | "cancelled";

export type Priority = "critical" | "high" | "medium" | "low";

export type Severity = "blocker" | "critical" | "major" | "minor" | "trivial";

/** YAML fields as they appear in a task file's frontmatter. */
export interface TaskFields {
  id?: string;
  type?: TaskType;
  status?: Status;
  priority?: Priority;
  severity?: Severity | null;
  assignee?: string | null;
  reporter?: string | null;
  labels?: string[];
  components?: string[];
  story_points?: number | null;
  epic?: string | null;
  sprint?: string | null;
  fix_version?: string | null;
  resolution?: string | null;
  parent?: string | null;
  children?: string[];
  depends_on?: string[];
  blocks?: string[];
  related_to?: string[];
  due_date?: string | null;
  created?: string | null;
  updated?: string | null;
}

/** A parsed task with defaults applied and derived fields filled in. */
export interface Task extends TaskFields {
  id: string;
  type: TaskType;
  status: Status;
  priority: Priority;
  labels: string[];
  components: string[];
  children: string[];
  depends_on: string[];
  blocks: string[];
  related_to: string[];
  summary: string;
  description: string;
  body: string;
  filename: string;
  projectID: string;
}

/** An epic lives in epics/ and groups tasks that reference it via `epic`. */
export interface Epic {
  id: string;
  name: string;
  status: Status;
  priority: Priority;
  labels: string[];
  due_date?: string | null;
  created?: string | null;
  updated?: string | null;
  body: string;
  filename: string;
  projectID: string;
  children: Task[];
}

/** A sprint lives in sprints/ and groups tasks that reference it via `sprint`. */
export interface Sprint {
  id: string;
  name: string;
  start?: string | null;
  end?: string | null;
  goal?: string | null;
  created?: string | null;
  filename: string;
  projectID: string;
  tasks: Task[];
}

/** project.md frontmatter. */
export interface ProjectConfig {
  project_id: string;
  name: string;
  external_projects: Record<string, string>;
}

/** One parsed .backlog project (current or external). */
export interface ProjectSnapshot {
  config: ProjectConfig;
  root: string;
  tasks: Map<string, Task>;
  epics: Map<string, Epic>;
  sprints: Sprint[];
}

/** The whole loaded backlog: current project + externals, aggregated. */
export interface Backlog {
  current: ProjectSnapshot;
  externals: ProjectSnapshot[];
  allTasks: Task[];
  allEpics: Map<string, Epic>;
}

export const STATUS_ORDER: Status[] = [
  "todo",
  "in-progress",
  "review",
  "on-hold",
  "done",
  "cancelled",
];

export const STATUS_LABELS: Record<Status, string> = {
  todo: "Todo",
  "in-progress": "In Progress",
  review: "Review",
  "on-hold": "On Hold",
  done: "Done",
  cancelled: "Cancelled",
};

export const PRIORITY_ORDER: Priority[] = ["critical", "high", "medium", "low"];

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const TASK_TYPES: TaskType[] = ["task", "bug", "story", "spike", "chore", "epic"];

export const TYPE_LABELS: Record<TaskType, string> = {
  task: "Task",
  bug: "Bug",
  story: "Story",
  spike: "Spike",
  chore: "Chore",
  epic: "Epic",
};

export const FIBONACCI = [1, 2, 3, 5, 8, 13];
