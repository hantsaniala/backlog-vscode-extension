---
id: "FE-TASK-003"
type: "task"
status: "done"
priority: "medium"
severity: null
assignee: null
reporter: null
labels: ["go", "tui", "editor-integration"]
components: ["tui"]
story_points: 3
epic: null
sprint: null
fix_version: null
resolution: null
parent: null
children: []
depends_on: ["FE-TASK-002"]
blocks: []
related_to: ["FE-TASK-001", "FE-TASK-002"]
due_date: null
created: "2026-06-12"
updated: "2026-06-12"
---
## Summary
Add Enter-opens-task-file in detail view
## Description
When pressing Enter on a task in detail view (or from the task list), open the task's .backlog/tasks/<ID>.md file in the configured editor.
1. In standalone mode: open with $EDITOR or "nvim"
2. Inside Neovim ($NVIM detected): open with nvim --remote-send or write the file path to stdout on exit
3. The task file path is: <backlogRoot>/tasks/<task.Filename>
This makes the TUI feel like lazygit where Enter opens the file.
## Acceptance Criteria
- [ ] Enter in task detail opens the task markdown file in the editor
- [ ] Works with --editor flag
- [ ] Works inside Neovim (detects $NVIM)
- [ ] Non-modal: the TUI doesn't block while editor is open
- [ ] Error message shown if editor command fails
