/**
 * Verifies the preview server boots, serves the rendered backlog, and the
 * page contains tasks, epics, and sprints from the fixture. Runs in-process
 * and exits, so it leaves no server behind.
 */

import { createServer } from "./server.mjs";

const server = createServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

try {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/`);
  const text = await res.text();

  if (res.status !== 200) {
    console.error(`preview smoke failed: HTTP ${res.status}`);
    process.exit(1);
  }

  const needles = [
    "FE-TASK-001",
    "FE-BUG-001",
    "FE-EPIC-001",
    "FE-SPRINT-001",
    "Tasks by status",
    "Todo",
    "In Progress",
  ];
  const missing = needles.filter((n) => !text.includes(n));
  if (missing.length > 0) {
    console.error(`preview smoke failed: missing content: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("preview smoke OK — server serves parsed backlog");
} finally {
  server.close();
}
