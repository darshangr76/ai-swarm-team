import { ChatOllama } from "@langchain/ollama";

export const fastLLM = new ChatOllama({
  model: "qwen3:4b",
  baseUrl: "http://localhost:11434",
  temperature: 0.2,
});

export const smartLLM = new ChatOllama({
  model: "qwen3:4b",
  baseUrl: "http://localhost:11434",
  temperature: 0.3,
});

export const sleep = (ms: number) =>
  new Promise((r) => setTimeout(r, ms));
