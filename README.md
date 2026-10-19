# OpenCode V2 — Hybrid Orchestrator

This repository distributes agents, instructions, and templates for OpenCode V2, along with a conservative local
installer. It does not install or run OpenCode.

The root `AGENTS.md` contains repository development guidance. `src/AGENTS.md` is part of the distributable
configuration and does not replace that guidance.

## Requirements

- Node.js >=22 and pnpm.
- OpenCode V2 and any providers/models you need must be installed and configured separately. Check that your account can
  use the models declared in `src/agents/`.

Install the repository dependencies with `pnpm install --frozen-lockfile`. This also prepares the local development
hooks.

## Install the Configuration

From the repository root:

```bash
pnpm install:opencode
```

The installer resolves the destination automatically, in this order:

1. `--config-dir <path>` (explicit override; if relative, resolved from the current directory).
2. `OPENCODE_CONFIG_DIR` (exact absolute path; `opencode` is not appended).
3. `XDG_CONFIG_HOME/opencode` if `XDG_CONFIG_HOME` contains an absolute path.
4. `HOME/.config/opencode`.

Therefore, you normally do not need to specify a path manually. Empty path variables are treated as undefined; if the
variable selected by precedence is not absolute, the installer fails without trying a lower-priority path. An explicit
`--config-dir` path takes precedence even when environment variables have invalid values.

`OPENCODE_CONFIG` identifies a configuration file, not the global directory. It does not affect resolution or get copied
as a separate file; if set, the installer displays a warning without revealing its value.

This precedence was corroborated through isolated tests with OpenCode 2.0.32; it is not presented as a documented
guarantee for all versions. The installer does not need to run or detect the `opencode` binary to resolve the
destination.

To choose a different destination, provide the override:

```bash
pnpm install:opencode --config-dir /path/to/opencode/config
```

To review operations without changing files, use the same automatic destination or an explicit override:

```bash
pnpm install:opencode:check
# Optional: pnpm install:opencode:check --config-dir /path/to/alternative
```

`--dry-run` does not create the destination, files, temporary files, backups, or child processes. The preview shows the
resolved destination, its source, paths, and actions—not configuration values or secrets. You can also run
`node scripts/install.mjs --help` directly to see the options. `--yes` confirms only safe operations without conflicts;
it never resolves conflicts or confirms dual-configuration consolidation. Without `--yes`, the updated full plan is
shown after conflicts are resolved, and final confirmation is requested before writing. The prompt displays
`[Y(es)/N(o)/C(ancel)]`: it accepts `Y`, `N`, `C`, or the full word, case-insensitively. Conflicts use
`K(eep)/R(eplace)/C(ancel)`, and consolidation uses `K(eep-jsonc)/T(ake-json)/C(ancel)`. An empty or invalid response
does not confirm anything. In non-interactive mode, an installation with changes stops unless `--yes` is provided; a run
with no changes does not request confirmation.

The six templates in `src/templates/` are always installed. Using them in agents or subsequent tasks is optional.
`AGENTS.md` and the four agents (`AutanaSoft`, `explore`, `worker`, and `review`) are also installed. Source files in
`src/` are not modified to adapt to the destination.

### Instruction Sources

The installer copies `src/AGENTS.md` to `AGENTS.md` in the selected configuration directory and installs agent
definitions under `agents/`. The repository root `AGENTS.md` is development guidance for this repository, not the
distributed shared orchestration rules.

