import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractSection,
  extractSummary,
  findBacklogRoot,
  loadBacklog,
  loadProject,
  parseTask,
  priorityScore,
  splitFrontmatter,
  statusCounts,
  statusScore,
  tasksBySprint,
  tasksByStatus,
  validStoryPoints,
} from "../parser";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, "fixtures", "sample-backlog");
const BACKLOG_ROOT = path.join(FIXTURE, ".backlog");

function taskFile(name: string): string {
  return path.join(BACKLOG_ROOT, "tasks", name);
}

describe("frontmatter splitting", () => {
  test("splits YAML frontmatter from body", () => {
    const content = fs.readFileSync(taskFile("FE-TASK-001.md"), "utf8");
    const split = splitFrontmatter(content);
    expect(split).not.toBeNull();
    expect(split!.frontmatter).toContain('id: "FE-TASK-001"');
    expect(split!.body).toContain("## Summary");
  });

  test("returns null when frontmatter is missing", () => {
    expect(splitFrontmatter("# no frontmatter here")).toBeNull();
    expect(splitFrontmatter("---\nonly one separator")).toBeNull();
  });
});

describe("parseTask", () => {
  test("parses all fields of a task", () => {
    const task = parseTask(taskFile("FE-TASK-001.md"), "FE");
    expect(task.id).toBe("FE-TASK-001");
    expect(task.type).toBe("task");
    expect(task.status).toBe("done");
    expect(task.priority).toBe("high");
    expect(task.severity).toBeNull();
    expect(task.labels).toEqual(["neovim", "plugin", "lazyvim"]);
    expect(task.components).toEqual(["neovim-plugin", "tui"]);
    expect(task.story_points).toBe(5);
    expect(task.related_to).toEqual(["FE-TASK-002"]);
    expect(task.created).toBe("2026-06-12");
    expect(task.filename).toBe("FE-TASK-001.md");
    expect(task.projectID).toBe("FE");
  });

  test("extracts summary and description from the body", () => {
    const task = parseTask(taskFile("FE-TASK-001.md"), "FE");
    expect(task.summary).toBe(
      "Create backlog.nvim Neovim plugin for LazyVim integration"
    );
    expect(task.description).toContain("floating terminal window");
    expect(task.description).toContain("--path flag");
  });

  test("parses bug severity and optional-field defaults", () => {
    const task = parseTask(taskFile("FE-BUG-001.md"), "FE");
    expect(task.type).toBe("bug");
    expect(task.severity).toBe("major");
    expect(task.assignee).toBe("hantsaniala");
    expect(task.depends_on).toEqual(["FE-TASK-004"]);
    expect(task.sprint).toBe("FE-SPRINT-001");
    expect(task.children).toEqual([]);
  });

  test("applies defaults for missing frontmatter fields", () => {
    const task = parseTask(taskFile("FE-TASK-005.md"), "FE");
    // FE-TASK-005 omits severity/assignee/etc. entirely
    expect(task.severity).toBeNull();
    expect(task.labels).toEqual(["vim", "keybindings", "navigation"]);
    expect(task.depends_on).toEqual([]);
    expect(task.related_to).toEqual([]);
  });

  test("throws for files without frontmatter", () => {
    expect(() => parseTask(taskFile("FE-TASK-001.md").replace("FE-TASK-001", "nope"), "FE")).toThrow();
  });
});

describe("summary extraction (mirrors Go logic)", () => {
  test("takes the first line under ## Summary", () => {
    const body = "## Summary\nFirst summary line\n## Description\nbody here";
    expect(extractSummary(body)).toBe("First summary line");
  });
  test("falls back to the first non-header line", () => {
    expect(extractSummary("plain text first\n## More")).toBe("plain text first");
  });
  test("extracts a section between headers", () => {
    const body = "## Description\nline one\nline two\n## Acceptance Criteria\n- [ ] x";
    expect(extractSection(body, "## Description")).toBe("line one\nline two");
    expect(extractSection(body, "## Acceptance Criteria")).toBe("- [ ] x");
  });
});

describe("loadProject / loadBacklog", () => {
  test("loads tasks, epics, and sprints from the fixture", () => {
    const snap = loadProject(BACKLOG_ROOT);
    expect(snap.config.project_id).toBe("FE");
    expect(snap.config.name).toBe("Frontend Application");
    expect(snap.tasks.size).toBe(10);
    expect(snap.epics.has("FE-EPIC-001")).toBe(true);
    expect(snap.sprints).toHaveLength(1);
  });

  test("aggregates tasks sorted by id and links epic children", () => {
    const backlog = loadBacklog(BACKLOG_ROOT);
    expect(backlog.allTasks.map((t) => t.id)).toEqual(
      [...backlog.allTasks.map((t) => t.id)].sort()
    );
    const epic = backlog.allEpics.get("FE-EPIC-001")!;
    // Only tasks referencing the epic via the `epic` field are linked.
    expect(epic.children.map((c) => c.id)).toEqual(["FE-STORY-001"]);
  });

  test("computes status counts matching the dashboard", () => {
    const backlog = loadBacklog(BACKLOG_ROOT);
    const counts = statusCounts(backlog.allTasks);
    expect(counts.todo).toBe(5);
    expect(counts["in-progress"]).toBe(2);
    expect(counts.done).toBe(3);
    expect(counts.review).toBe(0);
    expect(counts["on-hold"]).toBe(0);
    expect(counts.cancelled).toBe(0);
  });

  test("groups tasks by status and sprint", () => {
    const backlog = loadBacklog(BACKLOG_ROOT);
    const todo = tasksByStatus(backlog.allTasks, "todo");
    expect(todo.map((t) => t.id)).toContain("FE-STORY-001");
    // Higher priority sorts first within a status
    expect(todo[0].priority).toBe("high");

    const sprintTasks = tasksBySprint(backlog.allTasks, "FE-SPRINT-001");
    expect(sprintTasks.map((t) => t.id).sort()).toEqual(["FE-BUG-001", "FE-STORY-001"]);
  });
});

