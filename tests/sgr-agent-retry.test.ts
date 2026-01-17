import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import OpenAI from "openai";
import { SGRAgent, AgentConfig, ReasoningTool, FinalAnswerTool, BaseTool } from "../src";
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

describe("SGRAgent - Retry Mechanism", () => {
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
        maxToolRetries: 2, // Allow 2 retries
      },
      prompts: {
        systemPrompt: "Test system prompt. Available tools:\n{available_tools}",
        initialUserRequest: "Current date: {current_date}",
      },
    };
  });

  describe("Tool execution retry on validation errors", () => {
    // Test tool that throws validation errors
    class ValidationErrorTool implements BaseTool {
      toolName = "test_tool";
      description = "Test tool that requires 'value' field";
      
      async execute(context: any, config: any, data: any): Promise<string> {
        if (!data.value) {
          throw new Error("test_tool: value is required");
        }
        return JSON.stringify({ result: data.value });
      }
    }

    it("should retry tool execution when validation error occurs", async () => {
      // First reasoning response
      const reasoningResponse = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                reasoningSteps: ["Step 1: Analyze task"],
                currentSituation: "Ready to answer",
                planStatus: "Complete",
                enoughData: true,
                remainingSteps: [],
                taskCompleted: true,
                function: {
                  toolName: "test_tool",
                  // Missing required 'value' field - will cause validation error
                  description: "Test",
                },
              }),
            },
          },
        ],
      };

      // Retry response with correct data
      const retryResponse = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                function: {
                  toolName: "test_tool",
                  value: "success", // Now includes required field
                },
              }),
            },
          },
        ],
      };

      mockClient.setResponses([reasoningResponse, retryResponse]);

      const agent = new SGRAgent(
        [{ role: "user", content: "What is 2+2?" }],
        mockClient as any,
        agentConfig,
        [new ReasoningTool(), new FinalAnswerTool(), new ValidationErrorTool()]
      );

      // Should succeed after retry
      const result = await agent.execute();
      
      expect(result).toBeTruthy();
      // Verify that retry was called (2 LLM calls: initial reasoning + retry for tool)
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it("should fail after max retries exhausted", async () => {
      // First reasoning response
      const reasoningResponse = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                reasoningSteps: ["Step 1"],
                currentSituation: "Ready",
                planStatus: "Complete",
                enoughData: true,
                remainingSteps: [],
                taskCompleted: true,
                function: {
                  toolName: "test_tool",
                  // Missing value field
                  description: "Test",
                },
              }),
            },
          },
        ],
      };

      // Retry responses that still fail
      const retryResponse1 = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                function: {
                  toolName: "test_tool",
                  // Still missing value
                  description: "Test",
                },
              }),
            },
          },
        ],
      };

      const retryResponse2 = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                function: {
                  toolName: "test_tool",
                  // Still missing value
                  description: "Test",
                },
              }),
            },
          },
        ],
      };

      mockClient.setResponses([reasoningResponse, retryResponse1, retryResponse2]);

      const agent = new SGRAgent(
        [{ role: "user", content: "What is 2+2?" }],
        mockClient as any,
        agentConfig,
        [new ReasoningTool(), new FinalAnswerTool(), new ValidationErrorTool()]
      );

      // Should fail after all retries
      await expect(agent.execute()).rejects.toThrow();
      
      // Verify that all retries were attempted (initial + 2 retries = 3 calls)
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(3);
    });

    it("should not retry on non-validation errors", async () => {
      // Create a tool that throws a non-validation error
      class ErrorTool implements BaseTool {
        toolName = "final_answer";
        description = "Test tool";
        
        async execute(context: any, config: any, data: any): Promise<string> {
          throw new Error("Network error: Connection timeout");
        }
      }

      const reasoningResponse = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                reasoningSteps: ["Step 1"],
                currentSituation: "Ready",
                planStatus: "Complete",
                enoughData: true,
                remainingSteps: [],
                taskCompleted: true,
                function: {
                  toolName: "final_answer",
                },
              }),
            },
          },
        ],
      };

      mockClient.setResponses([reasoningResponse]);

      const agent = new SGRAgent(
        [{ role: "user", content: "Test" }],
        mockClient as any,
        agentConfig,
        [new ReasoningTool(), new ErrorTool()]
      );

      // Should fail immediately without retry
      await expect(agent.execute()).rejects.toThrow("Network error");
      
      // Should only be called once (no retry for non-validation errors)
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it("should use default maxToolRetries when not specified", async () => {
      const configWithoutRetries: AgentConfig = {
        ...agentConfig,
        execution: {
          maxIterations: 10,
          // maxToolRetries not specified - should default to 2
        },
      };

      const reasoningResponse = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                reasoningSteps: ["Step 1"],
                currentSituation: "Ready",
                planStatus: "Complete",
                enoughData: true,
                remainingSteps: [],
                taskCompleted: true,
                function: {
                  toolName: "final_answer",
                  reasoning: "Task completed",
                },
              }),
            },
          },
        ],
      };

      const retryResponse = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                function: {
                  toolName: "final_answer",
                  reasoning: "Task completed",
                  answer: "Success",
                  status: AgentStatesEnum.COMPLETED,
                },
              }),
            },
          },
        ],
      };

      mockClient.setResponses([reasoningResponse, retryResponse]);

      const agent = new SGRAgent(
        [{ role: "user", content: "Test" }],
        mockClient as any,
        configWithoutRetries,
        [new ReasoningTool(), new FinalAnswerTool()]
      );

      const result = await agent.execute();
      
      expect(result).toBeTruthy();
      // Should succeed after retry (FinalAnswerTool throws validation error when answer is missing)
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it("should succeed on first attempt when data is valid", async () => {
      const reasoningResponse = {
        choices: [
          {
            message: {
              role: "assistant" as const,
              content: JSON.stringify({
                reasoningSteps: ["Step 1"],
                currentSituation: "Ready",
                planStatus: "Complete",
                enoughData: true,
                remainingSteps: [],
                taskCompleted: true,
                function: {
                  toolName: "final_answer",
                  reasoning: "Task completed",
                  completedSteps: ["Step 1"],
                  answer: "The answer is 4", // Valid data
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
      
      expect(result).toBeTruthy();
      expect(agent.context.state).toBe(AgentStatesEnum.COMPLETED);
      // Should only be called once (no retry needed)
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
    });
  });
});
