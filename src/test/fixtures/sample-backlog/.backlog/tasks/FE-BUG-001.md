---
id: "FE-BUG-001"
type: "bug"
status: "in-progress"
priority: "critical"
severity: "major"
assignee: "hantsaniala"
reporter: "qa-bot"
labels: ["crash", "navigation"]
components: ["tui", "model"]
story_points: 2
epic: null
sprint: "FE-SPRINT-001"
fix_version: null
resolution: null
parent: null
children: []
depends_on: ["FE-TASK-004"]
blocks: []
related_to: []
due_date: "2026-06-20"
created: "2026-06-14"
updated: "2026-06-16"
---
## Summary
Crash when sprint goal references a missing task
## Description
Opening the sprint view crashes when the sprint's goal references a task ID that does not exist in tasks/. The sprint view should render the missing reference as a warning instead of panicking.
## Acceptance Criteria
- [ ] Sprint view renders with missing task references
- [ ] Missing references shown inline as warnings
- [ ] No panic when goal references a task from another project