OpenCode V2 loads the global `AGENTS.md` alongside applicable project instruction files. These sources are combined;
OpenCode does not automatically resolve conflicts between them. Project instructions remain separate from the shared
orchestration rules. See the official
[instruction loading and scope documentation](https://opencode.ai/v2/docs/instructions).

References to "shared orchestration rules" in AutanaSoft identify the general instructions supplied by the OpenCode
configuration. They do not load files. Additional instruction files require OpenCode's documented discovery or
configured `instructions` mechanism.

The installation destination must match the configuration directory used by OpenCode. Choosing an arbitrary
`--config-dir` only changes where the installer writes files; it does not activate that directory in OpenCode.

## Existing Configuration and Conflicts

The installer preserves properties, providers, models, plugins, permissions, MCP servers, and instructions that it does
not manage. It edits ranges to preserve comments and JSONC formatting. A resource with the same name is not overwritten
if it has been modified or is not recorded as managed; choose to keep it, replace it, or cancel. MCP definitions with
the same name are treated as a unit and are never merged field by field. In an interactive terminal, you must decide
each conflict; in non-interactive mode with `--yes`, any conflict cancels the entire plan without writing.

If both `opencode.json` and `opencode.jsonc` exist, the installer requests explicit confirmation to consolidate into
JSONC, which is the base for comments and formatting. It does not assume precedence between the files. Unknown branches
are merged recursively; different values and non-equivalent arrays require an explicit decision, without concatenating
arrays. Each differing `mcp.servers.<name>` is treated as a complete unit: keeping JSONC retains only that definition,
while taking JSON replaces it entirely without mixing commands or credentials. Exact copies of both files are kept
before applying changes, even if the resulting JSONC is unchanged, and `opencode.json` is removed only after the
resulting JSONC has been validated. Targeted edits detect the existing indentation and line endings; they do not
reformat the rest of the file.

The installer manages a `.autanasoft-install.json` manifest that stores hashes and allowlisted paths, not values or
credentials. Each run that changes files keeps private backups under `.autanasoft-backups/`; a run with no changes does
not create backups or rewrite the manifest. Ordinary failures attempt rollback without overwriting concurrent writes. If
the process is interrupted abruptly or rollback is unsafe, inspect `journal.json` and the backups for manual recovery.
The journal maps each path to its `NNN.bin` copy, original mode, planned hash, and state; first compare the current
state, and do not restore over subsequent changes. There is no automatic recovery after an abrupt interruption.
Individual renames do not make a multi-file installation atomic.

## MCP Servers

- Context7 is preserved as a remote server at `https://mcp.context7.com/mcp`. The installer does not check the network
  or connectivity.
- Codegraph is configured only if `codegraph` is detected in `PATH`, preserving the source command:
  `["codegraph", "serve", "--mcp"]`. The resolved path is used only for detection and diagnostics; it is not stored in
  MCP, so a specific tool-manager version is not pinned. OpenCode must have `codegraph` in its own `PATH` when it starts
  the server.
- Engram is searched for in `PATH` and then in `~/.local/bin/engram`. Its configuration and instruction are added only
  when the executable is detected, the instruction file is installed, and the final Engram configuration is accepted and
  not disabled (`disabled: true` in V2; `enabled: false` is also conservatively preserved if present).
- MCP executables are not installed, run, or queried to determine their version or request help. Detection does not
  verify compatibility, connectivity, or available tools: those states remain unknown, and operability is not checked.
  Pre-existing servers are preserved even when the executable is not detected.
- The installer also does not use [`opencode debug paths config`](https://opencode.ai/v2/docs/cli) to resolve the
  destination. In isolated tests with OpenCode 2.0.32, that query created configuration/data/cache/state directories and
  a log, even with `--log-level none`; it must not be treated as a read-only check.

From the workspace where you will use OpenCode, you can manually verify the servers with `opencode mcp list`. That
command does not verify model availability. See the documentation for
[V2 configuration](https://opencode.ai/v2/docs/config), [instructions](https://opencode.ai/v2/docs/instructions), and
[MCP servers](https://opencode.ai/v2/docs/mcp-servers).

The agents' docs-only and workspace-scoped contracts are not sandbox controls; verify actual paths and permissions.
Model or MCP server operability is not asserted.

### Validation Limits

Tests were run on Linux with Node.js 26.12.0, using temporary destinations and without modifying the real global
configuration. The declared minimum is Node.js 22, but that version and macOS/Windows were not tested. Interactive
decisions were tested with the adapter and streams used by the actual prompt, not with a real TTY. An actual abrupt
interruption was also not simulated; recovery in that case is manual. Path checks reduce concurrency risks, but they are
not a sandbox and do not eliminate all windows between checking and writing.

## Development Checks

```bash
pnpm format        # Apply Prettier, then check Markdownlint.
pnpm format:check  # Check Prettier and Markdownlint without modifying files.
pnpm lint:md       # Check Markdown only.
pnpm test          # Run the Node.js automated tests.
pnpm check         # Check formatting and Markdown, then run the automated tests.
```

`pnpm format` does not automatically fix Markdownlint errors; resolve any reported issues manually. Both `format` and
`format:check` run Markdownlint only after Prettier succeeds. `pnpm check` includes the automated tests and stops if
formatting or Markdown validation fails.

For Markdown changes, run Prettier before Markdownlint; avoid running the global formatter if you only want to modify
specific documentation files.
