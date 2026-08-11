import * as vscode from "vscode";

import { statusCounts, tasksByStatus } from "./parser";
import {
  Backlog,
  Epic,
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

  setBacklog(backlog: Backlog | null): void {
    this.backlog = backlog;
    this._onDidChangeTreeData.fire(undefined);
  }

  getBacklog(): Backlog | null {
    return this.backlog;
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
        return tasksByStatus(backlog.allTasks, element.status!).map((task) => ({
          kind: "task" as const,
          label: task.id,
          description: task.summary,
          tooltip: `${task.id} — ${task.summary}`,
          task,
        }));
      case "epic":
        return [...element.epic!.children]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((task) => ({
            kind: "task" as const,
            label: task.id,
            description: task.summary,
            tooltip: `${task.id} — ${task.summary}`,
            task,
          }));
      case "sprint": {
        const sprint = element.sprint!;
        const tasks = backlog.allTasks
          .filter((t) => t.sprint === sprint.id || t.sprint === sprint.name)
          .sort((a, b) => a.id.localeCompare(b.id));
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

    for (const status of STATUS_ORDER) {
      const total = counts[status];
      if (total === 0) continue;
      nodes.push({
        kind: "status",
        label: `${STATUS_LABELS[status]} (${total})`,
        status,
        description: status === "todo" ? `${total} open` : undefined,
        tooltip: `${STATUS_LABELS[status]} — ${total} task${total === 1 ? "" : "s"}`,
      });
    }

    if (backlog.allEpics.size > 0) {
      const epics = [...backlog.allEpics.values()].sort((a, b) => a.id.localeCompare(b.id));
      nodes.push({
        kind: "epicGroup",
        label: `Epics (${epics.length})`,
        tooltip: "Epics — tasks referencing them via the `epic` field",
      });
      for (const epic of epics) {
        nodes.push({
          kind: "epic",
          label: `${epic.id} · ${epic.name}`,
          description: `${epic.children.length} task${epic.children.length === 1 ? "" : "s"} · ${STATUS_LABELS[epic.status]}`,
          tooltip: epic.name,
          epic,
        });
      }
    }

    const sprints = [...backlog.current.sprints];
    if (sprints.length > 0) {
      nodes.push({
        kind: "sprintGroup",
        label: `Sprints (${sprints.length})`,
        tooltip: "Sprints — tasks referencing them via the `sprint` field",
      });
      for (const sprint of sprints) {
        nodes.push({
          kind: "sprint",
          label: `${sprint.id} · ${sprint.name}`,
          description: sprint.start && sprint.end ? `${sprint.start} → ${sprint.end}` : sprint.goal ?? "",
          tooltip: sprint.goal ?? sprint.name,
          sprint,
        });
      }
    }

    nodes.push({
      kind: "dashboard",
      label: "Dashboard (backlog.md)",
      tooltip: "Open the status-grouped dashboard",
    });

    return nodes;
  }
}
