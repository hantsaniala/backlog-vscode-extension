import * as vscode from "vscode";

import {
  statusCounts,
  taskMatchesFilter,
  taskPassesStateFilter,
  tasksByStatus,
} from "./parser";
import {
  Backlog,
  Epic,
  Priority,
  Sprint,
  STATUS_LABELS,
  STATUS_ORDER,
  Status,
  Task,
} from "./types";

export type NodeKind = "status" | "task" | "epic" | "epicGroup" | "sprint" | "sprintGroup" | "dashboard";

export interface BacklogNode {
  kind: NodeKind;
  label: string;
  description?: string;
  tooltip?: string;
  status?: Status;
  task?: Task;
  epic?: Epic;
  sprint?: Sprint;
}

function statusIcon(status: Status): vscode.ThemeIcon {
  switch (status) {
    case "todo":
      return new vscode.ThemeIcon("circle-outline");
    case "in-progress":
      return new vscode.ThemeIcon("loading");
    case "review":
      return new vscode.ThemeIcon("eye");
    case "on-hold":
      return new vscode.ThemeIcon("circle-slash");
    case "done":
      return new vscode.ThemeIcon("check");
    case "cancelled":
      return new vscode.ThemeIcon("close");
  }
}

function taskIcon(task: Task): vscode.ThemeIcon {
  switch (task.type) {
    case "bug":
      return new vscode.ThemeIcon("bug");
    case "story":
      return new vscode.ThemeIcon("book");
    case "spike":
      return new vscode.ThemeIcon("zap");
    case "chore":
      return new vscode.ThemeIcon("tools");
    default:
      return new vscode.ThemeIcon("checklist");
  }
}

