import express from "express";
import cors from "cors";
import { runSwarm } from "./index";

const app = express();
app.use(cors());
app.use(express.json());

const runs = new Map<string, {
  id: string;
  requirement: string;
  status: string;
  files: Record<string, string>;
  logs: string[];
  subscribers: ((event: any) => void)[];
}>();

app.post("/api/swarm/run", (req, res) => {
  const { requirement } = req.body;
  if (!requirement) {
    return res.status(400).json({ error: "requirement is required" });
  }

  const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const run = {
    id: runId,
    requirement,
    status: "STARTING",
    files: {},
    logs: [] as string[],
    subscribers: [] as ((event: any) => void)[],
  };

  runs.set(runId, run);

  runSwarm(requirement, (event) => {
    run.subscribers.forEach((send) => send(event));
    if (event.type === "status") run.status = event.data.status;
    if (event.type === "log") run.logs.push(event.data.message);
  })
    .then((result) => {
      run.status = result.status;
      run.files = result.files;
      run.logs = result.logs;
    })
    .catch((err) => {
      run.status = "ERROR";
      run.logs.push(`Error: ${err.message}`);
    });

  res.json({ runId, message: "Swarm started" });
});

app.get("/api/swarm/stream/:runId", (req, res) => {
  const run = runs.get(req.params.runId);
  if (!run) return res.status(404).json({ error: "run not found" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  run.logs.forEach((log) => {
    res.write(`event: log\ndata: ${JSON.stringify({ message: log })}\n\n`);
  });

  const send = (event: any) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
  };

  run.subscribers.push(send);

  req.on("close", () => {
    run.subscribers = run.subscribers.filter((s) => s !== send);
  });
});

app.get("/api/swarm/result/:runId", (req, res) => {
  const run = runs.get(req.params.runId);
  if (!run) return res.status(404).json({ error: "run not found" });

  res.json({
    id: run.id,
    requirement: run.requirement,
    status: run.status,
    files: run.files,
    logs: run.logs,
  });
});

app.get("/api/runs", (_req, res) => {
  res.json(
    Array.from(runs.values()).map((r) => ({
      id: r.id,
      requirement: r.requirement,
      status: r.status,
    }))
  );
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Swarm API listening on http://localhost:${PORT}`);
  console.log(`POST /api/swarm/run`);
  console.log(`GET  /api/swarm/stream/:runId`);
  console.log(`GET  /api/swarm/result/:runId`);
});
