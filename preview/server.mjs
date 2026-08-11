/**
 * Browser preview for the Backlog Explorer extension.
 *
 * A VS Code extension has no in-browser UI, so this server renders the exact
 * output of the shared parser (bundled into preview/parser.cjs by esbuild)
 * against the sample .backlog fixture — the same data model the extension
 * shows in its sidebar tree and detail view.
 *
 * Re-parses the fixture on every request, so editing fixture files while the
 * preview is open is reflected immediately.
 */

import http from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARSER_PATH = path.join(__dirname, "parser.cjs");
const FIXTURE_ROOT = path.resolve(
  __dirname,
  "..",
  "src",
  "test",
  "fixtures",
  "sample-backlog",
  ".backlog"
);
const HOST = "0.0.0.0";
const DEFAULT_PORT = 4173;

if (!existsSync(PARSER_PATH)) {
  console.error("preview/parser.cjs not found — run `bun run build` first");
  process.exit(1);
}

const { loadBacklog, statusCounts, STATUS_LABELS, STATUS_ORDER } = await import(PARSER_PATH);

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function badge(tone, text) {
  return `<span class="badge tone-${tone}">${esc(text)}</span>`;
}

function taskCard(task, projectName) {
  const labels = (task.labels ?? [])
    .map((l) => `<span class="chip">${esc(l)}</span>`)
    .join("");
  const meta = [
    task.priority && esc(task.priority),
    task.story_points != null ? `${esc(task.story_points)} pts` : "",
    task.assignee && `@${esc(task.assignee)}`,
    task.sprint && esc(task.sprint),
    task.epic && esc(task.epic),
  ]
    .filter(Boolean)
    .join(" · ");
  return `
    <article class="card">
      <div class="card-top">
        <span class="task-id">${esc(task.id)}</span>
        ${badge("type", task.type)}
        ${badge(task.status, STATUS_LABELS[task.status])}
        ${task.severity ? badge("severity", task.severity) : ""}
      </div>
      <h4>${esc(task.summary || task.id)}</h4>
      ${meta ? `<div class="meta">${meta}</div>` : ""}
      ${labels ? `<div class="labels">${labels}</div>` : ""}
    </article>`;
}

