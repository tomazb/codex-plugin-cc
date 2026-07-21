# Rubber Duck Temporary Prompt Portability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both documented rubber-duck prompt-file handoffs portable to BSD/macOS and ensure temporary prompts are deleted without hiding companion failures.

**Architecture:** Keep the existing one-Bash-call, prompt-file, foreground-companion flow. Strengthen the documentation examples with a trailing-`X` `mktemp` template and an `EXIT` cleanup trap, and execute those examples under test doubles so the tests validate their shell behavior rather than only their prose.

**Tech Stack:** Markdown shell examples, Bash, Node.js built-in test runner

## Global Constraints

- Preserve exactly one foreground `rubber-duck` companion invocation per handoff.
- Preserve the companion process exit status after cleanup.
- Keep the heredoc terminator alone on its own line.
- Do not change runtime JavaScript or slash-command stdin behavior.

---

### Task 1: Portable `mktemp` Template

**Files:**
- Modify: `tests/commands.test.mjs`
- Modify: `plugins/codex/agents/codex-rubber-duck.md`
- Modify: `plugins/codex/skills/codex-rubber-duck-runtime/SKILL.md`

**Interfaces:**
- Consumes: the Markdown files' existing fenced Bash examples
- Produces: mirrored handoff examples whose `mktemp` templates end in six `X` characters

- [ ] **Step 1: Write the failing portability test**

Add this test after the existing rubber-duck command and agent test in `tests/commands.test.mjs`:

```js
test("rubber duck prompt-file examples use BSD-compatible mktemp templates", () => {
  const sources = [
    ["agent", read("agents/codex-rubber-duck.md")],
    ["runtime skill", read("skills/codex-rubber-duck-runtime/SKILL.md")]
  ];

  for (const [label, source] of sources) {
    assert.match(source, /mktemp "\$\{TMPDIR:-\/tmp\}\/rd\.XXXXXX"/, label);
    assert.doesNotMatch(source, /rd-XXXXXX\.md/, label);
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="BSD-compatible mktemp" tests/commands.test.mjs`

Expected: FAIL because both files contain `rd-XXXXXX.md` rather than a template ending in `XXXXXX`.

- [ ] **Step 3: Apply the minimal portable template change**

In both Markdown examples, replace:

```bash
rd=$(mktemp "${TMPDIR:-/tmp}/rd-XXXXXX.md")
```

with:

```bash
rd=$(mktemp "${TMPDIR:-/tmp}/rd.XXXXXX")
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test --test-name-pattern="BSD-compatible mktemp" tests/commands.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the portable-template change**

```bash
git add tests/commands.test.mjs plugins/codex/agents/codex-rubber-duck.md plugins/codex/skills/codex-rubber-duck-runtime/SKILL.md
git commit -m "fix: use portable rubber duck temp template"
```

### Task 2: Cleanup and Exit-Status Preservation

**Files:**
- Modify: `tests/commands.test.mjs`
- Modify: `plugins/codex/agents/codex-rubber-duck.md`
- Modify: `plugins/codex/skills/codex-rubber-duck-runtime/SKILL.md`

**Interfaces:**
- Consumes: each Markdown file's first fenced Bash example and the portable template from Task 1
- Produces: examples that remove the prompt on shell exit while returning the companion's status

- [ ] **Step 1: Add Bash-example test helpers**

Extend the imports in `tests/commands.test.mjs`:

```js
import { makeTempDir, run, writeExecutable } from "./helpers.mjs";
```

Add these helpers after `read`:

```js
function extractFirstBashExample(source) {
  const match = source.match(/```bash\n([\s\S]*?)\n```/);
  assert.ok(match, "expected a fenced Bash example");
  return match[1];
}

