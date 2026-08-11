---
id: "FE-STORY-001"
type: "story"
status: "todo"
priority: "high"
severity: null
assignee: null
reporter: null
labels: ["editor", "integration"]
components: ["tui"]
story_points: 8
epic: "FE-EPIC-001"
sprint: "FE-SPRINT-001"
fix_version: null
resolution: null
parent: null
children: []
depends_on: []
blocks: []
related_to: ["FE-TASK-001", "FE-TASK-002"]
due_date: null
created: "2026-06-13"
updated: "2026-06-13"
---
## Summary
Editor integrations for external tools
## Description
As a user I want to open task files from any editor so that I can edit frontmatter without leaving my tool.
- Vim/Neovim: backlog.nvim plugin
- VS Code: Backlog Explorer extension
- Emacs: terminal mode
## Acceptance Criteria
- [ ] Task file opens in the active editor
- [ ] Editor command is configurable
- [ ] Works when running inside a terminal multiplexer
