# Review Task

## Task Metadata

- Contract: `review`
- Template version: `1`
- Required capability: `review`
- Write permission: `none`
- Task fingerprint: `{{TASK_FINGERPRINT}}`

## Contract Behavior

Review without modifying files. Prioritize defects, regressions, unsafe permissions, missing tests, and contract
violations. Do not apply fixes, install or update dependencies, change lockfiles, run migrations or destructive
operations, mutate external state, perform Git operations that publish changes, or create nested workers. Do not expand
the review. Separate defects, questions, residual risks, and unverified coverage.

### Review Target

{{REVIEW_TARGET}}

### Review Baseline

{{REVIEW_BASELINE}}

### Severity Model

{{SEVERITY_MODEL}}

## Goal

{{OBJECTIVE}}

## Expected Result

{{EXPECTED_RESULT}}

## Known Context

{{KNOWN_CONTEXT}}

## Applicable Repository Instructions

{{APPLICABLE_REPOSITORY_INSTRUCTIONS}}

## Read Scope

{{READ_SCOPE}}

## Write Permission

`none`. Return findings to AutanaSoft; do not apply any fixes.

## Write Scope

{{WRITE_SCOPE}}

## Protected Areas and User Changes

{{PROTECTED_AREAS}}

## Constraints

{{CONSTRAINTS}}

## Acceptance Criteria

{{ACCEPTANCE_CRITERIA}}

## Validation

{{VALIDATION_COMMANDS}}

## Required Evidence

{{REQUIRED_EVIDENCE}}

## Return Format

{{RETURN_FORMAT}}

## Stop Conditions and Return of Control

{{STOP_CONDITIONS}}
