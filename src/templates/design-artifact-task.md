# Design Artifact Task

## Task Metadata

- Contract: `design-artifact`
- Template version: `1`
- Required capability: `worker`
- Write permission: `docs-only`
- Task fingerprint: `{{TASK_FINGERPRINT}}`

## Contract Behavior

You are the sole writer for the listed documentation artifacts. Write only to the exact allowlisted paths. Do not modify
code, executable configuration, tests, manifests, lockfiles, migrations, generated artifacts, or unlisted paths. Do not
install dependencies, mutate external state, perform Git operations that publish changes, or create nested workers.
Preserve user changes. The docs-only restriction is contractual; AutanaSoft validates the resulting paths and content.

### Authorship Requirements

{{AUTHORSHIP_REQUIREMENTS}}

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

`docs-only`. Only the listed documentation paths may be written.

## Write Scope

{{WRITE_SCOPE}}

### Artifact Paths

{{ARTIFACT_PATHS}}

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
