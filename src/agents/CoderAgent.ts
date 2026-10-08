import { SwarmBlackboard } from "../core/SwarmBlackboard";
import { fastLLM } from "../utils/llm";
import { PromptTemplate } from "@langchain/core/prompts";

function cleanJson(raw: string): string {
  return raw.replace(/```json/gi, "").replace(/```/g, "").trim();
}

export class CoderAgent {
  async run(blackboard: SwarmBlackboard): Promise<void> {
    const state = blackboard.getState();
    if (state.status !== "CODING") return;

    blackboard.log("Coder: writing source code...");

    const prompt = PromptTemplate.fromTemplate(`
You are an expert Full-Stack Developer.

Architecture Plan:
{architecture}

Existing Files:
{files}

Write the code to implement the app.
Return ONLY a valid JSON object: {{ "filename.js": "code content", ... }}

STRICT RULES:
- No markdown fences, no explanations
- Escape newlines as \\n inside strings
- Use CommonJS (require), not ES modules
- Include a package.json with dependencies
`);

    const chain = prompt.pipe(fastLLM);
    const response = await chain.invoke({
      architecture: state.architecture,
      files: JSON.stringify(state.files),
    });

    try {
      const parsed = JSON.parse(cleanJson(response.content as string));
      blackboard.updateState({
        files: { ...state.files, ...parsed },
        status: "TESTING",
      });
      blackboard.log(`Coder: generated ${Object.keys(parsed).length} files.`);
    } catch (e) {
      blackboard.log(`Coder: JSON parse failed -> ${(e as Error).message}`);
      blackboard.updateState({
        status: "FIXING",
        errors: [(e as Error).message],
      });
    }
  }
}
