import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { BaseAgent } from "../base-agent";
import { AgentConfig } from "../config";
import { BaseTool } from "../base-tool";
import { ReasoningTool, ReasoningToolData } from "../tools/reasoning-tool";
import { FinalAnswerTool } from "../tools/final-answer-tool";
import { StreamingHandler } from "../streaming";
import { NextStepTool, buildNextStepToolsSchema, extractToolFromNextStep } from "../next-step-tool";

/**
 * SGR Agent implementation.
 * Uses ReasoningTool for task analysis and selects appropriate tools based on reasoning.
 * Implements the Schema-Guided Reasoning pattern.
 */
export class SGRAgent extends BaseAgent {
  name = "sgr_agent";

  protected async prepareTools(): Promise<any[]> {
    const tools = await super.prepareTools();
    const reasoningTool = this.toolkit.find((t) => t.toolName === "reasoning");
    if (!reasoningTool) {
      throw new Error("ReasoningTool is required in toolkit");
    }
    return tools;
  }

  /**
   * Prepare response format schema for SGR structured outputs.
   * This matches Python version's NextStepToolsBuilder behavior.
   */
  protected async prepareResponseFormat(): Promise<any> {
    const schema = buildNextStepToolsSchema(this.toolkit);
    return {
      type: "json_schema",
      json_schema: {
        name: schema.name,
        description: schema.description,
        schema: schema.schema,
        strict: schema.strict,
      },
    };
  }

  protected async reasoningPhase(): Promise<NextStepTool> {
    const messages = await this.prepareContext();
    const responseFormat = await this.prepareResponseFormat();
    const enableStreaming = this.config.execution?.enableStreaming || false;

    const reasoningTool = this.toolkit.find((t) => t.toolName === "reasoning");
    if (!reasoningTool) {
      throw new Error("ReasoningTool not found in toolkit");
    }

    let nextStepTool: NextStepTool;

    if (enableStreaming) {
      // Use streaming API with structured outputs
      console.log("[REASONING PHASE - STREAMING] Messages sent to model:", JSON.stringify(messages, null, 2));
      const stream = await this.openaiClient.chat.completions.create({
        model: this.config.llm.model,
        messages: messages,
        response_format: responseFormat,
        temperature: this.config.llm.temperature || 0.4,
        max_tokens: this.config.llm.maxTokens || 8000,
        stream: true,
      });

      const streamingHandler = new StreamingHandler(this.streamingCallback);
      let finalContent = "";
      
      for await (const chunk of stream) {
        streamingHandler.handleChunk(chunk);
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          finalContent += delta.content;
        }
      }

      streamingHandler.finish();
      
      // Parse structured output from final content
      if (!finalContent) {
        if (this.isSimpleTask()) {
          return this.createSimpleTaskReasoning();
        }
        throw new Error("No content in reasoning phase response");
      }

      try {
        nextStepTool = JSON.parse(finalContent);
      } catch (error) {
        throw new Error(`Failed to parse reasoning response: ${error}`);
      }
    } else {
      // Use non-streaming API with structured outputs
      console.log("[REASONING PHASE - NON-STREAMING] Messages sent to model:", JSON.stringify(messages, null, 2));
      const response = await this.openaiClient.chat.completions.create({
        model: this.config.llm.model,
        messages: messages,
        response_format: responseFormat,
        temperature: this.config.llm.temperature || 0.4,
        max_tokens: this.config.llm.maxTokens || 8000,
      });

      const message = response.choices[0].message;
      
      if (!message.content) {
        if (this.isSimpleTask()) {
          return this.createSimpleTaskReasoning();
        }
        throw new Error("No content in reasoning phase response");
      }

      try {
        nextStepTool = JSON.parse(message.content);
      } catch (error) {
        throw new Error(`Failed to parse reasoning response: ${error}`);
      }
    }

    // Validate and normalize the response
    const reasoning: ReasoningToolData = {
      reasoningSteps: nextStepTool.reasoningSteps || [],
      currentSituation: nextStepTool.currentSituation || "",
      planStatus: nextStepTool.planStatus || "",
      enoughData: nextStepTool.enoughData || false,
      remainingSteps: nextStepTool.remainingSteps || [],
      taskCompleted: nextStepTool.taskCompleted || false,
    };

    // If enough data or no remaining steps, mark as completed
    if (reasoning.enoughData || (reasoning.remainingSteps.length === 0 && !reasoning.taskCompleted)) {
      reasoning.taskCompleted = true;
      nextStepTool.taskCompleted = true;
    }

    // If task is simple and reasoning is empty, mark as completed
    if (this.isSimpleTask() && reasoning.reasoningSteps.length === 0 && !reasoning.taskCompleted) {
      reasoning.enoughData = true;
      reasoning.taskCompleted = true;
      nextStepTool.enoughData = true;
      nextStepTool.taskCompleted = true;
    }

