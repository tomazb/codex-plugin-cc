import test from "node:test";
import assert from "node:assert/strict";

import { renderReviewResult, renderRubberDuckResult, renderStoredJobResult } from "../plugins/codex/scripts/lib/render.mjs";

test("renderReviewResult degrades gracefully when JSON is missing required review fields", () => {
  const output = renderReviewResult(
    {
      parsed: {
        verdict: "approve",
        summary: "Looks fine."
      },
      rawOutput: JSON.stringify({
        verdict: "approve",
        summary: "Looks fine."
      }),
      parseError: null
    },
    {
      reviewLabel: "Adversarial Review",
      targetLabel: "working tree diff"
    }
  );

  assert.match(output, /Codex returned JSON with an unexpected review shape\./);
  assert.match(output, /Missing array `findings`\./);
  assert.match(output, /Raw final message:/);
});

test("renderStoredJobResult prefers rendered output for structured review jobs", () => {
  const output = renderStoredJobResult(
    {
      id: "review-123",
      status: "completed",
      title: "Codex Adversarial Review",
      jobClass: "review",
      threadId: "thr_123"
    },
    {
      threadId: "thr_123",
      rendered: "# Codex Adversarial Review\n\nTarget: working tree diff\nVerdict: needs-attention\n",
      result: {
        result: {
          verdict: "needs-attention",
          summary: "One issue.",
          findings: [],
          next_steps: []
        },
        rawOutput:
          '{"verdict":"needs-attention","summary":"One issue.","findings":[],"next_steps":[]}'
      }
    }
  );

  assert.match(output, /^# Codex Adversarial Review/);
  assert.doesNotMatch(output, /^\{/);
  assert.match(output, /Codex session ID: thr_123/);
  assert.match(output, /Resume in Codex: codex resume thr_123/);
});

test("renderRubberDuckResult groups findings by severity", () => {
  const output = renderRubberDuckResult(
    {
      parsed: {
        assessment: "issues-found",
        summary: "The plan misses an empty-state failure mode.",
        findings: [
          {
            severity: "blocking",
            title: "Unhandled empty collection",
            body: "Indexing assumes the collection is never empty.",
            recommendation: "Guard against empty input.",
            file: "src/app.js",
            line_start: 4,
            line_end: 6
          },
          {
            severity: "suggestion",
            title: "Add a regression test",
            body: "No test covers the empty-state path.",
            recommendation: "Add a test for the empty collection case."
          }
        ]
      },
      rawOutput: "{}",
      parseError: null
    },
    { label: "Rubber Duck" }
  );

  assert.match(output, /^# Codex Rubber Duck/);
  assert.match(output, /Assessment: issues-found/);
  assert.match(output, /Blocking issues:/);
  assert.match(output, /Unhandled empty collection \(src\/app\.js:4-6\)/);
  assert.match(output, /Suggestions:/);
  assert.match(output, /Recommendation: Add a test for the empty collection case\./);
});

test("renderRubberDuckResult reports no issues explicitly when there are none", () => {
  const output = renderRubberDuckResult(
    {
      parsed: {
        assessment: "no-issues",
        summary: "The plan holds up.",
        findings: []
      },
      rawOutput: "{}",
      parseError: null
    },
    { label: "Rubber Duck" }
  );

  assert.match(output, /Assessment: no-issues/);
  assert.match(output, /No blocking issues, non-blocking issues, or suggestions\./);
});

test("renderRubberDuckResult degrades gracefully on invalid JSON", () => {
  const output = renderRubberDuckResult(
    {
      parsed: null,
      rawOutput: "not valid json",
      parseError: "Unexpected token"
    },
    { label: "Rubber Duck" }
  );

  assert.match(output, /Codex did not return valid structured JSON\./);
  assert.match(output, /Parse error: Unexpected token/);
  assert.match(output, /Raw final message:/);
});

test("renderRubberDuckResult reports an unexpected shape when required fields are missing", () => {
  const output = renderRubberDuckResult(
    {
      parsed: {
        assessment: "issues-found",
        summary: "Missing findings array."
      },
      rawOutput: JSON.stringify({
        assessment: "issues-found",
        summary: "Missing findings array."
      }),
      parseError: null
    },
    { label: "Rubber Duck" }
  );

  assert.match(output, /Codex returned JSON with an unexpected rubber duck shape\./);
  assert.match(output, /Validation error: Missing array `findings`\./);
  assert.match(output, /Raw final message:/);
});

test("renderRubberDuckResult flags a no-issues assessment that still returns findings", () => {
  const output = renderRubberDuckResult(
    {
      parsed: {
        assessment: "no-issues",
        summary: "Claims clean but lists a blocker.",
        findings: [
          {
            severity: "blocking",
            title: "Race condition on cache write",
            body: "Two writers can clobber each other.",
            recommendation: "Serialize writes."
          }
        ]
      },
      rawOutput: "{}",
      parseError: null
    },
    { label: "Rubber Duck" }
  );

  assert.match(output, /Assessment: no-issues/);
  assert.match(output, /Note: Codex reported `no-issues` but still returned findings/);
  assert.match(output, /Blocking issues:/);
  assert.match(output, /Race condition on cache write/);
});

test("renderRubberDuckResult flags an issues-found assessment with no findings", () => {
  const output = renderRubberDuckResult(
    {
      parsed: {
        assessment: "issues-found",
        summary: "Says issues but lists none.",
        findings: []
      },
      rawOutput: "{}",
      parseError: null
    },
    { label: "Rubber Duck" }
  );

  assert.match(output, /Assessment: issues-found/);
  assert.match(output, /Note: Codex reported `issues-found` but returned no findings/);
  assert.match(output, /No blocking issues, non-blocking issues, or suggestions\./);
});
