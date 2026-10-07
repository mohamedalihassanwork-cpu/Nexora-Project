
# Nexora Task Execution Template

You are implementing ONE task from the Nexora project.

Your job is to implement the assigned task exactly according to the existing Nexora requirements, finalized architecture, user flows, technology decisions, design system, and implementation task plan.

You MUST treat the following documents as the source of truth:

- `docs/Nexora — Project Requirements.md`
- `docs/Nexora — User Flow & Edge Cases Specification.md`
- `docs/Nexora — System and Data Architecture.md`
- `docs/Nexora — Technology Stack & Implementation Architecture.md`
- `docs/DESIGN (2).md`
- `docs/Nexora — Implementation Task Plan.md`

You must also inspect the existing repository code before making changes.

## IMPORTANT RULES

DO NOT change, reinterpret, override, or replace any finalized architectural decision, business rule, data model decision, workflow, security rule, financial rule, or technology decision.

DO NOT introduce a new architecture, framework, library, pattern, database structure, or workflow unless it is clearly required by the existing approved architecture.

Reuse existing project conventions, patterns, utilities, components, services, validations, and abstractions whenever they already exist.

Do not perform unrelated refactoring, cleanup, redesign, optimization, or feature work outside the assigned task.

Do not invent missing business decisions. If something is genuinely undefined, identify it explicitly instead of silently deciding it.

The assigned task must remain within its defined scope and acceptance criteria.

Never mark a task as complete unless its acceptance criteria have actually been implemented and verified.

Never claim that a test, build, migration, commit, or verification succeeded unless it actually succeeded.

---

# PHASE 1 — REPOSITORY & SOURCE ANALYSIS

Before writing code:

- Read the relevant source documents.
- Inspect the existing repository structure.
- Inspect all relevant files, modules, models, APIs, services, components, migrations, and tests.
- Identify existing implementation patterns that should be reused.
- Verify task dependencies and whether prerequisite tasks are already implemented.
- Determine the current state of the task in the implementation task plan.
- Identify any existing changes that may affect this task.
- Do not start implementation yet.

---

# PHASE 2 — IMPLEMENTATION PLAN

Create a detailed implementation plan for the task before coding.

The plan MUST include:

## Task

- Task ID
- Task title
- Scope
- Acceptance criteria

## Current State

- What already exists
- Relevant files/modules
- Existing patterns to reuse
- Existing related implementation

## Implementation Steps

- Exact changes required
- Files/modules expected to change
- Database changes, if any
- API changes, if any
- UI changes, if any
- Tests required

## Dependency & Impact Analysis

- Dependencies
- Cross-module impact
- Potential regression areas
- Security or concurrency implications where relevant

## Architecture Compliance Check

Explicitly compare the planned implementation against:

- Project Requirements
- User Flow & Edge Cases
- System/Data Architecture
- Technology Stack & Implementation Architecture
- Design System
- Implementation Task Plan

## Deviations / Conflicts

Explicitly state:

- Architectural deviations: NONE / listed items
- Business-rule deviations: NONE / listed items
- Data-model deviations: NONE / listed items
- Technology-stack deviations: NONE / listed items
- Scope deviations: NONE / listed items

If any proposed implementation conflicts with an approved architectural or business decision:

- Clearly identify the conflict.
- Explain why the conflict exists.
- Do NOT resolve the conflict yourself.
- Do NOT continue to implementation.

# APPROVAL GATE

After completing the Implementation Plan:

- Present the full Implementation Plan.
- Present all identified deviations, conflicts, assumptions, dependencies, and risks.
- Do NOT write, modify, create, or delete implementation code.
- Do NOT modify the database.
- Do NOT modify the implementation task status.
- Do NOT mark the task as DONE.
- Do NOT create a git commit.
- STOP and WAIT for explicit approval from me.

Only continue to PHASE 3 after explicit approval of the Implementation Plan.

---

# PHASE 3 — IMPLEMENTATION

After explicit approval:

Implement the task according to the approved Implementation Plan.

Requirements:

- Follow the approved implementation plan.
- Keep changes minimal and task-scoped.
- Preserve the finalized architecture.
- Follow existing coding conventions.
- Reuse existing abstractions whenever possible.
- Add proper validation and error handling.
- Apply authorization and security rules where relevant.
- Preserve transactional and concurrency guarantees where relevant.
- Never log secrets or sensitive customer data.
- Add or update migrations through the project's approved migration workflow.
- Do not introduce unrelated changes.
- Do not silently change approved requirements or architecture.

If implementation reveals a conflict with an approved decision that was not identified during planning:

**STOP.**

Report the conflict and wait for further instruction instead of making an architectural or business decision yourself.

---

# PHASE 4 — TESTING & VERIFICATION

After implementation:

- Run relevant unit tests.
- Run integration tests where applicable.
- Run database/concurrency tests where applicable.
- Run API/E2E tests where applicable.
- Run typecheck.
- Run lint.
- Run build when relevant.
- Inspect the final git diff.
- Verify database migrations where applicable.
- Verify that no unrelated files or behavior were changed.
- Verify EVERY acceptance criterion explicitly.

Do not mark the task complete if any acceptance criterion is not satisfied.

# PHASE 5 — UPDATE IMPLEMENTATION TASK PLAN

Only after successful implementation and verification:

Update:

`docs/Nexora — Implementation Task Plan.md`

Mark the implemented task as:

`STATUS: DONE`

Do not change the task's original:

- Scope
- Requirements
- Dependencies
- Acceptance Criteria

Only update its completion status and completion metadata if the existing task-plan format supports such metadata.

# PHASE 6 — GIT COMMIT

After the task has been successfully implemented, verified, and marked DONE:

Create a git commit containing only the changes related to this task.

Use this format:

TASK-ID> short task description

Example:

feat(NEX-008): implement catalog management

Do not commit unrelated changes.

Verify that the commit succeeded and capture the commit hash.

# FINAL REPORT

Return the following:

## Task

Task ID:  
Task Title:  
Status: DONE / BLOCKED

## Implementation Summary

Describe what was implemented.

## Files Changed

List the relevant files changed.

## Database Changes

None / describe the database changes.

## Tests & Verification

List every relevant verification performed and its result.

## Acceptance Criteria

For every acceptance criterion:

✅ PASS  
❌ FAIL

## Architecture Compliance

Confirm whether the implementation follows the approved architecture and finalized decisions.

## Deviations

NONE

or explicitly list any deviations, conflicts, or approved exceptions.

## Task Plan

Confirm that the task was marked STATUS: DONE in:

`docs/Nexora — Implementation Task Plan.md`

## Git Commit

Commit:

`commit hash`

Commit Message:

`commit message`

## Notes

Only include important implementation notes, risks, or limitations.