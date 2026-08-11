---
id: "FE-TASK-005"
type: "task"
status: "todo"
priority: "high"
labels: ["vim", "keybindings", "navigation"]
components: ["tui"]
story_points: 3
created: "2026-06-12"
updated: "2026-06-12"
---
## Summary
Add vim motion enhancements to task list
## Description
Add marks, search repeat, block motions, scroll positioning, and word search to the task list view.
- Marks: m[a-z] to set, '[a-z] to jump
- Search repeat: n/N for next/previous search result
- Block motion: {/} to jump between epic boundaries
- Scroll: zt (top), zb (bottom)
- Word search: */# to search for word under cursor
## Acceptance Criteria
- [ ] m[a-z] sets a mark on the current task
- [ ] '[a-z] jumps to the marked task
- [ ] n/N cycles through search matches
- [ ] {/} jumps between epics
- [ ] zt/zb positions cursor at top/bottom of viewport
- [ ] */# searches for word under cursor
