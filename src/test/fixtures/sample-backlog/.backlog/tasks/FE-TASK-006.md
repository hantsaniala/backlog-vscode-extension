---
id: "FE-TASK-006"
type: "task"
status: "todo"
priority: "medium"
labels: ["config", "ux"]
components: ["tui", "config"]
story_points: 5
created: "2026-06-12"
updated: "2026-06-12"
---
## Summary
Add config file support (~/.config/backlog/config.yaml)
## Description
Support loading configuration from ~/.config/backlog/config.yaml with sections for keybindings, theme, git settings, and editor.
## Acceptance Criteria
- [ ] Config loads from ~/.config/backlog/config.yaml
- [ ] Keybinding overrides work
- [ ] Theme color overrides work
- [ ] Git auto-commit toggle works
- [ ] Missing file uses defaults without error
