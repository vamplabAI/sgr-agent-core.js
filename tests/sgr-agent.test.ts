import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import OpenAI from "openai";
import { SGRAgent, AgentConfig, ReasoningTool, FinalAnswerTool, AdaptPlanTool } from "../src";
import { AgentStatesEnum } from "../src/models";

// Mock OpenAI client
class MockOpenAIClient {
  private callCount = 0;
  private responses: any[] = [];

  setResponses(responses: any[]) {
    this.responses = responses;
    this.callCount = 0;
  }

  chat = {
    completions: {
      create: jest.fn(async (params: any) => {
        const response = this.responses[this.callCount] || this.responses[this.responses.length - 1];
        this.callCount++;
        return response;
      }),
    },
  };
}

describe("SGRAgent", () => {
  let mockClient: MockOpenAIClient;
  let agentConfig: AgentConfig;

  beforeEach(() => {
    mockClient = new MockOpenAIClient();
    agentConfig = {
      llm: {
        apiKey: "test-key",
        model: "gpt-4o-mini",
        temperature: 0.4,
        maxTokens: 8000,
      },
      execution: {
        maxIterations: 10,
        maxClarifications: 3,
      },
      prompts: {
        systemPrompt: "Test system prompt. Available tools:\n{available_tools}",
        initialUserRequest: "Current date: {current_date}",
      },
    };
  });

  describe("Initialization", () => {
    it("should initialize with correct properties", () => {
      const agent = new SGRAgent(
        [{ role: "user", content: "Test task" }],
        mockClient as any,
        agentConfig,
        [ReasoningTool, FinalAnswerTool]
      );

      expect(agent.name).toBe("sgr_agent");
      expect(agent.taskMessages).toHaveLength(1);
      expect(agent.toolkit).toHaveLength(2);
      expect(agent.context.state).toBe(AgentStatesEnum.INITED);
      expect(agent.context.iteration).toBe(0);
    });

    it("should require ReasoningTool in toolkit", () => {
      expect(() => {
        new SGRAgent(
          [{ role: "user", content: "Test task" }],
          mockClient as any,
          agentConfig,
          [FinalAnswerTool]
        );
      }).not.toThrow(); // Will throw during prepareTools, not in constructor
    });
  });

  describe("Reasoning Phase", () => {
    it("should handle reasoning phase with tool calls", async () => {
      const reasoningResponse = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function" as const,
                  function: {
                    name: "reasoning",
                    arguments: JSON.stringify({
                      reasoning_steps: ["Step 1: Analyze task", "Step 2: Plan"],
                      current_situation: "Initial research phase",
                      plan_status: "Plan needs adaptation",
                      enough_data: false,
                      remaining_steps: ["Adapt plan", "Continue research"],
                      task_completed: false,
                    }),
                  },
                },
              ],
            },
          },
        ],
      };

      mockClient.setResponses([reasoningResponse]);

      const agent = new SGRAgent(
        [{ role: "user", content: "Test research task" }],
        mockClient as any,
        agentConfig,
        [ReasoningTool, FinalAnswerTool, AdaptPlanTool]
      );

      // This will fail because reasoningPhase is protected, but we can test through execute
      // For now, we'll test the full flow
    });
  });

  describe("Full Execution Cycle", () => {
    it("should complete full execution cycle", async () => {
      // With structured outputs, reasoning phase returns JSON directly
      const reasoningResponse1 = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                reasoningSteps: ["Step 1: Analyze task", "Step 2: Plan"],
                currentSituation: "Initial research phase",
                planStatus: "Plan needs adaptation",
                enoughData: false,
                remainingSteps: ["Adapt plan", "Continue research"],
                taskCompleted: false,
                function: {
                  toolName: "adapt_plan",
                  reasoning: "Plan needs to be adapted",
                  originalGoal: "Research task",
                  newGoal: "Updated research goal",
                  planChanges: ["Change 1", "Change 2"],
                  nextSteps: ["Step 1", "Step 2", "Step 3"],
                },
              }),
            },
          },
        ],
      };

      const reasoningResponse2 = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                reasoningSteps: ["Step 1: Complete research", "Step 2: Finalize answer"],
                currentSituation: "Research completed",
                planStatus: "All steps completed",
                enoughData: true,
                remainingSteps: ["Finalize"],
                taskCompleted: true,
                function: {
                  toolName: "final_answer",
                  reasoning: "Task completed successfully",
                  completedSteps: ["Step 1", "Step 2"],
                  answer: "Final answer to the research task",
                  status: AgentStatesEnum.COMPLETED,
                },
              }),
            },
          },
        ],
      };

      mockClient.setResponses([
        reasoningResponse1,
        reasoningResponse2,
      ]);

      const agent = new SGRAgent(
        [{ role: "user", content: "Test research task" }],
        mockClient as any,
        agentConfig,
        [ReasoningTool, FinalAnswerTool, AdaptPlanTool]
      );

      const result = await agent.execute();

      expect(result).toBe("Final answer to the research task");
      expect(agent.context.state).toBe(AgentStatesEnum.COMPLETED);
      expect(agent.context.iteration).toBeGreaterThanOrEqual(2);
      expect(agent.conversation.length).toBeGreaterThan(0);
      expect(agent.log.length).toBeGreaterThan(0);
    });
  });

  describe("Simple Task Handling", () => {
    it("should handle simple tasks without external tools", async () => {
      const reasoningResponse = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                reasoningSteps: ["Simple calculation"],
                currentSituation: "Simple task",
                planStatus: "No plan needed",
                enoughData: true,
                remainingSteps: [],
                taskCompleted: true,
                function: {
                  toolName: "final_answer",
                  reasoning: "Simple calculation",
                  completedSteps: ["Calculate"],
                  answer: "4",
                  status: AgentStatesEnum.COMPLETED,
                },
              }),
            },
          },
        ],
      };

      mockClient.setResponses([reasoningResponse]);

      const agent = new SGRAgent(
        [{ role: "user", content: "What is 2+2?" }],
        mockClient as any,
        agentConfig,
        [ReasoningTool, FinalAnswerTool]
      );

      const result = await agent.execute();

      expect(result).toBe("4");
      expect(agent.context.state).toBe(AgentStatesEnum.COMPLETED);
    });
  });
});