describe("failure handling", () => {
  test("unparseable task files are skipped, not fatal", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "backlog-test-"));
    const root = path.join(tmp, ".backlog");
    fs.mkdirSync(path.join(root, "tasks"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "project.md"),
      '---\nproject_id: "T"\nname: "Test"\nexternal_projects: {}\n---\n'
    );
    fs.writeFileSync(path.join(root, "tasks", "T-TASK-001.md"), "# no frontmatter");
    fs.writeFileSync(
      path.join(root, "tasks", "T-TASK-002.md"),
      '---\nid: "T-TASK-002"\ntype: "task"\nstatus: "todo"\n---\n## Summary\nValid task\n'
    );
    try {
      const snap = loadProject(root);
      expect(snap.tasks.size).toBe(1);
      expect(snap.tasks.has("T-TASK-002")).toBe(true);
      expect(snap.tasks.has("T-TASK-001")).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("missing project.md makes loadBacklog throw", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "backlog-test-"));
    fs.mkdirSync(path.join(tmp, ".backlog", "tasks"), { recursive: true });
    try {
      expect(() => loadBacklog(path.join(tmp, ".backlog"))).toThrow();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("findBacklogRoot", () => {
  test("finds .backlog in the fixture directory", () => {
    expect(findBacklogRoot(FIXTURE)).toBe(BACKLOG_ROOT);
    // Also finds it from a nested subdirectory (walk-up).
    expect(findBacklogRoot(path.join(FIXTURE, ".backlog", "tasks"))).toBe(BACKLOG_ROOT);
  });

  test("returns null when no .backlog exists", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "backlog-test-"));
    try {
      expect(findBacklogRoot(tmp)).toBeNull();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("external projects", () => {
  function writeProject(root: string, projectID: string, taskId: string): void {
    const backlog = path.join(root, ".backlog");
    fs.mkdirSync(path.join(backlog, "tasks"), { recursive: true });
    fs.writeFileSync(
      path.join(backlog, "project.md"),
      `---\nproject_id: "${projectID}"\nname: "${projectID} project"\nexternal_projects: {}\n---\n`
    );
    fs.writeFileSync(
      path.join(backlog, "tasks", `${taskId}.md`),
      `---\nid: "${taskId}"\ntype: "task"\nstatus: "todo"\n---\n## Summary\n${taskId}\n`
    );
  }

  test("loads external projects and dedups repeated references", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "backlog-ext-"));
    try {
      const a = path.join(tmp, "projA");
      const b = path.join(tmp, "projB");
      writeProject(a, "A", "A-TASK-001");
      writeProject(b, "B", "B-TASK-001");
      // projA references projB three times (once with a mismatched prefix);
      // the duplicate paths must be loaded once, the mismatch skipped.
      fs.writeFileSync(
        path.join(a, ".backlog", "project.md"),
        `---\nproject_id: "A"\nname: "A"\nexternal_projects:\n  B: "../projB/.backlog"\n  B2: "../projB/.backlog"\n  X: "../projB/.backlog"\n---\n`
      );
      const backlog = loadBacklog(path.join(a, ".backlog"));
      expect(backlog.externals).toHaveLength(1);
      expect(backlog.externals[0].config.project_id).toBe("B");
      expect(backlog.allTasks.map((t) => t.id)).toEqual([
        "A-TASK-001",
        "B-TASK-001",
      ]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("skips externals pointing back at the current project", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "backlog-ext-"));
    try {
      const a = path.join(tmp, "projA");
      writeProject(a, "A", "A-TASK-001");
      fs.writeFileSync(
        path.join(a, ".backlog", "project.md"),
        `---\nproject_id: "A"\nname: "A"\nexternal_projects:\n  A: "../projA/.backlog"\n---\n`
      );
      const backlog = loadBacklog(path.join(a, ".backlog"));
      expect(backlog.externals).toHaveLength(0);
      expect(backlog.allTasks.map((t) => t.id)).toEqual(["A-TASK-001"]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("scores and validation", () => {
  test("status and priority ordering", () => {
    expect(statusScore("todo")).toBeLessThan(statusScore("in-progress"));
    expect(statusScore("done")).toBeLessThan(statusScore("cancelled"));
    expect(priorityScore("critical")).toBeLessThan(priorityScore("low"));
  });
  test("fibonacci story points", () => {
    expect(validStoryPoints(5)).toBe(true);
    expect(validStoryPoints(4)).toBe(false);
  });
});
