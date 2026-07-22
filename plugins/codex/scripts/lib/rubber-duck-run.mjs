import path from "node:path";
import { fileURLToPath } from "node:url";

import { getCodexAvailability } from "./codex.mjs";
import { loadPromptTemplate, interpolateTemplate } from "./prompts.mjs";
import { renderRubberDuckResult } from "./render.mjs";
import { runStructuredOutputTurn } from "./structured-output-run.mjs";
import { resolveWorkspaceRoot } from "./workspace.mjs";

const ROOT_DIR = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const RUBBER_DUCK_SCHEMA = path.join(ROOT_DIR, "schemas", "rubber-duck-output.schema.json");

function firstMeaningfulLine(text, fallback) {
  const line = String(text ?? "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(Boolean);
  return line ?? fallback;
}

function ensureCodexAvailable(cwd) {
  const availability = getCodexAvailability(cwd);
  if (!availability.available) {
    throw new Error(
      "Codex CLI is not installed or is missing required runtime support. Install it with `npm install -g @openai/codex`, then rerun `/codex:setup`."
    );
  }
}

export function buildRubberDuckPrompt(input) {
  const template = loadPromptTemplate(ROOT_DIR, "rubber-duck");
  return interpolateTemplate(template, {
    DUCK_INPUT: input
  });
}

export async function executeRubberDuckRun(request) {
  const workspaceRoot = resolveWorkspaceRoot(request.cwd);
  ensureCodexAvailable(request.cwd);

  const label = "Rubber Duck";
  const prompt = buildRubberDuckPrompt(request.input);
  const { result, parsed } = await runStructuredOutputTurn({
    workspaceRoot,
    prompt,
    model: request.model,
    effort: request.effort,
    sandbox: "read-only",
    schemaPath: RUBBER_DUCK_SCHEMA,
    onProgress: request.onProgress
  });
  const rendered = renderRubberDuckResult(parsed, {
    label,
    reasoningSummary: result.reasoningSummary
  });
  const payload = {
    rubberDuck: label,
    threadId: result.threadId,
    codex: {
      status: result.status,
      stderr: result.stderr,
      stdout: result.finalMessage,
      reasoning: result.reasoningSummary
    },
    result: parsed.parsed,
    rawOutput: parsed.rawOutput,
    parseError: parsed.parseError,
    reasoningSummary: result.reasoningSummary
  };

  return {
    exitStatus: result.status,
    threadId: result.threadId,
    turnId: result.turnId,
    payload,
    rendered,
    summary: parsed.parsed?.summary ?? parsed.parseError ?? firstMeaningfulLine(result.finalMessage, `${label} finished.`),
    jobTitle: `Codex ${label}`,
    jobClass: "critique"
  };
}
