import { SwarmBlackboard } from "./core/SwarmBlackboard";
import { PlannerAgent } from "./agents/PlannerAgent";
import { CoderAgent } from "./agents/CoderAgent";
import { FixerAgent } from "./agents/FixerAgent";
import { sleep } from "./utils/llm";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

dotenv.config();

const OUTPUT_DIR = path.join(process.cwd(), "generated-app");

function deEscape(raw: string): string {
  if (raw.includes("\\n") && !raw.includes("\n")) {
    return raw
      .replace(/\\\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\\\t/g, "\t")
      .replace(/\\t/g, "\t")
      .replace(/\\\\"/g, '"')
      .replace(/\\"/g, '"');
  }
  return raw;
}

const writeFiles = (files: Record<string, string>) => {
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const [name, content] of Object.entries(files)) {
    let asString: string;
    if (typeof content === "string") {
      asString = content;
    } else {
      asString = JSON.stringify(content, null, 2);
      console.log(`WARN: File "${name}" was not a string - stringified.`);
    }
    asString = deEscape(asString);
    const filePath = path.join(OUTPUT_DIR, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, asString);
    console.log(
      `WROTE ${name} (${asString.length} chars, ${asString.split("\n").length} lines)`
    );
  }
};

export type SwarmEvent = {
  type: "log" | "status" | "file" | "complete";
  data: any;
};

export async function runSwarm(
  requirement: string,
  emit: (event: SwarmEvent) => void = () => {}
): Promise<{ status: string; files: Record<string, string>; logs: string[] }> {
  const bb = new SwarmBlackboard(requirement);
  const planner = new PlannerAgent();
  const coder = new CoderAgent();
  const fixer = new FixerAgent();

  const originalLog = bb.log.bind(bb);
  bb.log = (msg: string) => {
    originalLog(msg);
    emit({
      type: "log",
      data: { message: msg, timestamp: new Date().toISOString() },
    });
  };

  bb.log(`Swarm starting: "${requirement}"`);

  let iter = 0;
  const MAX = 6;

  while (bb.getState().status !== "DONE" && iter < MAX) {
    iter++;
    const s = bb.getState();
    emit({ type: "status", data: { status: s.status, iteration: iter } });

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
  writeFiles(s.files);
  Object.entries(s.files).forEach(([name, content]) => {
    emit({
      type: "file",
      data: { name, content, lines: content.split("\n").length },
    });
  });

  const hasServer = Object.keys(s.files).some(
    (f) => f.includes("server") || f.includes("index") || f.includes("app")
  );

  let result: string;
  if (!hasServer) {
    result = "ERROR: no server file generated.";
  } else {
    try {
      console.log("Sandbox: running npm install on generated code...");
      execSync("npm install --silent --no-audit --no-fund", {
        cwd: OUTPUT_DIR,
        stdio: "pipe",
        timeout: 90000,
      });
      result = "SUCCESS: Dependencies installed and files written.";
    } catch (e) {
      const err = e as Error & { stderr?: Buffer };
      const msg = err.stderr?.toString() || err.message;
      result = `ERROR: npm install failed -> ${msg.substring(0, 300)}`;
    }
  }

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
      bb.log(`Agent crashed: ${(err as Error).message}`);
      bb.updateState({ status: "DONE" });
    }

    await sleep(1000);
  }

  const final = bb.getState();
  emit({
    type: "complete",
    data: { status: final.status, files: Object.keys(final.files) },
  });

  return {
    status: final.status,
    files: final.files,
    logs: final.logs,
  };
}

if (require.main === module) {
  runSwarm(
    "Build a Node.js REST API for a todo list with GET /todos, POST /todos, DELETE /todos/:id endpoints using Express and an in-memory array."
  ).then((result) => {
    console.log("\n==========================================");
    console.log(`SWARM COMPLETE - ${result.status}`);
    console.log("==========================================");
    console.log("\nFiles generated:");
    Object.keys(result.files).forEach((f) => {
      console.log(`\n--- ${f} ---`);
      console.log(result.files[f]);
    });
  });
}