import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { SGRAgent, AgentConfig, ReasoningTool, FinalAnswerTool } from "../src";
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

describe("SGRAgent Completion", () => {
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

  describe("Task Completion", () => {
    it("should stop execution after FinalAnswerTool sets COMPLETED state", async () => {
      const reasoningResponse = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                reasoningSteps: ["Task is simple", "Ready to answer"],
                currentSituation: "Simple task",
                planStatus: "Completed",
                enoughData: true,
                remainingSteps: [],
                taskCompleted: true,
                function: {
                  toolName: "final_answer",
                  reasoning: "Task completed successfully",
                  completedSteps: ["Step 1", "Step 2"],
                  answer: "The answer is 4",
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
        [new ReasoningTool(), new FinalAnswerTool()]
      );

      const result = await agent.execute();

      expect(result).toBe("The answer is 4");
      expect(agent.context.state).toBe(AgentStatesEnum.COMPLETED);
      expect(agent.context.executionResult).toBe("The answer is 4");
      // Should only execute once, not loop - check iteration count
      expect(agent.context.iteration).toBe(1);
    });

    it("should handle nested arguments structure in FinalAnswerTool", async () => {
      const reasoningResponse = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                reasoningSteps: ["Task completed"],
                currentSituation: "Task done",
                planStatus: "Completed",
                enoughData: true,
                remainingSteps: [],
                taskCompleted: true,
                function: {
                  toolName: "final_answer",
                  arguments: {
                    answer: "The answer is 4",
                    reasoning: "Simple calculation",
                    completedSteps: ["Calculate"],
                  },
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
        [new ReasoningTool(), new FinalAnswerTool()]
      );

      const result = await agent.execute();

      expect(result).toBe("The answer is 4");
      expect(agent.context.state).toBe(AgentStatesEnum.COMPLETED);
      expect(agent.context.executionResult).toBe("The answer is 4");
    });

    it("should not loop when task is already completed", async () => {
      const reasoningResponse = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                reasoningSteps: ["Task completed"],
                currentSituation: "Task done",
                planStatus: "Completed",
                enoughData: true,
                remainingSteps: [],
                taskCompleted: true,
                function: {
                  toolName: "final_answer",
                  reasoning: "Task completed",
                  completedSteps: ["Done"],
                  answer: "Final answer",
                  status: AgentStatesEnum.COMPLETED,
                },
              }),
            },
          },
        ],
      };

      mockClient.setResponses([reasoningResponse]);

      const agent = new SGRAgent(
        [{ role: "user", content: "Test question" }],
        mockClient as any,
        agentConfig,
        [new ReasoningTool(), new FinalAnswerTool()]
      );

      const result = await agent.execute();

      expect(result).toBe("Final answer");
      expect(agent.context.state).toBe(AgentStatesEnum.COMPLETED);
      // Should only call reasoning phase once, then stop
      expect(agent.context.iteration).toBe(1);
    });
  });
});