    // Ensure function.toolName is set if not provided
    if (!nextStepTool.function?.toolName) {
      nextStepTool.function = {
        toolName: this.selectToolFromReasoning(reasoning),
      };
    }

    this.logReasoning(reasoning);

    return nextStepTool;
  }

  protected isSimpleTask(): boolean {
    // Check if task is simple (doesn't require external tools)
    const userMessage = this.taskMessages.find(m => m.role === "user");
    if (!userMessage || typeof userMessage.content !== "string") {
      return false;
    }
    
    const content = userMessage.content.toLowerCase();
    // Simple tasks: basic math, simple questions that don't need web search
    const simplePatterns = [
      /^\s*what\s+is\s+\d+\s*[\+\-\*\/]\s*\d+/i, // Basic arithmetic
      /^\s*\d+\s*[\+\-\*\/]\s*\d+/i, // Just numbers and operators
    ];
    
    return simplePatterns.some(pattern => pattern.test(content));
  }

  protected createSimpleTaskReasoning(): NextStepTool {
    // Create reasoning for simple tasks that can be answered directly
    const reasoning: ReasoningToolData = {
      reasoningSteps: ["Task is simple and can be answered directly without external tools"],
      currentSituation: "Simple task that doesn't require additional research or tools",
      planStatus: "No plan needed - direct answer",
      enoughData: true,
      remainingSteps: [],
      taskCompleted: true,
    };

    this.logReasoning(reasoning);

    return {
      ...reasoning,
      function: {
        toolName: "final_answer",
      },
    };
  }

  protected selectToolFromReasoning(reasoning: ReasoningToolData): string {
    if (reasoning.taskCompleted) {
      return "final_answer";
    }

    // If enough data and no remaining steps, complete the task
    if (reasoning.enoughData && reasoning.remainingSteps.length === 0) {
      return "final_answer";
    }

    const nextStep = reasoning.remainingSteps?.[0] || "";
    const stepLower = nextStep.toLowerCase();

    for (const tool of this.toolkit) {
      if (stepLower.includes(tool.toolName.toLowerCase())) {
        return tool.toolName;
      }
    }

    // Default to final_answer if no specific tool matches
    return "final_answer";
  }

  protected async selectActionPhase(reasoning: NextStepTool): Promise<BaseTool> {
    // Extract tool from reasoning.function (matches Python version behavior)
    const tool = extractToolFromNextStep(reasoning, this.toolkit);

    if (!tool) {
      throw new Error(`Tool not found: ${reasoning.function?.toolName || "unknown"}`);
    }

    const nextStep = reasoning.remainingSteps?.[0] || "Completing";
    const toolCallId = `${this.context.iteration}-action`;
    
    // Store tool data for action phase
    (this.context as any).currentToolData = reasoning.function;
    (this.context as any).currentToolCallId = toolCallId;

    this.conversation.push({
      role: "assistant",
      content: nextStep,
      tool_calls: [
        {
          type: "function",
          id: toolCallId,
          function: {
            name: tool.toolName,
            arguments: JSON.stringify(reasoning.function),
          },
        },
      ],
    });

    return tool;
  }

  /**
   * Check if error is a validation/format error that should be retried.
   */
  private isValidationError(error: any): boolean {
    if (!error || !error.message) {
      return false;
    }
    const message = error.message.toLowerCase();
    // Check for common validation error patterns
    return (
      message.includes("required") ||
      message.includes("missing") ||
      message.includes("invalid") ||
      message.includes("format") ||
      message.includes("validation")
    );
  }

  /**
   * Retry tool execution with LLM call when validation errors occur.
   */
  private async retryToolExecution(
    tool: BaseTool,
    toolData: any,
    toolCallId: string,
    retryCount: number
  ): Promise<string> {
    this.logger.info(`Retrying tool execution (attempt ${retryCount + 1}): ${tool.toolName}`);
    
    // Prepare context with error message
    const messages = await this.prepareContext();
    const errorMessage = `Previous tool execution failed with validation error. Please provide all required fields for ${tool.toolName}. Required fields: ${tool.description.substring(0, 200)}`;
    
    // Add error context to messages
    const messagesWithError = [
      ...messages,
      {
        role: "assistant" as const,
        content: null,
        tool_calls: [
          {
            type: "function" as const,
            id: toolCallId,
            function: {
              name: tool.toolName,
              arguments: JSON.stringify(toolData),
            },
          },
        ],
      },
      {
        role: "tool" as const,
        content: `Error: ${(this.context as any).lastToolError || "Validation error"}. Please provide all required fields.`,
        tool_call_id: toolCallId,
      },
      {
        role: "user" as const,
        content: errorMessage,
      },
    ];

    const tools = await this.prepareTools();
    const responseFormat = await this.prepareResponseFormat();
    const enableStreaming = this.config.execution?.enableStreaming || false;

    let response: any;
    if (enableStreaming) {
      const stream = await this.openaiClient.chat.completions.create({
        model: this.config.llm.model,
        messages: messagesWithError,
        response_format: responseFormat,
        temperature: this.config.llm.temperature || 0.4,
        max_tokens: this.config.llm.maxTokens || 8000,
        stream: true,
      });

      const streamingHandler = new StreamingHandler(this.streamingCallback);
      let finalContent = "";
      
      for await (const chunk of stream) {
        streamingHandler.handleChunk(chunk);
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          finalContent += delta.content;
        }
      }

      streamingHandler.finish();
      
      if (!finalContent) {
        throw new Error("No content in retry response");
      }

      try {
        response = {
          choices: [{
            message: {
              content: finalContent,
            },
          }],
        };
      } catch (error) {
        throw new Error(`Failed to parse retry response: ${error}`);
      }
    } else {
      response = await this.openaiClient.chat.completions.create({
        model: this.config.llm.model,
        messages: messagesWithError,
        response_format: responseFormat,
        temperature: this.config.llm.temperature || 0.4,
        max_tokens: this.config.llm.maxTokens || 8000,
      });
    }

    const message = response.choices[0].message;
    
    if (!message.content) {
      throw new Error("No content in retry response");
    }

    let retryToolData: any;
    try {
      retryToolData = JSON.parse(message.content);
    } catch (error) {
      throw new Error(`Failed to parse retry response: ${error}`);
    }

    // Extract tool data from retry response
    const retryFunction = retryToolData.function || retryToolData;
    let finalArgs: any;
    
    if (retryFunction.arguments) {
      if (typeof retryFunction.arguments === 'string') {
        try {
          finalArgs = JSON.parse(retryFunction.arguments);
        } catch {
          finalArgs = retryFunction.arguments;
        }
      } else {
        finalArgs = retryFunction.arguments;
      }
    } else {
      const { toolName, ...args } = retryFunction;
      finalArgs = args;
    }

    return await tool.execute(this.context, this.config, finalArgs);
  }

  protected async actionPhase(tool: BaseTool): Promise<string> {
    const maxRetries = this.config.execution?.maxToolRetries ?? 2;
    const toolData = (this.context as any).currentToolData;
    const toolCallId = (this.context as any).currentToolCallId || `${this.context.iteration}-action`;

    if (!toolData) {
      throw new Error("Tool data not found in context. This should not happen.");
    }

    // Handle different data structures
    let finalArgs: any;
    
    if (toolData.arguments) {
      if (typeof toolData.arguments === 'string') {
        try {
          finalArgs = JSON.parse(toolData.arguments);
        } catch {
          finalArgs = { answer: toolData.arguments };
        }
      } else if (typeof toolData.arguments === 'object') {
        finalArgs = toolData.arguments;
      } else {
        finalArgs = toolData.arguments;
      }
    } else {
      const { toolName, ...args } = toolData;
      finalArgs = args;
    }

    // Try to execute tool with retry logic for validation errors
    let lastError: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await tool.execute(this.context, this.config, finalArgs);
        
        // Success - add tool result message
        this.conversation.push({
          role: "tool",
          content: result,
          tool_call_id: toolCallId,
        });

        this.logToolExecution(tool, result);
        
        // Clean up temporary context data
        delete (this.context as any).currentToolData;
        delete (this.context as any).currentToolCallId;
        delete (this.context as any).lastToolError;
        
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Check if this is a validation error and we have retries left
        if (this.isValidationError(error) && attempt < maxRetries) {
          (this.context as any).lastToolError = error.message;
          try {
            const result = await this.retryToolExecution(tool, toolData, toolCallId, attempt);
            
            // Success after retry
            this.conversation.push({
              role: "tool",
              content: result,
              tool_call_id: toolCallId,
            });

            this.logToolExecution(tool, result);
            
            // Clean up temporary context data
            delete (this.context as any).currentToolData;
            delete (this.context as any).currentToolCallId;
            delete (this.context as any).lastToolError;
            
            return result;
          } catch (retryError: any) {
            // Retry also failed, continue to next attempt or throw
            if (attempt === maxRetries) {
              throw retryError;
            }
            (this.context as any).lastToolError = retryError.message;
          }
        } else {
          // Not a validation error or no retries left - throw immediately
          throw error;
        }
      }
    }

    // All retries exhausted
    throw lastError || new Error("Tool execution failed after all retries");
  }
}
