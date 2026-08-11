---
id: "FE-TASK-002"
type: "task"
status: "done"
priority: "medium"
severity: null
assignee: null
reporter: null
labels: ["go", "tui", "neovim-integration"]
components: ["tui", "cli"]
story_points: 3
epic: null
sprint: null
fix_version: null
resolution: null
parent: null
children: []
depends_on: []
blocks: []
related_to: ["FE-TASK-001", "FE-TASK-003"]
due_date: null
created: "2026-06-12"
updated: "2026-06-12"
---
## Summary
Add --editor flag and $NVIM detection to Go binary
## Description
Add CLI flags and Neovim detection to the Go binary so that:
1. --editor flag specifies which editor to use (default: $EDITOR or "nvim")
2. --wait flag makes backlog wait on exit for the Neovim plugin
3. Detect $NVIM env var to know we're running inside Neovim
4. Detect $VIM_FILENAME to determine the current project's .backlog/ path
These flags enable the backlog.nvim plugin to communicate bidirectionally.
## Acceptance Criteria
- [ ] --editor flag is parsed and defaults to $EDITOR or "nvim"
- [ ] --wait flag makes backlog pause briefly on exit
- [ ] $NVIM is detected and accessible in the Go code
- [ ] Binary passes information back to the Neovim plugin for file opening
