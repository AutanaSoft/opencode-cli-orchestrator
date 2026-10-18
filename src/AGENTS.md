# AGENTS — General Rules

## Scope and Applicable Instructions

- These general instructions apply to every agent, regardless of role or working environment.
- Consult applicable local instructions and available configuration before making changes. Do not assume specific
  languages, tools, or workflows.
- Treat instructions already supplied by the environment as available context; avoid rereading them mechanically.
  Consult the original files when context is incomplete, ambiguous, possibly outdated, when entering a subdirectory with
  specific instructions, or when independent verification is required.
- If conflicting instructions materially affect the work, communicate the conflict and ask for clarification. Do not
  assume it can be resolved automatically.

## Conversation Scope and Authorization

- Keep each conversation focused on one concrete goal or deliverable; do not automatically include all pending work.
- Before starting new work, determine whether a new request continues the current goal or introduces an independent one.
  Clarifications, corrections, tests, and reviews of the current goal belong to the same conversation.
- If the goal is clearly independent, briefly explain the scope change, recommend a new chat, and ask whether the user
  prefers to open one or continue here. Do not repeat the question if the user has already expressed that preference.
- Asking “what next” authorizes you to explain possible next steps, not to carry them out.
- Do not include improvements, maintenance, or additional tasks discovered during the work without agreeing on their
  scope.
- Distinguish requests for analysis, review, or planning from authorization to modify files. A request for a proposal
  does not authorize implementing it.
- If the user has explicitly authorized a clear scope change, do not ask for redundant approval. Ask only about
  decisions that materially affect the outcome, scope, or risk.
- Respect the active mode's restrictions and effective permissions. Verbal authorization does not enable operations that
  the environment does not allow.

## Communication

- Respond in the user's current language unless explicitly requested otherwise or quotation and translation require it.
- Keep responses concise, direct, professional, and technically neutral. Preserve the evidence, risks, decisions, and
  blockers needed to understand the result.
- Distinguish verified observations, inferences, estimates, and pending assumptions.
- Ask only genuinely blocking questions. Ask one question at a time unless a workflow requires an indivisible grouped
  decision; preserve its original options.
- For a blocking decision, first gather the evidence, ask the question once in the turn, stop, and wait. Do not repeat
  it or add a final report afterward.
- If a technically incorrect claim is identified, correct it with evidence; if your own claim is wrong, acknowledge and
  correct it.
- Do not replace the final user-facing response with internal logs or tool results.

## Conversation and Artifact Language

- The conversation language is independent of the language used for technical artifacts.
- Use English by default for technical artifacts: technical documentation, code comments, tests, fixtures, interface
  text, and other technical content.
- An explicit user request about an artifact's language takes precedence; otherwise, follow existing repository
  conventions and use English only if they do not establish another language.
- Use a neutral, professional register in technical artifacts, regardless of the conversational style.
- Public or contextual comments follow the language and register of their environment unless instructed otherwise.

## Inspection and Evidence

- Prefer known entry points and specific sources over broad recursive searches. Expand the inspection only when the
  evidence is insufficient.
- Do not invent APIs, parameters, commands, conventions, execution results, or environment behavior.
- Verify external facts against official documentation applicable to the version in use, and internal facts against
  available code, configuration, and tests.
- Identify relevant sources when substantiating technical decisions: URL and version where applicable, or concrete
  project files and references.
- If a verification could not be run or a fact remains uncertain, say so rather than presenting the work as verified.
- When reporting defects, distinguish where relevant whether they were introduced, pre-existing, triggered, aggravated,
  or of unknown causality.
- Do not repeat failed attempts without a new, verifiable hypothesis. Report what failed and what is needed to continue.

## Code and Documentation Style

- Follow the conventions and formats applicable to each file. If no explicit configuration exists, preserve the existing
  style.
- Use available formatters, linters, and analyzers according to the established workflow; do not assume tools or weaken
  rules to hide problems.
- Do not manually format generated files unless the workflow calls for it.
- Any exception to formatting, linting, or type rules requires in-scope authorization and a localized justification.
- Document contracts, effects, and non-obvious restrictions of exports; avoid redundant documentation or self-evident
  helpers.
- Comments should explain intent, decisions, or limitations, not repeat the code literally.
- Do not keep commented-out code as a backup of previous versions when version control is available.
- Code, documentation, tests, commits, and interface text must follow repository conventions, not the conversational
  response style.

## Changes and Verification

- Before changing files, identify the relevant conventions, protected areas, and appropriate checks.
- Use the smallest change scope compatible with the authorized goal.
- Treat pre-existing user modifications as intentional. Do not revert, overwrite, or clean up changes unrelated to the
  task without explicit authorization.
- For non-trivial changes, present a brief plan before implementation; when the authorized scope is clear, proceed
  without requesting further approval.
- Run relevant checks permitted by the environment and report their actual results. For read-only reviews, do not run
  checks that write to or alter the environment.
- If you change content after a review or validation, re-review the affected parts where appropriate.
- Report modified files, checks run and omitted, errors, risks, and pending work in proportion to the task.

## Commits and Pushes

- Do not create commits or push without an explicit user request; authorization to edit does not include publishing
  changes.
- If preparing an authorized commit, use the `commit-message` skill when available.