function runRubberDuckPromptFileExample(source, companionStatus) {
  const tempDir = makeTempDir("rubber-duck-handoff-");
  const binDir = path.join(tempDir, "bin");
  const capturedPath = path.join(tempDir, "captured-path");
  const capturedPrompt = path.join(tempDir, "captured-prompt");
  fs.mkdirSync(binDir);

  writeExecutable(
    path.join(binDir, "mktemp"),
    `#!/bin/sh
case "$1" in
  *XXXXXX) ;;
  *) exit 64 ;;
esac
candidate="\${1%XXXXXX}fixed"
(umask 077 && : > "$candidate") || exit 1
printf '%s\\n' "$candidate"
`
  );
  writeExecutable(
    path.join(binDir, "node"),
    `#!/bin/sh
prompt_file=
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--prompt-file" ]; then
    shift
    prompt_file=$1
    break
  fi
  shift
done
[ -n "$prompt_file" ] && [ -f "$prompt_file" ] || exit 65
printf '%s\\n' "$prompt_file" > "$CAPTURE_PATH"
cat "$prompt_file" > "$CAPTURE_PROMPT"
exit "$FAKE_NODE_STATUS"
`
  );

  const result = run("/bin/bash", ["-c", extractFirstBashExample(source)], {
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      TMPDIR: tempDir,
      CLAUDE_PLUGIN_ROOT: "/test/plugin root",
      CAPTURE_PATH: capturedPath,
      CAPTURE_PROMPT: capturedPrompt,
      FAKE_NODE_STATUS: String(companionStatus)
    }
  });

  return {
    ...result,
    promptPath: fs.readFileSync(capturedPath, "utf8").trim(),
    prompt: fs.readFileSync(capturedPrompt, "utf8")
  };
}
```

- [ ] **Step 2: Write the failing success-cleanup test**

```js
test("rubber duck prompt-file examples remove prompts after successful invocations", () => {
  const sources = [
    ["agent", read("agents/codex-rubber-duck.md")],
    ["runtime skill", read("skills/codex-rubber-duck-runtime/SKILL.md")]
  ];

  for (const [label, source] of sources) {
    const result = runRubberDuckPromptFileExample(source, 0);
    assert.equal(result.status, 0, `${label}: ${result.stderr}`);
    assert.match(result.prompt, /\.\.\.articulation\.\.\./, label);
    assert.equal(fs.existsSync(result.promptPath), false, label);
  }
});
```

- [ ] **Step 3: Run the success-cleanup test and verify RED**

Run: `node --test --test-name-pattern="remove prompts after successful" tests/commands.test.mjs`

Expected: FAIL because the documented examples leave the prompt files present.

- [ ] **Step 4: Write the failing failure-cleanup and status test**

```js
test("rubber duck prompt-file examples clean up while preserving companion failures", () => {
  const sources = [
    ["agent", read("agents/codex-rubber-duck.md")],
    ["runtime skill", read("skills/codex-rubber-duck-runtime/SKILL.md")]
  ];

  for (const [label, source] of sources) {
    const result = runRubberDuckPromptFileExample(source, 23);
    assert.equal(result.status, 23, `${label}: ${result.stderr}`);
    assert.equal(fs.existsSync(result.promptPath), false, label);
  }
});
```

- [ ] **Step 5: Run the failure-cleanup test and verify RED**

Run: `node --test --test-name-pattern="preserving companion failures" tests/commands.test.mjs`

Expected: FAIL because the companion status is already propagated but the prompt file remains.

- [ ] **Step 6: Apply the minimal cleanup change**

Change both examples to:

```bash
rd=$(mktemp "${TMPDIR:-/tmp}/rd.XXXXXX") &&
trap 'rm -f "$rd"' EXIT &&
cat > "$rd" <<'EOF' && node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" rubber-duck --prompt-file "$rd"
...articulation...
EOF
```

Adjust the surrounding prose to state that the `EXIT` trap deletes the prompt after successful and failed companion runs without replacing the companion's status.

- [ ] **Step 7: Run both cleanup tests and verify GREEN**

Run: `node --test --test-name-pattern="prompt-file examples" tests/commands.test.mjs`

Expected: all portability and cleanup tests PASS.

- [ ] **Step 8: Commit cleanup behavior**

```bash
git add tests/commands.test.mjs plugins/codex/agents/codex-rubber-duck.md plugins/codex/skills/codex-rubber-duck-runtime/SKILL.md
git commit -m "fix: clean up rubber duck prompt files"
```

### Task 3: Final Verification and Review

**Files:**
- Verify: `tests/commands.test.mjs`
- Verify: `plugins/codex/agents/codex-rubber-duck.md`
- Verify: `plugins/codex/skills/codex-rubber-duck-runtime/SKILL.md`

**Interfaces:**
- Consumes: Tasks 1 and 2
- Produces: fresh evidence that the review findings are resolved without regressions

- [ ] **Step 1: Run command tests**

Run: `node --test tests/commands.test.mjs`

Expected: all command tests PASS with zero failures.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: all repository tests PASS with zero failures.

- [ ] **Step 3: Run repository diff checks**

```bash
git diff --check HEAD~2..HEAD
git status --short
```

Expected: no whitespace errors; only intended repository state remains.

- [ ] **Step 4: Review the final changes**

Run: `coderabbit review --prompt-only --base-commit c3387e0`

Expected: no critical or warning findings related to the implementation. Address any actionable findings and repeat verification before completion.
