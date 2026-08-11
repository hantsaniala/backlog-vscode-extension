import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

import { BacklogNode, BacklogTreeProvider } from "./backlogProvider";
import { BacklogDetailPanel, buildDetailItem, DetailItem } from "./detailPanel";
import { findBacklogRoot, loadBacklog, statusCounts, taskByID } from "./parser";
import {
  Backlog,
  Epic,
  Sprint,
  Task,
} from "./types";

const NO_BACKLOG_MESSAGE =
  "No .backlog folder found in this workspace. Create a .backlog/ directory with a project.md and tasks/ to get started.";

let context: vscode.ExtensionContext;
let treeProvider: BacklogTreeProvider;
let treeView: vscode.TreeView<BacklogNode>;
let statusBar: vscode.StatusBarItem;
let reloadTimer: ReturnType<typeof setTimeout> | undefined;
let currentRoot: string | null = null;

type BacklogItem = Task | Epic | Sprint;

export function activate(extensionContext: vscode.ExtensionContext): void {
  context = extensionContext;

  treeProvider = new BacklogTreeProvider();
  treeView = vscode.window.createTreeView("backlog.tree", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 60);
  statusBar.command = "backlog.tree.focus";
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand("backlog.refresh", () => {
      void reload();
    }),
    vscode.commands.registerCommand("backlog.openDetail", (id?: unknown) => {
      void openDetail(id);
    }),
    vscode.commands.registerCommand("backlog.openFile", (arg?: unknown) => {
      void openFile(arg);
    }),
    vscode.commands.registerCommand("backlog.openDashboard", () => {
      void openDashboard();
    })
  );

  // Watch every workspace folder for .backlog changes (including creation of
  // the folder itself) and re-parse on any change.
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder, ".backlog/**")
    );
    watcher.onDidCreate(scheduleReload, null, context.subscriptions);
    watcher.onDidChange(scheduleReload, null, context.subscriptions);
    watcher.onDidDelete(scheduleReload, null, context.subscriptions);
    context.subscriptions.push(watcher);
  }
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => void reload())
  );

  void reload();
}

function scheduleReload(): void {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    void reload();
  }, 250);
}

interface RootFinding {
  root: string;
}

function findWorkspaceBacklogRoot(): RootFinding | null {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return null;
  for (const folder of folders) {
    const root = findBacklogRoot(folder.uri.fsPath);
    if (root) return { root };
  }
  return null;
}

async function reload(): Promise<void> {
  const found = findWorkspaceBacklogRoot();
  if (!found) {
    currentRoot = null;
    treeProvider.setBacklog(null);
    treeView.message = NO_BACKLOG_MESSAGE;
    statusBar.hide();
    return;
  }

  try {
    const backlog = loadBacklog(found.root);
    currentRoot = found.root;
    treeProvider.setBacklog(backlog);
    treeView.message = undefined;

    const counts = statusCounts(backlog.allTasks);
    statusBar.text = `$(checklist) Backlog — Todo ${counts.todo} · In Progress ${counts["in-progress"]} · Done ${counts.done}`;
    statusBar.tooltip = `Backlog at ${found.root}\nClick to open the Backlog view`;
    statusBar.show();
  } catch (err) {
    treeView.message = `Failed to load .backlog: ${err instanceof Error ? err.message : String(err)}`;
    statusBar.hide();
  }
}

function resolveItem(arg: unknown): BacklogItem | undefined {
  if (typeof arg === "string") {
    const backlog = treeProvider.getBacklog();
    if (!backlog) return undefined;
    return taskByID(backlog.allTasks, backlog.allEpics, arg) ?? findSprint(backlog, arg);
  }
  if (arg && typeof arg === "object") {
    const node = arg as Partial<BacklogNode>;
    if (node.task) return node.task;
    if (node.epic) return node.epic;
    if (node.sprint) return node.sprint;
    const withId = arg as { id?: unknown; kind?: unknown };
    if (typeof withId.id === "string") {
      const backlog = treeProvider.getBacklog();
      if (!backlog) return undefined;
      if (withId.kind === "sprint") {
        return findSprint(backlog, withId.id);
      }
      return taskByID(backlog.allTasks, backlog.allEpics, withId.id);
    }
  }
  return undefined;
}

function findSprint(backlog: Backlog, id: string): Sprint | undefined {
  return backlog.current.sprints.find((s) => s.id === id || s.name === id);
}

async function openDetail(id?: unknown): Promise<void> {
  const backlog = treeProvider.getBacklog();
  if (!backlog) {
    void vscode.window.showInformationMessage(
      "No .backlog folder found in this workspace."
    );
    return;
  }
  const item = resolveItem(id);
  if (!item) {
    void vscode.window.showInformationMessage(
      "Select a task, epic, or sprint in the Backlog view."
    );
    return;
  }
  const detail: DetailItem = buildDetailItem(item, backlog);
  BacklogDetailPanel.createOrShow(context.extensionUri, detail);
}

async function openFile(arg?: unknown): Promise<void> {
  if (!currentRoot) {
    void vscode.window.showInformationMessage(
      "No .backlog folder found in this workspace."
    );
    return;
  }
  const item = resolveItem(arg);
  if (!item) {
    void vscode.window.showInformationMessage(
      "Select a task, epic, or sprint in the Backlog view."
    );
    return;
  }
  const candidates = [
    path.join(currentRoot, "tasks", item.filename),
    path.join(currentRoot, "epics", item.filename),
    path.join(currentRoot, "sprints", item.filename),
  ];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) {
    void vscode.window.showWarningMessage(
      `Source file for ${item.id} not found under ${currentRoot}.`
    );
    return;
  }
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
  await vscode.window.showTextDocument(doc, {
    preview: true,
    viewColumn: vscode.ViewColumn.Beside,
  });
}

async function openDashboard(): Promise<void> {
  if (!currentRoot) {
    void vscode.window.showInformationMessage(
      "No .backlog folder found in this workspace."
    );
    return;
  }
  const dashboard = path.join(currentRoot, "backlog.md");
  if (!fs.existsSync(dashboard)) {
    void vscode.window.showInformationMessage(
      "No backlog.md dashboard found in the .backlog folder."
    );
    return;
  }
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(dashboard));
  await vscode.window.showTextDocument(doc, { preview: true });
}

export function deactivate(): void {
  // Nothing to clean up: all disposables are registered on the context.
}
