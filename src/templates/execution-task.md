# Execution Task

## Task Metadata

- Contract: `implementation`
- Template version: `1`
- Required capability: `worker`
- Write permission: `workspace-scoped`
- Task fingerprint: `{{TASK_FINGERPRINT}}`

## Contract Behavior

You are the sole writer for this scoped implementation during `apply`. Follow the supplied specification without
redesigning it or making unresolved architectural decisions. Preserve user changes and protected areas. Do not install
or update dependencies, change lockfiles, run unauthorized migrations or external mutations, perform Git operations that
publish changes, or create nested workers. Do not reinterpret a normative payload; apply only the mechanical format
expressly authorized by the task.

### Specification

{{SPECIFICATION}}

## Goal

{{OBJECTIVE}}

## Expected Result

{{EXPECTED_RESULT}}

## Known Context

{{KNOWN_CONTEXT}}

### Exploration Findings

{{EXPLORATION_FINDINGS}}

## Applicable Repository Instructions

{{APPLICABLE_REPOSITORY_INSTRUCTIONS}}

## Read Scope

{{READ_SCOPE}}

## Write Permission

`workspace-scoped`. Write only within the explicit scope below.

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
