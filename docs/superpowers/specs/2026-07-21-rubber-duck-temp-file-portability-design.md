# Rubber Duck Temporary Prompt Portability Design

## Goal

Make the documented long or multiline rubber-duck forwarding path work with GNU and BSD/macOS `mktemp`, and ensure temporary prompt contents are removed after both successful and failed companion invocations without changing the companion's exit status.

## Scope

Update the mirrored shell examples in:

- `plugins/codex/agents/codex-rubber-duck.md`
- `plugins/codex/skills/codex-rubber-duck-runtime/SKILL.md`

No runtime JavaScript behavior or slash-command stdin forwarding behavior changes.

## Design

Use `${TMPDIR:-/tmp}/rd.XXXXXX` as the `mktemp` template so its placeholder characters are trailing, as required by BSD/macOS, while remaining valid with GNU `mktemp`.

Immediately after successful temporary-file creation, install an `EXIT` trap that removes the file. The trap runs when the compound Bash call exits after either a successful or failed `codex-companion` invocation, while Bash retains the invocation's exit status. Keep the heredoc terminator on its own line and retain exactly one foreground `rubber-duck` invocation.

## Error Handling

Chain temporary-file creation, trap installation, prompt writing, and companion invocation so a failed setup step stops the handoff. Cleanup must tolerate an already absent file. A failed companion invocation must remain visible to the caller through its original nonzero status.

## Testing

Add regression coverage in `tests/commands.test.mjs` that:

- verifies both documentation copies use a trailing-`X` template and reject the old suffix-bearing template;
- executes each documented Bash example with a BSD-compatible `mktemp` test double;
- confirms the prompt file exists while the companion is invoked;
- confirms the file is absent after successful and failed invocations; and
- confirms a companion failure status is preserved by cleanup.

Run the focused command tests first, followed by the complete test suite and diff checks.