export class BacklogTreeProvider implements vscode.TreeDataProvider<BacklogNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<BacklogNode | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private backlog: Backlog | null = null;
  private filter = "";
  private statuses: Status[] = [];
  private priorities: Priority[] = [];

  setBacklog(backlog: Backlog | null): void {
    this.backlog = backlog;
    this._onDidChangeTreeData.fire(undefined);
  }

  getBacklog(): Backlog | null {
    return this.backlog;
  }

  /** Set the tree-search filter and re-render the tree. */
  setFilter(filter: string): void {
    this.filter = filter;
    this._onDidChangeTreeData.fire(undefined);
  }

  clearFilter(): void {
    if (this.filter.trim() === "") return;
    this.filter = "";
    this._onDidChangeTreeData.fire(undefined);
  }

  getFilter(): string {
    return this.filter;
  }

  /** Set the status/priority filter (empty arrays = no constraint). */
  setStateFilter(statuses: Status[], priorities: Priority[]): void {
    this.statuses = statuses;
    this.priorities = priorities;
    this._onDidChangeTreeData.fire(undefined);
  }

  getStatuses(): Status[] {
    return this.statuses;
  }

  getPriorities(): Priority[] {
    return this.priorities;
  }

  /** Clear the text search and the status/priority filter at once. */
  clearAllFilters(): void {
    if (!this.hasActiveFilter()) return;
    this.filter = "";
    this.statuses = [];
    this.priorities = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  /** True while any filter (text, status, or priority) is active. */
  hasActiveFilter(): boolean {
    return (
      this.filter.trim() !== "" ||
      this.statuses.length > 0 ||
      this.priorities.length > 0
    );
  }

  /** Whether a task survives the text search AND the status/priority filter. */
  isTaskVisible(task: Task): boolean {
    return (
      taskMatchesFilter(task, this.filter) &&
      taskPassesStateFilter(task, this.statuses, this.priorities)
    );
  }

  /** Number of tasks visible under the current filters. */
  visibleTaskCount(): number {
    const backlog = this.backlog;
    if (!backlog) return 0;
    let count = 0;
    for (const task of backlog.allTasks) {
      if (this.isTaskVisible(task)) count++;
    }
    return count;
  }

  private visibleTasks(tasks: Task[]): Task[] {
    return tasks.filter((t) => this.isTaskVisible(t));
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: BacklogNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label);
    item.description = element.description;
    item.tooltip = element.tooltip ?? element.label;
    item.contextValue = element.kind;

    switch (element.kind) {
      case "status":
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        item.iconPath = statusIcon(element.status ?? "todo");
        break;
      case "task": {
        const task = element.task!;
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.iconPath = taskIcon(task);
        item.command = {
          command: "backlog.openDetail",
          title: "Open Detail View",
          arguments: [task.id],
        };
        break;
      }
      case "epic":
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        item.iconPath = new vscode.ThemeIcon("layers");
        item.command = {
          command: "backlog.openDetail",
          title: "Open Detail View",
          arguments: [element.epic!.id],
        };
        break;
      case "epicGroup":
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        item.iconPath = new vscode.ThemeIcon("layers");
        break;
      case "sprint":
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        item.iconPath = new vscode.ThemeIcon("milestone");
        item.command = {
          command: "backlog.openDetail",
          title: "Open Detail View",
          arguments: [element.sprint!.id],
        };
        break;
      case "sprintGroup":
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        item.iconPath = new vscode.ThemeIcon("milestone");
        break;
      case "dashboard":
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.iconPath = new vscode.ThemeIcon("list-unordered");
        item.command = {
          command: "backlog.openDashboard",
          title: "Open Dashboard",
          arguments: [],
        };
        break;
    }
    return item;
  }

  getChildren(element?: BacklogNode): BacklogNode[] {
    const backlog = this.backlog;
    if (!backlog) return [];

    if (!element) {
      return this.buildRoot(backlog);
    }

    switch (element.kind) {
      case "status":
        return this.visibleTasks(
          tasksByStatus(backlog.allTasks, element.status!)
        ).map((task) => ({
          kind: "task" as const,
          label: task.id,
          description: task.summary,
          tooltip: `${task.id} — ${task.summary}`,
          task,
        }));
      case "epic":
        return this.visibleTasks(
          [...element.epic!.children].sort((a, b) => a.id.localeCompare(b.id))
        ).map((task) => ({
          kind: "task" as const,
          label: task.id,
          description: task.summary,
          tooltip: `${task.id} — ${task.summary}`,
          task,
        }));
      case "sprint": {
        const sprint = element.sprint!;
        const tasks = this.visibleTasks(
          backlog.allTasks
            .filter((t) => t.sprint === sprint.id || t.sprint === sprint.name)
            .sort((a, b) => a.id.localeCompare(b.id))
        );
        return tasks.map((task) => ({
          kind: "task" as const,
          label: task.id,
          description: task.summary,
          tooltip: `${task.id} — ${task.summary}`,
          task,
        }));
      }
      default:
        return [];
    }
  }

  private buildRoot(backlog: Backlog): BacklogNode[] {
    const nodes: BacklogNode[] = [];
    const counts = statusCounts(backlog.allTasks);
    const filtering = this.hasActiveFilter();
    const statusSet = new Set(this.statuses);

    for (const status of STATUS_ORDER) {
      if (statusSet.size > 0 && !statusSet.has(status)) continue;
      const total = counts[status];
      if (total === 0) continue;
      const tasks = this.visibleTasks(tasksByStatus(backlog.allTasks, status));
      if (tasks.length === 0) continue;
      nodes.push({
        kind: "status",
        label:
          filtering && tasks.length !== total
            ? `${STATUS_LABELS[status]} (${tasks.length}/${total})`
            : `${STATUS_LABELS[status]} (${tasks.length})`,
        status,
        description: status === "todo" ? `${tasks.length} open` : undefined,
        tooltip: `${STATUS_LABELS[status]} — ${tasks.length} task${tasks.length === 1 ? "" : "s"}${filtering ? ` of ${total}` : ""}`,
      });
    }

    if (backlog.allEpics.size > 0) {
      const sorted = [...backlog.allEpics.values()].sort((a, b) => a.id.localeCompare(b.id));
      const epics = filtering
        ? sorted.filter((ep) => this.visibleTasks(ep.children).length > 0)
        : sorted;
      if (epics.length > 0) {
        nodes.push({
          kind: "epicGroup",
          label: `Epics (${epics.length})`,
          tooltip: "Epics — tasks referencing them via the `epic` field",
        });
        for (const epic of epics) {
          const children = this.visibleTasks(epic.children);
          nodes.push({
            kind: "epic",
            label: `${epic.id} · ${epic.name}`,
            description: `${children.length} task${children.length === 1 ? "" : "s"} · ${STATUS_LABELS[epic.status]}`,
            tooltip: epic.name,
            // Clone with filtered children so the tree shows only matches while
            // the detail panel still sees the epic's full task list.
            epic: filtering ? { ...epic, children } : epic,
          });
        }
      }
    }

    const sprints = [...backlog.current.sprints];
    const visibleSprints = filtering
      ? sprints.filter((sp) =>
          backlog.allTasks.some(
            (t) => (t.sprint === sp.id || t.sprint === sp.name) && this.isTaskVisible(t)
          )
        )
      : sprints;
    if (visibleSprints.length > 0) {
      nodes.push({
        kind: "sprintGroup",
        label: `Sprints (${visibleSprints.length})`,
        tooltip: "Sprints — tasks referencing them via the `sprint` field",
      });
      for (const sprint of visibleSprints) {
        nodes.push({
          kind: "sprint",
          label: `${sprint.id} · ${sprint.name}`,
          description: sprint.start && sprint.end ? `${sprint.start} → ${sprint.end}` : sprint.goal ?? "",
          tooltip: sprint.goal ?? sprint.name,
          sprint,
        });
      }
    }

    if (!filtering) {
      nodes.push({
        kind: "dashboard",
        label: "Dashboard (backlog.md)",
        tooltip: "Open the status-grouped dashboard",
      });
    }

    return nodes;
  }
}
