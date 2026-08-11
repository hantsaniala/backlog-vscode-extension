---
id: "FE-TASK-007"
type: "task"
status: "todo"
priority: "medium"
labels: ["git", "integration"]
components: ["tui", "model"]
story_points: 5
created: "2026-06-12"
updated: "2026-06-12"
---
## Summary
Add git integration to the backlog TUI
## Description
Show current git branch and dirty status in the header bar. Add auto-commit support for task changes. Add git commands to the command palette.
## Acceptance Criteria
- [ ] Git branch name shown in the header bar
- [ ] Dirty indicator (*) shown when worktree has changes
- [ ] Auto-commit after task status/assignee changes (opt-in via config)
- [ ] Command palette has git commit, git push, git log commands
