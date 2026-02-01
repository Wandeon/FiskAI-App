# AI Agent Definitions

This document defines the roles, responsibilities, and workflows for AI agents working on the FiskAI codebase. All agents must adhere to these guidelines to ensure consistent, high-quality contributions.

---

## Claude Code (Primary Developer)

### Role

Architect & Primary Developer

### Responsibilities

- Writing production-ready code following established patterns
- Implementing features according to specifications
- Writing comprehensive tests for all new functionality
- Following the project structure defined in CLAUDE.md
- Maintaining code quality and consistency

### Must Always

- Read CLAUDE.md before starting any work
- Run lint and test commands before committing
- Use conventional commit messages (feat:, fix:, docs:, refactor:, test:, chore:)
- Update CHANGELOG.md for user-facing changes
- Follow TypeScript strict mode requirements
- Respect domain layer isolation

### Must Never

- Skip writing tests for new functionality
- Ignore TypeScript errors or warnings
- Add dependencies without clear justification
- Commit directly to main branch
- Leave code in a broken state
- Make changes outside the scope of the current task

---

## Code Reviewer

### Review Checklist

#### Architecture

- [ ] Domain layer isolation is maintained (no framework imports in domain/)
- [ ] Module boundaries are respected
- [ ] Dependencies flow inward (infrastructure -> application -> domain)
- [ ] No circular dependencies introduced
- [ ] Appropriate use of dependency injection

#### Code Quality

- [ ] TypeScript strict mode compliance (no errors)
- [ ] No use of `any` type (use `unknown` if necessary)
- [ ] Imports are properly ordered (external, internal, relative)
- [ ] Consistent naming conventions followed
- [ ] No dead code or unused imports
- [ ] Functions are appropriately sized and focused

#### Testing

- [ ] Tests exist for new functionality
- [ ] Tests are meaningful (not just coverage padding)
- [ ] No skipped tests (.skip or .only)
- [ ] Edge cases are covered
- [ ] Tests are deterministic (no flaky tests)

#### Security

- [ ] No hardcoded secrets, API keys, or credentials
- [ ] Input validation is present where needed
- [ ] No sensitive data logged
- [ ] Proper error handling (no stack traces exposed to users)
- [ ] Dependencies are from trusted sources

---

## Definition of Done

A feature or fix is considered complete when ALL of the following are true:

- [ ] No TODO or FIXME comments remain in the changed code
- [ ] No placeholder values (e.g., "Lorem ipsum", "test@example.com" in production code)
- [ ] No console.log statements (use proper logging if needed)
- [ ] All error states are handled and display user-friendly messages
- [ ] All loading states are handled with appropriate indicators
- [ ] All empty states are handled with meaningful UI
- [ ] Tests are written and passing
- [ ] Lint passes with no errors or warnings
- [ ] Works on mobile viewport (375px minimum)
- [ ] Works on desktop viewport
- [ ] Accessibility basics are met (keyboard navigation, screen reader support)
- [ ] Code has been self-reviewed before requesting review

---

## Workflows

### Feature Implementation

1. **Read Requirements**: Understand the feature specification completely
2. **Read CLAUDE.md**: Review project structure and conventions
3. **Plan Approach**: Outline the implementation strategy
4. **Create Branch**: Use naming convention `feat/description-of-feature`
5. **Write Tests First**: Define expected behavior through tests (TDD when practical)
6. **Implement Feature**: Write the minimum code to make tests pass
7. **Refactor**: Clean up code while keeping tests green
8. **Self-Review**: Check against Definition of Done checklist
9. **Run Quality Checks**: Execute `npm run lint` and `npm run test`
10. **Request Review**: Create PR with clear description and context

### Bug Fix

1. **Reproduce Bug**: Confirm the issue exists and understand the root cause
2. **Write Failing Test**: Create a test that reproduces the bug
3. **Fix the Bug**: Implement the minimal fix
4. **Verify Test Passes**: Confirm the fix resolves the issue
5. **Check for Regressions**: Run full test suite
6. **Document**: Update relevant documentation if behavior changed

---

## Communication Protocol

### Progress Reporting Format

When reporting progress, use this structure:

```
## Status: [In Progress | Blocked | Complete]

### Completed
- [List of completed items]

### In Progress
- [Current work item]
- Expected completion: [estimate]

### Blockers (if any)
- [Description of blocker]
- [What is needed to unblock]

### Next Steps
- [Upcoming work items]
```

### Escalation Criteria

Ask a human for guidance when:

- Requirements are ambiguous or contradictory
- A security decision needs to be made
- Breaking changes to public APIs are necessary
- Third-party service integration decisions are needed
- Performance tradeoffs require business input
- The task would take significantly longer than estimated
- Existing code quality issues block progress
- Dependency updates introduce breaking changes

---

## Quality Gates

### Before Commit

Verify all of the following before creating a commit:

- [ ] `npm run lint` passes with no errors
- [ ] `npm run test` passes with no failures
- [ ] `npm run build` completes successfully (if applicable)
- [ ] Changes are limited to the scope of the task
- [ ] Commit message follows conventional commits format
- [ ] No sensitive data in the commit

### Before PR Merge

Verify all of the following before approving/merging a PR:

- [ ] All CI checks pass
- [ ] Code review completed and approved
- [ ] All review comments addressed
- [ ] Branch is up to date with target branch
- [ ] No merge conflicts
- [ ] CHANGELOG.md updated (for user-facing changes)
- [ ] Documentation updated (if API or behavior changed)
- [ ] Definition of Done checklist complete

---

## Banned Phrases

The following phrases indicate incomplete or low-quality work. If you find yourself wanting to use them, stop and address the underlying issue instead:

| Banned Phrase                | What To Do Instead                                          |
| ---------------------------- | ----------------------------------------------------------- |
| "TS errors are preexisting"  | Fix the errors or create a separate PR to address tech debt |
| "Skipping this test for now" | Write the test or document why it's not needed              |
| "Loosening this type to any" | Use proper types, generics, or `unknown`                    |
| "This should work"           | Verify it works with tests and manual testing               |
| "I'll fix this later"        | Fix it now or create a tracked issue                        |
| "It works on my machine"     | Test in CI environment and document requirements            |
| "Just a quick hack"          | Implement properly or document as tech debt with issue      |
| "Probably fine"              | Verify with tests and evidence                              |

---

## Version History

| Version | Date       | Changes                   |
| ------- | ---------- | ------------------------- |
| 1.0.0   | 2026-02-01 | Initial agent definitions |
