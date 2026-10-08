import { ChatOllama } from "@langchain/ollama";

export const fastLLM = new ChatOllama({
  model: "qwen2.5-coder:3b",     // ⬅️ was 7b, now 3b
  baseUrl: "http://localhost:11434",
  temperature: 0.2,
  format: "json",
});

export const smartLLM = new ChatOllama({
  model: "qwen3:4b",
  baseUrl: "http://localhost:11434",
  temperature: 0.3,
});

export const sleep = (ms: number) =>
  new Promise((r) => setTimeout(r, ms));