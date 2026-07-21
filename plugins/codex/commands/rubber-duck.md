---
description: Get a Codex rubber duck critique (constructive second opinion) on a plan, design, code, or tests
argument-hint: '[--wait|--background] [--model <model|spark>] [--effort <none|minimal|low|medium|high|xhigh>] [plan/design/code/tests to critique]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

Run a Codex rubber duck critique through the shared plugin runtime.
Position it as a constructive second opinion on the current plan, design, implementation, or tests, produced by a different model than the one driving this session.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is critique-only.
- Do not fix issues, apply patches, or suggest that you are about to make changes.
- Your only job is to run the rubber duck critique and return Codex's output verbatim to the user.
- The rubber duck reviews proposed changes, it does not make file changes itself. What you do with the feedback is up to the main session afterwards.

Argument handling:
- Everything that is not `--wait`, `--background`, `--model`, or `--effort` is the plan/design/code/tests text to critique.
- If the user did not provide any text to critique, articulate the current plan, design, implementation, or tests yourself and pass that as the text so the rubber duck has something concrete to review.
- Preserve the user's `--model` and `--effort` choices exactly. Leave them unset otherwise.
- If the user asks for `spark`, the companion maps that to `gpt-5.3-codex-spark`.
- Do not strip `--wait` or `--background` yourself.
- The companion script parses `--wait` and `--background`, but Claude Code's `Bash(..., run_in_background: true)` is what actually detaches the run.

Execution mode rules:
- If the raw arguments include `--wait`, do not ask. Run in the foreground.
- If the raw arguments include `--background`, do not ask. Run in a Claude background task.
- Otherwise, use `AskUserQuestion` exactly once with two options, putting `Wait for results (Recommended)` first:
  - `Wait for results`
  - `Run in background`

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" rubber-duck "$ARGUMENTS"
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary before or after it.
- Do not fix any issues mentioned in the critique output.

Background flow:
- Launch the critique with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" rubber-duck "$ARGUMENTS"`,
  description: "Codex rubber duck",
  run_in_background: true
})
```
- Do not call `BashOutput` or wait for completion in this turn.
- After launching the command, tell the user: "Codex rubber duck started in the background. Check `/codex:status` for progress."
