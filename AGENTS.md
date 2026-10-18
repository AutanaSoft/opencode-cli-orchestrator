# Repository Development Guidance

Repository-specific guidance for this documentation and configuration project.

## Repository Structure

- Consult `README.md` for project overview, prerequisites, and installation instructions.
- The distributable OpenCode configuration is under `src/`.
- `src/AGENTS.md` contains the general instructions distributed with OpenCode; keep those instructions separate from
  repository-specific development guidance.

## Formatting

- Follow `.editorconfig` and `.prettierrc`. Prettier takes precedence for overlapping formatting options.
- For Markdown, run Prettier before `markdownlint-cli2`, using `.markdownlint-cli2.jsonc`.

## Verification

- Run `pnpm check` for formatting and Markdown lint verification.
- Build and test scripts are not currently defined; do not assume they exist.
