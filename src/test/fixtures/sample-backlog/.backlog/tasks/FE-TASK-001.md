---
id: "FE-TASK-001"
type: "task"
status: "done"
priority: "high"
severity: null
assignee: null
reporter: null
labels: ["neovim", "plugin", "lazyvim"]
components: ["neovim-plugin", "tui"]
story_points: 5
epic: null
sprint: null
fix_version: null
resolution: null
parent: null
children: []
depends_on: []
blocks: []
related_to: ["FE-TASK-002"]
due_date: null
created: "2026-06-12"
updated: "2026-06-12"
---
## Summary
Create backlog.nvim Neovim plugin for LazyVim integration
## Description
Create a separate Neovim plugin repository (backlog.nvim) that:
1. Opens the backlog TUI in a floating terminal window inside Neovim
2. Provides :Backlog command and configurable keybinding (default <leader>b)
3. Passes the current project's .backlog/ path via --path flag
4. Works with LazyVim plugin system via standard opts spec
5. Supports toggle behavior (same action opens and closes)
6. Auto-detects Neovim environment and passes it to the backlog binary
## Acceptance Criteria
- [ ] Plugin can be installed via LazyVim spec: { "hantsaniala/backlog.nvim" }
- [ ] :Backlog command opens backlog in a floating terminal
- [ ] Default keybinding <leader>b toggles the backlog window
- [ ] CWD-based --path detection works correctly
- [ ] $NVIM env var is passed to the backlog binary
- [ ] Toggle behavior works (open/close with same key)
- [ ] README with installation and setup instructions
