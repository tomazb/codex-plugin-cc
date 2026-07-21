import { parseStructuredOutput, readOutputSchema, runAppServerTurn } from "./codex.mjs";

export async function runStructuredOutputTurn({
  workspaceRoot,
  prompt,
  model,
  effort,
  sandbox = "read-only",
  schemaPath,
  onProgress
}) {
  const result = await runAppServerTurn(workspaceRoot, {
    prompt,
    model,
    effort,
    sandbox,
    outputSchema: readOutputSchema(schemaPath),
    onProgress
  });
  const parsed = parseStructuredOutput(result.finalMessage, {
    status: result.status,
    failureMessage: result.error?.message ?? result.stderr
  });
  return { result, parsed };
}
