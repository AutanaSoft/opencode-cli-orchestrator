# Synthesis Task

## Task Metadata

- Contract: `synthesis`
- Template version: `1`
- Required capability: `explore`
- Write permission: `none`
- Task fingerprint: `{{TASK_FINGERPRINT}}`

## Contract Behavior

Synthesize only from the evidence provided. Do not broadly investigate missing material, create, modify, rename, or
delete files, implement, install or update dependencies, change lockfiles, run migrations, mutate external state,
perform Git operations that publish changes, or create nested workers. Do not alter supplied decisions. Return a
self-contained, traceable result. Return control when material input evidence is missing.

### Source Material

{{SOURCE_MATERIAL}}

### Decisions to Preserve

{{DECISIONS_TO_PRESERVE}}

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

`none`. Return the result to AutanaSoft; do not write it to the workspace.

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
