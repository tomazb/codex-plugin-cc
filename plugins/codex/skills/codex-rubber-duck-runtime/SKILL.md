---
name: codex-rubber-duck-runtime
description: Internal helper contract for forwarding rubber duck critiques to the codex-companion runtime from Claude Code
user-invocable: false
---

# Codex Rubber Duck Runtime

Use this skill only inside the `codex:codex-rubber-duck` subagent.

Primary helper:
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" rubber-duck "<articulated work to critique>"`

Execution rules:
- The rubber duck subagent is a forwarder, not an orchestrator. Its only job is to invoke `rubber-duck` once and return that stdout unchanged.
- Prefer the helper over hand-rolled `git`, direct Codex CLI strings, or any other Bash activity.
- Do not call `setup`, `task`, `review`, `adversarial-review`, `status`, `result`, or `cancel` from `codex:codex-rubber-duck`.
- Use `rubber-duck` for every critique request, including plans, designs, implementations, and tests.
- You may use the `gpt-5-4-prompting` skill to tighten the articulated work into a clearer Codex prompt before the single `rubber-duck` call.
- That prompt drafting is the only Claude-side work allowed. Do not inspect the repo, solve the task yourself, or add independent analysis outside the forwarded prompt text.
- Leave `--effort` unset unless the user explicitly requests a specific effort.
- Leave model unset by default. Add `--model` only when the user explicitly asks for one.
- Map `spark` to `--model gpt-5.3-codex-spark`.

Input contract:
- The forwarded text must be a stable articulation of the work to critique. Prefer a template covering goal, approach, assumptions, and risks so Codex has concrete context.
- For long or multiline articulations, especially ones with quotes or code, write the articulation to a file and pass `--prompt-file <path>` instead of packing it into a fragile Bash argv string.
- If there is nothing concrete to critique, articulate the current plan, design, implementation, or tests yourself rather than forwarding empty input.

Command selection:
- Use exactly one `rubber-duck` invocation per critique handoff.
- If the forwarded request includes `--background` or `--wait`, treat that as Claude-side execution control only. Strip it before calling `rubber-duck`, and do not treat it as part of the natural-language critique text.
- If the forwarded request includes `--model`, normalize `spark` to `gpt-5.3-codex-spark` and pass it through to `rubber-duck`.
- If the forwarded request includes `--effort`, pass it through to `rubber-duck`. Accepted values are `none`, `minimal`, `low`, `medium`, `high`, `xhigh`.

Execution mode:
- Prefer a Claude background task for proactive, mid-implementation, or large articulations so the critique does not block the main session.
- Reserve foreground (`--wait`) for tiny, well-bounded asks.

Safety rules:
- The rubber duck is read-only. Never add `--write`; it must not edit files.
- Never route a critique to `task`, `review`, or `adversarial-review`. Those carry different, sometimes write-capable, contracts.
- Return the stdout of the `rubber-duck` command exactly as-is.
- If the Bash call fails or Codex cannot be invoked, fail loudly: report that the rubber duck could not run and surface the most actionable error lines. Never return an empty response, because an empty critique reads as "no issues found."
