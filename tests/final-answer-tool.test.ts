import { describe, it, expect, beforeEach } from "@jest/globals";
import { FinalAnswerTool, FinalAnswerToolData } from "../src/tools/final-answer-tool";
import { AgentConfig } from "../src/config";
import { createAgentContext, AgentContext, AgentStatesEnum } from "../src/models";

describe("FinalAnswerTool", () => {
  let tool: FinalAnswerTool;
  let config: AgentConfig;
  let context: AgentContext;

  beforeEach(() => {
    tool = new FinalAnswerTool();
    config = {
      llm: {
        apiKey: "test-key",
        model: "gpt-4o-mini",
      },
    };
    context = createAgentContext();
  });

  describe("execute", () => {
    it("should create final answer with all fields provided", async () => {
      const data: FinalAnswerToolData = {
        reasoning: "Task completed successfully",
        completedSteps: ["Step 1", "Step 2"],
        answer: "The answer is 4",
        status: AgentStatesEnum.COMPLETED,
      };

      const result = await tool.execute(context, config, data);
      const parsed = JSON.parse(result);

      expect(parsed.reasoning).toBe("Task completed successfully");
      expect(parsed.completedSteps).toEqual(["Step 1", "Step 2"]);
      expect(parsed.answer).toBe("The answer is 4");
      expect(parsed.status).toBe(AgentStatesEnum.COMPLETED);
      expect(context.state).toBe(AgentStatesEnum.COMPLETED);
      expect(context.executionResult).toBe("The answer is 4");
    });

    it("should handle missing answer field by using reasoning as fallback", async () => {
      const data: FinalAnswerToolData = {
        reasoning: "The calculation is complete. 2+2 equals 4.",
        completedSteps: ["Calculated"],
        status: AgentStatesEnum.COMPLETED,
      };

      const result = await tool.execute(context, config, data);
      const parsed = JSON.parse(result);

      expect(parsed.answer).toBe("The calculation is complete. 2+2 equals 4.");
      expect(parsed.reasoning).toBe("The calculation is complete. 2+2 equals 4.");
      expect(context.state).toBe(AgentStatesEnum.COMPLETED);
      expect(context.executionResult).toBe("The calculation is complete. 2+2 equals 4.");
    });

    it("should handle missing answer and reasoning fields", async () => {
      const data: FinalAnswerToolData = {
        completedSteps: ["Completed"],
        status: AgentStatesEnum.COMPLETED,
      };

      const result = await tool.execute(context, config, data);
      const parsed = JSON.parse(result);

      expect(parsed.answer).toBe("Task completed successfully");
      expect(parsed.reasoning).toBe("Task completed");
      expect(context.state).toBe(AgentStatesEnum.COMPLETED);
      expect(context.executionResult).toBe("Task completed successfully");
    });

    it("should handle all undefined fields", async () => {
      const data: FinalAnswerToolData = {};

      const result = await tool.execute(context, config, data);
      const parsed = JSON.parse(result);

      expect(parsed.answer).toBe("Task completed successfully");
      expect(parsed.reasoning).toBe("Task completed");
      expect(parsed.completedSteps).toEqual(["Completed"]);
      expect(parsed.status).toBe(AgentStatesEnum.COMPLETED);
      expect(context.state).toBe(AgentStatesEnum.COMPLETED);
      expect(context.executionResult).toBe("Task completed successfully");
    });

    it("should handle nested arguments structure", async () => {
      const data = {
        arguments: {
          reasoning: "Task done",
          completedSteps: ["Step 1"],
          answer: "Result is 4",
          status: AgentStatesEnum.COMPLETED,
        },
      };

      const result = await tool.execute(context, config, data);
      const parsed = JSON.parse(result);

      expect(parsed.answer).toBe("Result is 4");
      expect(parsed.reasoning).toBe("Task done");
      expect(context.state).toBe(AgentStatesEnum.COMPLETED);
    });

    it("should handle nested arguments without answer", async () => {
      const data = {
        arguments: {
          reasoning: "Calculation complete: 2+2=4",
          completedSteps: ["Calculated"],
        },
      };

      const result = await tool.execute(context, config, data);
      const parsed = JSON.parse(result);

      expect(parsed.answer).toBe("Calculation complete: 2+2=4");
      expect(parsed.reasoning).toBe("Calculation complete: 2+2=4");
      expect(context.state).toBe(AgentStatesEnum.COMPLETED);
    });

    it("should handle string data as answer", async () => {
      const data = "The answer is 4";

      const result = await tool.execute(context, config, data);
      const parsed = JSON.parse(result);

      expect(parsed.answer).toBe("The answer is 4");
      expect(context.state).toBe(AgentStatesEnum.COMPLETED);
      expect(context.executionResult).toBe("The answer is 4");
    });

    it("should handle completed_steps (snake_case) field", async () => {
      const data = {
        reasoning: "Done",
        completed_steps: ["Step 1", "Step 2"],
        answer: "Result",
      };

      const result = await tool.execute(context, config, data);
      const parsed = JSON.parse(result);

      expect(parsed.completedSteps).toEqual(["Step 1", "Step 2"]);
      expect(parsed.answer).toBe("Result");
    });

    it("should handle FAILED status", async () => {
      const data: FinalAnswerToolData = {
        reasoning: "Task failed",
        answer: "Error occurred",
        status: AgentStatesEnum.FAILED,
      };

      const result = await tool.execute(context, config, data);
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe(AgentStatesEnum.FAILED);
      expect(context.state).toBe(AgentStatesEnum.FAILED);
      expect(context.executionResult).toBe("Error occurred");
    });

    it("should default to COMPLETED when status is not FAILED", async () => {
      const data: FinalAnswerToolData = {
        reasoning: "Task done",
        answer: "Success",
        status: undefined,
      };

      const result = await tool.execute(context, config, data);
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe(AgentStatesEnum.COMPLETED);
      expect(context.state).toBe(AgentStatesEnum.COMPLETED);
    });
  });
});
