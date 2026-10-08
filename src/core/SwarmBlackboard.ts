export interface SwarmState {
  requirement: string;
  architecture?: string;
  files: Record<string, string>;
  testResults?: string;
  errors?: string[];
  status: "PLANNING" | "CODING" | "TESTING" | "FIXING" | "DONE";
  logs: string[];
}

export class SwarmBlackboard {
  private state: SwarmState;

  constructor(requirement: string) {
    this.state = {
      requirement,
      files: {},
      status: "PLANNING",
      logs: [],
    };
  }

  getState() {
    return this.state;
  }

  updateState(updates: Partial<SwarmState>) {
    this.state = { ...this.state, ...updates };
    this.log(`State -> ${Object.keys(updates).join(", ")}`);
  }

  log(message: string) {
    const entry = `[${new Date().toISOString()}] ${message}`;
    this.state.logs.push(entry);
    console.log(entry);
  }
}
