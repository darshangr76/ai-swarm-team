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
{{ "filename.js": "FULL FILE CONTENT AS A STRING" }}

STRICT RULES:
- Every value MUST be a complete file as a string.
- Do NOT return fragments like {{ "body-parser": "^1.19.0" }}.
- Do NOT wrap in markdown.
- If a file is fine, omit it entirely.
`);

    const chain = prompt.pipe(fastLLM);
    const response = await chain.invoke({
      files: JSON.stringify(state.files),
      errors: (state.errors || []).join("\n"),
    });

    try {
      const patched = JSON.parse(cleanJson(response.content as string));

      // Validate: every value must be a string
      const validPatches: Record<string, string> = {};
      for (const [name, content] of Object.entries(patched)) {
        if (typeof content === "string") {
          validPatches[name] = content;
        } else {
          console.log(`⚠️  Fixer: skipping non-string file "${name}"`);
        }
      }

      blackboard.updateState({
        files: { ...state.files, ...validPatches },
        status: "TESTING",
        errors: [],
      });
      blackboard.log(`Fixer: patched ${Object.keys(validPatches).length} files.`);
    } catch (e) {
      blackboard.log("Fixer: could not parse patch. Halting.");
      blackboard.updateState({ status: "DONE" });
    }
  }
}