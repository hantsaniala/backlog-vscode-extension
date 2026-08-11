import * as vscode from "vscode";

import { extractSection } from "./parser";
import {
  Backlog,
  Epic,
  PRIORITY_LABELS,
  Sprint,
  STATUS_LABELS,
  Task,
  TYPE_LABELS,
} from "./types";

export interface DetailField {
  label: string;
  value: string;
}

export interface DetailRelation {
  label: string;
  ids: string[];
}

export interface DetailItem {
  kind: "task" | "epic" | "sprint";
  id: string;
  title: string;
  statusBadge: string;
  typeBadge?: string;
  priority?: string;
  severity?: string | null;
  summary: string;
  description: string;
  acceptanceCriteria: string;
  labels: string[];
  components: string[];
  fields: DetailField[];
  relations: DetailRelation[];
}

function sprintPoints(tasks: Task[], sprint: Sprint): { total: number; completed: number } {
  let total = 0;
  let completed = 0;
  for (const task of tasks) {
    if (task.sprint !== sprint.id && task.sprint !== sprint.name) continue;
    const points = task.story_points ?? 0;
    total += points;
    if (task.status === "done") completed += points;
  }
  return { total, completed };
}

export function buildDetailItem(item: Task | Epic | Sprint, backlog: Backlog): DetailItem {
  if ("summary" in item) {
    const task = item as Task;
    const fields: DetailField[] = [
      { label: "Status", value: STATUS_LABELS[task.status] },
      { label: "Type", value: TYPE_LABELS[task.type] },
      { label: "Priority", value: PRIORITY_LABELS[task.priority] },
    ];
    if (task.type === "bug" && task.severity) {
      fields.push({ label: "Severity", value: task.severity });
    }
    fields.push(
      { label: "Assignee", value: task.assignee ?? "—" },
      { label: "Reporter", value: task.reporter ?? "—" },
      { label: "Story points", value: task.story_points != null ? String(task.story_points) : "—" },
      { label: "Sprint", value: task.sprint ?? "—" },
      { label: "Epic", value: task.epic ?? "—" },
      { label: "Due date", value: task.due_date ?? "—" },
      { label: "Created", value: task.created ?? "—" },
      { label: "Updated", value: task.updated ?? "—" },
      { label: "Fix version", value: task.fix_version ?? "—" },
      { label: "Resolution", value: task.resolution ?? "—" },
      { label: "Parent", value: task.parent ?? "—" }
    );
    const relations: DetailRelation[] = [
      { label: "Depends on", ids: task.depends_on },
      { label: "Blocks", ids: task.blocks },
      { label: "Related to", ids: task.related_to },
      { label: "Children", ids: task.children },
    ].filter((r) => r.ids.length > 0);

    return {
      kind: "task",
      id: task.id,
      title: task.summary || task.id,
      statusBadge: STATUS_LABELS[task.status],
      typeBadge: TYPE_LABELS[task.type],
      priority: PRIORITY_LABELS[task.priority],
      severity: task.severity ?? null,
      summary: task.summary,
      description: task.description,
      acceptanceCriteria: extractSection(task.body, "## Acceptance Criteria"),
      labels: task.labels,
      components: task.components,
      fields,
      relations,
    };
  }

  if ("goal" in item) {
    const sprint = item as Sprint;
    const { total, completed } = sprintPoints(backlog.allTasks, sprint);
    return {
      kind: "sprint",
      id: sprint.id,
      title: sprint.name || sprint.id,
      statusBadge: "Sprint",
      typeBadge: sprint.id,
      summary: sprint.goal ?? "",
      description: sprint.goal ?? "",
      acceptanceCriteria: "",
      labels: [],
      components: [],
      fields: [
        { label: "Start", value: sprint.start ?? "—" },
        { label: "End", value: sprint.end ?? "—" },
        { label: "Goal", value: sprint.goal ?? "—" },
        { label: "Created", value: sprint.created ?? "—" },
        { label: "Total points", value: String(total) },
        { label: "Completed points", value: String(completed) },
      ],
      relations: [],
    };
  }

  // Epics have a `name` (sprints are handled above via `goal`).
  const epic = item as Epic;
  const storyCount = epic.children.filter((c) => c.type === "story").length;
  return {
    kind: "epic",
    id: epic.id,
    title: epic.name || epic.id,
    statusBadge: STATUS_LABELS[epic.status],
    typeBadge: "Epic",
    priority: PRIORITY_LABELS[epic.priority],
    summary: epic.name,
    description: epic.body,
    acceptanceCriteria: "",
    labels: epic.labels,
    components: [],
    fields: [
      { label: "Status", value: STATUS_LABELS[epic.status] },
      { label: "Priority", value: PRIORITY_LABELS[epic.priority] },
      { label: "Tasks", value: String(epic.children.length) },
      { label: "Stories", value: String(storyCount) },
      { label: "Due date", value: epic.due_date ?? "—" },
      { label: "Created", value: epic.created ?? "—" },
      { label: "Updated", value: epic.updated ?? "—" },
    ],
    relations: epic.children.length > 0 ? [{ label: "Tasks", ids: epic.children.map((c) => c.id) }] : [],
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Lightweight markdown-ish rendering: lists and line breaks only. */
function renderBody(text: string): string {
  if (!text) return '<p class="muted">No description.</p>';
  const lines = text.split("\n");
  const html: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${escapeHtml(line.replace(/^[-*]\s+/, ""))}</li>`);
    } else if (line === "") {
      closeList();
      html.push("<br>");
    } else {
      closeList();
      html.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  closeList();
  return html.join("");
}

function renderCriteria(text: string): string {
  if (!text) return "";
  return text
    .split("\n")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((line) => {
      const checked = /^-\s+\[[xX]\]/.test(line);
      const content = escapeHtml(line.replace(/^-\s+\[[ xX]\]\s*/, ""));
      return `<li class="crit ${checked ? "crit-done" : ""}"><span class="crit-box">${checked ? "✓" : ""}</span>${content}</li>`;
    })
    .join("");
}

export class BacklogDetailPanel {
  static currentPanel: BacklogDetailPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];

  static createOrShow(extensionUri: vscode.Uri, item: DetailItem): void {
    if (BacklogDetailPanel.currentPanel) {
      BacklogDetailPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      BacklogDetailPanel.currentPanel.render(item);
      return;
    }
    BacklogDetailPanel.currentPanel = new BacklogDetailPanel(extensionUri, item);
  }

  private constructor(extensionUri: vscode.Uri, item: DetailItem) {
    this.panel = vscode.window.createWebviewPanel(
      "backlogDetail",
      `Backlog: ${item.id}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (message: { type: string; id?: string; kind?: string }) => {
        if (message.type === "openTask" && message.id) {
          void vscode.commands.executeCommand("backlog.openDetail", message.id);
        } else if (message.type === "openFile" && message.id && message.kind) {
          void vscode.commands.executeCommand("backlog.openFile", {
            id: message.id,
            kind: message.kind,
          });
        }
      },
      null,
      this.disposables
    );

    this.render(item);
  }

  private render(item: DetailItem): void {
    this.panel.title = `Backlog: ${item.id}`;
    this.panel.webview.html = this.getHtml(item);
  }

  private getHtml(item: DetailItem): string {
    const nonce = getNonce();
    const badgeTone = badgeToneFor(item.statusBadge, item.kind);

    const chips = [
      ...item.labels.map((l) => `<span class="chip chip-label">${escapeHtml(l)}</span>`),
      ...item.components.map((c) => `<span class="chip chip-component">${escapeHtml(c)}</span>`),
    ].join("");

    const fieldsHtml = item.fields
      .map((f) => `<div class="field"><span class="field-label">${escapeHtml(f.label)}</span><span class="field-value">${escapeHtml(f.value)}</span></div>`)
      .join("");

    const relationsHtml = item.relations
      .map(
        (r) => `
        <div class="relation">
          <span class="relation-label">${escapeHtml(r.label)}</span>
          <span class="relation-chips">
            ${r.ids.map((id) => `<button class="rel" data-id="${escapeHtml(id)}">${escapeHtml(id)}</button>`).join("")}
          </span>
        </div>`
      )
      .join("");

    const criteriaHtml = renderCriteria(item.acceptanceCriteria);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --muted: var(--vscode-descriptionForeground);
    --border: var(--vscode-widget-border, var(--vscode-editorWidget-border));
    --accent: var(--vscode-textLink-foreground);
    --badge-bg: var(--vscode-badge-background);
    --badge-fg: var(--vscode-badge-foreground);
  }
  * { box-sizing: border-box; }
  body { background: var(--bg); color: var(--fg); font-family: var(--vscode-font-family, system-ui); font-size: 13px; line-height: 1.55; padding: 20px 24px; margin: 0; }
  .id-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .id { font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; color: var(--muted); letter-spacing: 0.04em; }
  h1 { font-size: 20px; font-weight: 600; margin: 10px 0 4px; line-height: 1.3; }
  .badge { display: inline-block; padding: 1px 9px; border-radius: 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; background: var(--badge-bg); color: var(--badge-fg); }
  .tone-todo { background: #565f66; color: #ffffff; }
  .tone-in-progress { background: #0a6bb5; color: #ffffff; }
  .tone-review { background: #6c3bbf; color: #ffffff; }
  .tone-on-hold { background: #a56a00; color: #ffffff; }
  .tone-done { background: #1e7a34; color: #ffffff; }
  .tone-cancelled { background: #b42323; color: #ffffff; }
  .tone-sprint { background: var(--badge-bg); color: var(--badge-fg); }
  .chips { margin: 10px 0 18px; display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { padding: 2px 10px; border-radius: 10px; font-size: 11px; border: 1px solid var(--border); }
  .chip-label { color: var(--muted); }
  .chip-component { color: var(--accent); }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin: 22px 0 8px; font-weight: 600; }
  .section { border: 1px solid var(--border); border-radius: 6px; padding: 12px 14px; }
  .section p { margin: 6px 0; }
  .section ul { margin: 6px 0; padding-left: 20px; }
  .muted { color: var(--muted); }
  .fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 2px 18px; }
  .field { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent); }
  .field-label { color: var(--muted); white-space: nowrap; }
  .field-value { font-weight: 500; text-align: right; word-break: break-word; }
  .relation { margin-bottom: 8px; }
  .relation-label { color: var(--muted); font-size: 12px; margin-right: 10px; }
  .rel { background: transparent; color: var(--accent); border: 1px solid var(--border); border-radius: 10px; padding: 2px 9px; margin: 2px 4px 2px 0; font-size: 11px; font-family: var(--vscode-editor-font-family, monospace); cursor: pointer; }
  .rel:hover { background: var(--vscode-list-hoverBackground); border-color: var(--accent); }
  .criteria { list-style: none; padding: 0; margin: 6px 0; }
  .criteria li { padding: 3px 0; }
  .crit-box { display: inline-block; width: 14px; height: 14px; border: 1px solid var(--border); border-radius: 3px; margin-right: 8px; text-align: center; font-size: 10px; line-height: 13px; color: #1e7a34; }
  .crit-done { color: var(--muted); text-decoration: line-through; }
  footer { margin-top: 26px; }
  button.action { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; padding: 6px 14px; cursor: pointer; font-size: 12px; }
  button.action:hover { background: var(--vscode-button-hoverBackground); }
</style>
</head>
<body>
  <div class="id-line">
    <span class="id">${escapeHtml(item.id)}</span>
    <span class="badge tone-${badgeTone}">${escapeHtml(item.statusBadge)}</span>
    ${item.typeBadge ? `<span class="badge">${escapeHtml(item.typeBadge)}</span>` : ""}
    ${item.priority ? `<span class="badge">${escapeHtml(item.priority)}</span>` : ""}
    ${item.severity ? `<span class="badge">${escapeHtml(item.severity)}</span>` : ""}
  </div>
  <h1>${escapeHtml(item.title)}</h1>
  ${chips ? `<div class="chips">${chips}</div>` : ""}

  ${item.description ? `<h2>Description</h2><div class="section">${renderBody(item.description)}</div>` : ""}

  ${criteriaHtml ? `<h2>Acceptance Criteria</h2><div class="section"><ul class="criteria">${criteriaHtml}</ul></div>` : ""}

  <h2>Details</h2>
  <div class="fields">${fieldsHtml}</div>

  ${relationsHtml ? `<h2>Relations</h2><div class="section">${relationsHtml}</div>` : ""}

  <footer><button class="action" id="open-file">Open file</button></footer>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('open-file').addEventListener('click', function () {
      vscode.postMessage({ type: 'openFile', id: ${JSON.stringify(item.id)}, kind: ${JSON.stringify(item.kind)} });
    });
    const rels = document.querySelectorAll('.rel');
    for (let i = 0; i < rels.length; i++) {
      rels[i].addEventListener('click', function () {
        vscode.postMessage({ type: 'openTask', id: this.getAttribute('data-id') });
      });
    }
  </script>
</body>
</html>`;
  }

  private dispose(): void {
    BacklogDetailPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

function badgeToneFor(statusBadge: string, kind: DetailItem["kind"]): string {
  if (kind === "sprint") return "sprint";
  const status = Object.entries(STATUS_LABELS).find(([, label]) => label === statusBadge)?.[0];
  return status ?? "sprint";
}