function render(backlog) {
  const counts = statusCounts(backlog.allTasks);
  const summary = STATUS_ORDER.filter((s) => counts[s] > 0)
    .map((s) => `<span class="count">${STATUS_LABELS[s]} <b>${counts[s]}</b></span>`)
    .join("");

  const statusColumns = STATUS_ORDER.filter((s) => counts[s] > 0)
    .map((s) => {
      const tasks = backlog.allTasks
        .filter((t) => t.status === s)
        .sort((a, b) => a.id.localeCompare(b.id));
      return `
        <section class="column">
          <h3>${STATUS_LABELS[s]} <span class="pill">${tasks.length}</span></h3>
          ${tasks.map((t) => taskCard(t, backlog.current.config.name)).join("")}
        </section>`;
    })
    .join("");

  const epics = [...backlog.allEpics.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (ep) => `
      <article class="card epic">
        <div class="card-top">
          <span class="task-id">${esc(ep.id)}</span>
          ${badge("type", "epic")}
          ${badge(ep.status, STATUS_LABELS[ep.status])}
        </div>
        <h4>${esc(ep.name)}</h4>
        <div class="meta">${ep.children.length} task${ep.children.length === 1 ? "" : "s"} · ${esc(ep.priority)}</div>
      </article>`
    )
    .join("");

  const sprints = backlog.current.sprints
    .map(
      (sp) => `
      <article class="card sprint">
        <div class="card-top">
          <span class="task-id">${esc(sp.id)}</span>
          ${badge("type", "sprint")}
        </div>
        <h4>${esc(sp.name)}</h4>
        <div class="meta">${esc(sp.start || "")} → ${esc(sp.end || "")} · ${esc(sp.goal || "")}</div>
      </article>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Backlog Explorer — preview</title>
<style>
  :root {
    --bg: #0f1115; --panel: #171a21; --panel2: #1d212b; --border: #2a2f3a;
    --fg: #e8eaf0; --muted: #9aa3b2; --accent: #6ea8ff;
    --todo: #565f66; --in-progress: #0a6bb5; --review: #6c3bbf; --on-hold: #a56a00;
    --done: #1e7a34; --cancelled: #b42323;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg);
         font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif; }
  header { padding: 28px 40px 20px; border-bottom: 1px solid var(--border); }
  header h1 { margin: 0 0 6px; font-size: 22px; font-weight: 650; letter-spacing: -0.01em; }
  header p { margin: 0; color: var(--muted); font-size: 13px; max-width: 720px; line-height: 1.5; }
  .counts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
  .count { background: var(--panel); border: 1px solid var(--border); border-radius: 999px;
           padding: 4px 12px; font-size: 12px; color: var(--muted); }
  .count b { color: var(--fg); }
  main { padding: 24px 40px 60px; }
  .board { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; align-items: start; }
  .column { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
  .column h3 { margin: 0 0 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
  .pill { background: var(--panel2); border-radius: 999px; padding: 1px 8px; font-size: 11px; color: var(--fg); }
  .card { background: var(--panel2); border: 1px solid var(--border); border-radius: 8px;
          padding: 12px; margin-bottom: 10px; }
  .card h4 { margin: 8px 0 6px; font-size: 13.5px; font-weight: 550; line-height: 1.4; }
  .card-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .task-id { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11.5px; color: var(--muted); }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 10.5px;
           font-weight: 650; text-transform: uppercase; letter-spacing: 0.04em; }
  .tone-todo { background: var(--todo); color: #fff; }
  .tone-in-progress { background: var(--in-progress); color: #fff; }
  .tone-review { background: var(--review); color: #fff; }
  .tone-on-hold { background: var(--on-hold); color: #fff; }
  .tone-done { background: var(--done); color: #fff; }
  .tone-cancelled { background: var(--cancelled); color: #fff; }
  .tone-type { background: #3d4350; color: var(--fg); }
  .tone-severity { background: #8a2f2f; color: #fff; }
  .meta { font-size: 12px; color: var(--muted); }
  .labels { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 5px; }
  .chip { background: var(--panel); border: 1px solid var(--border); border-radius: 999px;
          padding: 1px 8px; font-size: 10.5px; color: var(--muted); }
  h2.section { margin: 34px 0 14px; font-size: 15px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  footer { padding: 16px 40px 30px; color: var(--muted); font-size: 12px; border-top: 1px solid var(--border); }
  footer code { background: var(--panel); padding: 1px 6px; border-radius: 4px; }
</style>
</head>
<body>
  <header>
    <h1>Backlog Explorer</h1>
    <p>This preview renders the exact output of the extension's shared parser against the sample
       <code>.backlog</code> fixture. In VS Code, the same data appears in the Backlog sidebar view,
       grouped by status, with a detail panel per task.</p>
    <div class="counts">${summary}</div>
  </header>
  <main>
    <h2 class="section">Tasks by status</h2>
    <div class="board">${statusColumns}</div>
    ${epics ? `<h2 class="section">Epics</h2><div class="grid">${epics}</div>` : ""}
    ${sprints ? `<h2 class="section">Sprints</h2><div class="grid">${sprints}</div>` : ""}
  </main>
  <footer>
    Data source: <code>${esc(FIXTURE_ROOT)}</code> — parsed fresh on every request.
  </footer>
</body>
</html>`;
}

export function createServer() {
  return http.createServer((req, res) => {
    if (req.url !== "/" && req.url !== "/index.html") {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    try {
      const backlog = loadBacklog(FIXTURE_ROOT);
      const html = render(backlog);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(`Failed to load backlog: ${err.message}`);
    }
  });
}

// Start the server when run directly (`bun run preview` / `node preview/server.mjs`).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  const server = createServer();
  server.listen(port, HOST, () => {
    console.log(`Backlog preview listening on http://${HOST}:${port}`);
  });
}
