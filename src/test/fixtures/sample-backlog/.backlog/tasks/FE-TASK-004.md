---
id: "FE-TASK-004"
type: "task"
status: "in-progress"
priority: "high"
labels: ["vim", "keybindings", "bug"]
components: ["tui"]
story_points: 1
created: "2026-06-12"
updated: "2026-06-12"
---
## Summary
Fix Esc-back from related/preview views in detail panel
## Description
Pressing Esc in the related items popup or task preview popup currently returns to the tree view instead of the parent detail view. Need to fix the back navigation chain:
detailNormal -> related -> preview
Esc should reverse the chain: preview -> related -> detail -> tree
## Acceptance Criteria
- [ ] Esc in preview popup returns to related list
- [ ] Esc in related list returns to detail view
- [ ] Esc in detail view returns to task tree
