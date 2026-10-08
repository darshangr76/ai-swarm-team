import { SwarmBlackboard } from "../core/SwarmBlackboard";
import { smartLLM } from "../utils/llm";
import { PromptTemplate } from "@langchain/core/prompts";

export class PlannerAgent {
  async run(blackboard: SwarmBlackboard): Promise<void> {
    const state = blackboard.getState();
    if (state.status !== "PLANNING") return;

    blackboard.log("Planner: analyzing requirement...");

    const prompt = PromptTemplate.fromTemplate(`
You are an expert Software Architect.
Requirement: {requirement}

Create a high-level technical plan:
- Tech stack (Node.js + Express)
- Database (in-memory array)
- File structure (list files to create)

Concise plain text. No markdown.
`);

    const chain = prompt.pipe(smartLLM);
    const response = await chain.invoke({ requirement: state.requirement });

    blackboard.updateState({
      architecture: response.content as string,
      status: "CODING",
    });
    blackboard.log("Planner: architecture ready.");
  }
}
