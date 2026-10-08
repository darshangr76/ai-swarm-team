import { SwarmBlackboard } from "../core/SwarmBlackboard";
import { fastLLM } from "../utils/llm";
import { PromptTemplate } from "@langchain/core/prompts";

function cleanJson(raw: string): string {
  return raw.replace(/```json/gi, "").replace(/```/g, "").trim();
}

export class FixerAgent {
  async run(blackboard: SwarmBlackboard): Promise<void> {
    const state = blackboard.getState();
    if (state.status !== "FIXING") return;

    blackboard.log("Fixer: analyzing errors...");

    const prompt = PromptTemplate.fromTemplate(`
You are a senior debugging engineer.

Current Files:
{files}

Test Errors:
{errors}

Fix the code. Return ONLY a JSON object of files that need to change:
{{ "filename.js": "updated code content" }}

No markdown, no explanation.
`);

    const chain = prompt.pipe(fastLLM);
    const response = await chain.invoke({
      files: JSON.stringify(state.files),
      errors: (state.errors || []).join("\n"),
    });

    try {
      const patched = JSON.parse(cleanJson(response.content as string));
      blackboard.updateState({
        files: { ...state.files, ...patched },
        status: "TESTING",
        errors: [],
      });
      blackboard.log(`Fixer: patched ${Object.keys(patched).length} files.`);
    } catch (e) {
      blackboard.log("Fixer: could not parse patch. Halting.");
      blackboard.updateState({ status: "DONE" });
    }
  }
}
