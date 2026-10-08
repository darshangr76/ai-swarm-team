import { SwarmBlackboard } from "./core/SwarmBlackboard";
import { PlannerAgent } from "./agents/PlannerAgent";
import { CoderAgent } from "./agents/CoderAgent";
import { FixerAgent } from "./agents/FixerAgent";
import { sleep } from "./utils/llm";
import * as dotenv from "dotenv";

dotenv.config();

const runSandbox = async (files: Record<string, string>): Promise<string> => {
  console.log("Sandbox: running simulated tests...");
  await sleep(1200);

  const hasServer = Object.keys(files).some(
    (f) => f.includes("server") || f.includes("index") || f.includes("app")
  );
  if (!hasServer) {
    return "ERROR: no server file generated. Expected server.js or index.js.";
  }
  if (Math.random() < 0.4) {
    return "ERROR: Cannot find module 'express'. Missing in package.json.";
  }
  return "SUCCESS: All tests passed.";
};

async function runSwarm(requirement: string) {
  const bb = new SwarmBlackboard(requirement);
  const planner = new PlannerAgent();
  const coder = new CoderAgent();
  const fixer = new FixerAgent();

  bb.log(`Swarm starting: "${requirement}"`);

  let iter = 0;
  const MAX = 6;

  while (bb.getState().status !== "DONE" && iter < MAX) {
    iter++;
    const s = bb.getState();
    console.log(`\n--- Iteration ${iter} | Status: ${s.status} ---`);

    try {
      switch (s.status) {
        case "PLANNING":
          await planner.run(bb);
          break;
        case "CODING":
          await coder.run(bb);
          break;
        case "FIXING":
          await fixer.run(bb);
          break;
        case "TESTING": {
          const result = await runSandbox(s.files);
          if (result.startsWith("SUCCESS")) {
            bb.updateState({ status: "DONE", testResults: result });
          } else {
            bb.updateState({ status: "FIXING", errors: [result] });
          }
          break;
        }
        default:
          bb.updateState({ status: "DONE" });
      }
    } catch (err) {
      console.error("Agent crashed:", err);
      bb.updateState({ status: "DONE" });
    }

    await sleep(1000);
  }

  const final = bb.getState();
  console.log("\n==========================================");
  console.log(`SWARM COMPLETE — ${final.status}`);
  console.log("==========================================");
  console.log("\nFiles generated:");
  Object.keys(final.files).forEach((f) => {
    console.log(`\n--- ${f} ---`);
    console.log(final.files[f].substring(0, 400));
  });
}

runSwarm(
  "Build a Node.js REST API for a todo list with GET /todos and POST /todos endpoints using Express and an in-memory array."
);
