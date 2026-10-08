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

Write the code to implement the app COMPLETELY.

Return ONLY a valid JSON object: {{ "filename.js": "code content", ... }}

STRICT RULES:
- Return valid JSON ONLY. No text before or after.
- Every file value MUST be a STRING containing the file's code.
- Use REAL newlines inside the JSON string. Do NOT write \\n as text.
- Do NOT double-escape.
- Use CommonJS (require), not ES modules.
- You MUST generate EXACTLY these files — no more, no less:
    1. "index.js" — the Express server with all endpoints
    2. "package.json" — the npm manifest
- The package.json MUST contain: {{"name":"ai-app","version":"1.0.0","main":"index.js","scripts":{{"start":"node index.js"}},"dependencies":{{"express":"^4.18.2","body-parser":"^1.20.2"}}}}
- Implement EVERY endpoint in the architecture plan. Do not simplify.
- Routes must return proper JSON via res.json(), not res.send().
- Include error handling for invalid input (return 400 status).
- Failure to include BOTH files will break the build.

Return JSON in this exact shape:
{{"index.js": "...", "package.json": "..."}}
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