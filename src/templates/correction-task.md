# Correction Task

## Task Metadata

- Contract: `correction`
- Template version: `1`
- Required capability: `worker`
- Write permission: `workspace-scoped`
- Task fingerprint: `{{TASK_FINGERPRINT}}`

## Contract Behavior

Perform exactly one scoped correction during `apply`. Preserve the original goal, decisions, protected areas, and scope.
Do not add features, expand the scope, redesign, change dependencies or lockfiles without explicit authorization, run
unauthorized migrations or external mutations, perform Git operations that publish changes, or create nested workers.
Stop if the failure requires new exploration, design, or an architectural decision.

### Original Goal

{{ORIGINAL_OBJECTIVE}}

### Failure Evidence

{{FAILURE_EVIDENCE}}

### Original Acceptance Criteria

{{ORIGINAL_ACCEPTANCE_CRITERIA}}

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

`workspace-scoped`. Write only within the original correction scope.

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
