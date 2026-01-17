import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { AgentConfig, ExecutionConfig, PromptsConfig } from "./config";
import * as models from "./models";
import { BaseTool } from "./base-tool";
import { StreamingCallback, StreamingHandler } from "./streaming";

/**
 * Logger interface for agent logging operations.
 */
export interface AgentLogger {
  info(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

/**
 * Base abstract class for all agents.
 * Provides execution context management, logging, clarification handling, and execution loop.
 * Subclasses must implement reasoningPhase(), selectActionPhase(), and actionPhase() methods.
 */
export abstract class BaseAgent {
  public readonly id: string;
  public readonly name: string;
  public readonly creationTime: Date;
  public readonly taskMessages: ChatCompletionMessageParam[];
  public readonly toolkit: BaseTool[];
  public readonly config: AgentConfig;
  protected readonly openaiClient: OpenAI;
  public readonly context: models.AgentContext;
  protected conversation: ChatCompletionMessageParam[] = [];
  protected log: any[] = [];
  protected logger: AgentLogger;
  protected streamingCallback?: StreamingCallback;

  constructor(
    taskMessages: ChatCompletionMessageParam[],
    openaiClient: OpenAI,
    agentConfig: AgentConfig,
    toolkit: BaseTool[],
    name?: string,
    logger?: AgentLogger,
    streamingCallback?: StreamingCallback
  ) {
    this.name = name || this.constructor.name.toLowerCase();
    this.id = `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.creationTime = new Date();
    this.taskMessages = taskMessages;
    this.openaiClient = openaiClient;
    this.config = agentConfig;
    this.toolkit = toolkit;
    this.context = models.createAgentContext();
    this.logger = logger || this.createDefaultLogger();
    this.streamingCallback = streamingCallback;
  }

  protected createDefaultLogger(): AgentLogger {
    return {
      info: (msg: string) => console.log(`[${this.id}] INFO: ${msg}`),
      error: (msg: string) => console.error(`[${this.id}] ERROR: ${msg}`),
      debug: (msg: string) => console.debug(`[${this.id}] DEBUG: ${msg}`),
    };
  }

  /**
   * Provide clarification from an external source (e.g., user input).
   * Updates conversation and agent state.
   */
  async provideClarification(messages: ChatCompletionMessageParam[]): Promise<void> {
    this.conversation.push(...messages);
    const clarificationPrompt = this.getClarificationPrompt(messages);
    this.conversation.push({
      role: "user",
      content: clarificationPrompt,
    });
    this.context.clarificationsUsed += 1;
    this.context.state = models.AgentStatesEnum.RESEARCHING;
    this.logger.info(`✅ Clarification received: ${messages.length} messages`);
  }

  protected getClarificationPrompt(messages: ChatCompletionMessageParam[]): string {
    const prompts = this.config.prompts;
    if (prompts?.clarificationResponse) {
      return prompts.clarificationResponse.replace(
        "{current_date}",
        new Date().toISOString()
      );
    }
    return `User provided clarification: ${messages.map((m) => m.content).join("\n")}`;
  }

  protected logReasoning(reasoning: any): void {
    const nextStep = reasoning.remainingSteps?.[0] || "Completing";
    this.logger.info(`
    ###############################################
    🤖 LLM RESPONSE DEBUG:
       🧠 Reasoning Steps: ${JSON.stringify(reasoning.reasoningSteps)}
       📊 Current Situation: '${reasoning.currentSituation?.substring(0, 400)}...'
       📋 Plan Status: '${reasoning.planStatus?.substring(0, 400)}...'
       🔍 Searches Done: ${this.context.searchesUsed}
       🔍 Clarifications Done: ${this.context.clarificationsUsed}
       ✅ Enough Data: ${reasoning.enoughData}
       📝 Remaining Steps: ${JSON.stringify(reasoning.remainingSteps)}
       🏁 Task Completed: ${reasoning.taskCompleted}
       ➡️ Next Step: ${nextStep}
    ###############################################`);
    this.log.push({
      stepNumber: this.context.iteration,
      timestamp: new Date().toISOString(),
      stepType: "reasoning",
      agentReasoning: reasoning,
    });
  }

  protected logToolExecution(tool: BaseTool, result: string): void {
    this.logger.info(`
###############################################
🛠️ TOOL EXECUTION DEBUG:
    🔧 Tool Name: ${tool.toolName}
    🔍 Result: '${result.substring(0, 400)}...'
###############################################`);
    this.log.push({
      stepNumber: this.context.iteration,
      timestamp: new Date().toISOString(),
      stepType: "tool_execution",
      toolName: tool.toolName,
      agentToolExecutionResult: result,
    });
  }

  protected async prepareContext(): Promise<ChatCompletionMessageParam[]> {
    const systemPrompt = this.getSystemPrompt();
    const initialUserRequest = this.getInitialUserRequest();
    
    // Separate user messages from other messages in taskMessages
    const userMessages: string[] = [];
    const nonUserMessages: ChatCompletionMessageParam[] = [];
    
    for (const msg of this.taskMessages) {
      if (msg.role === "user" && typeof msg.content === "string") {
        userMessages.push(msg.content);
      } else {
        nonUserMessages.push(msg);
      }
    }
    
    // Add initial user request to user messages
    userMessages.push(initialUserRequest);
    
    // Combine all user messages into one
    const combinedUserMessage = userMessages.join("\n\n");
    
    return [
      { role: "system", content: systemPrompt },
      ...nonUserMessages,
      { role: "user", content: combinedUserMessage },
      ...this.conversation,
    ];
  }

  protected getSystemPrompt(): string {
    const prompts = this.config.prompts;
    if (prompts?.systemPrompt) {
      const toolsList = this.toolkit
        .map((tool, i) => `${i + 1}. ${tool.toolName}: ${tool.description}`)
        .join("\n");
      return prompts.systemPrompt.replace("{available_tools}", toolsList);
    }
    const toolsList = this.toolkit
      .map((tool, i) => `${i + 1}. ${tool.toolName}: ${tool.description}`)
      .join("\n");
    return `You are a helpful AI assistant. Available tools:\n${toolsList}`;
  }

  protected getInitialUserRequest(): string {
    const prompts = this.config.prompts;
    if (prompts?.initialUserRequest) {
      return prompts.initialUserRequest.replace(
        "{current_date}",
        new Date().toISOString()
      );
    }
    return `Current date: ${new Date().toISOString()}`;
  }

  protected async prepareTools(): Promise<any[]> {
    const execution = this.config.execution || {};
    const maxIterations = execution.maxIterations || 10;
    if (this.context.iteration >= maxIterations) {
      throw new Error("Max iterations reached");
    }
    return this.toolkit.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.toolName,
        description: tool.description,
      },
    }));
  }

  /**
   * Reasoning phase - analyze current situation and decide next action.
   * Must be implemented by subclasses.
   */
  protected abstract reasoningPhase(): Promise<any>;
  
  /**
   * Select action phase - choose the appropriate tool based on reasoning.
   * Must be implemented by subclasses.
   */
  protected abstract selectActionPhase(reasoning: any): Promise<BaseTool>;
  
  /**
   * Action phase - execute the selected tool.
   * Must be implemented by subclasses.
   */
  protected abstract actionPhase(tool: BaseTool): Promise<string>;

  protected async executionStep(): Promise<void> {
    const reasoning = await this.reasoningPhase();
    this.context.currentStepReasoning = reasoning;
    this.logReasoning(reasoning);
    const actionTool = await this.selectActionPhase(reasoning);
    const result = await this.actionPhase(actionTool);
    
    // Handle clarification tool - pause execution and wait for user input
    if (actionTool.toolName === "clarification") {
      this.logger.info("\n⏸️  Research paused - please answer questions");
      this.context.state = models.AgentStatesEnum.WAITING_FOR_CLARIFICATION;
      // Note: In a real implementation, you would wait for user input here
      // For now, we'll continue - the user should call provideClarification() manually
    }
  }

  /**
   * Execute the agent's main execution loop.
   * Continues until agent reaches a finish state (COMPLETED, FAILED, ERROR).
   * @returns Final execution result or null if execution failed
   */
  async execute(): Promise<string | null> {
    this.logger.info(`🚀 User provided ${this.taskMessages.length} messages.`);
    try {
      while (!models.FINISH_STATES.has(this.context.state)) {
        // If waiting for clarification, break the loop
        // User should call provideClarification() to continue
        if (this.context.state === models.AgentStatesEnum.WAITING_FOR_CLARIFICATION) {
          this.logger.info("⏸️  Agent paused - waiting for clarification");
          break;
        }
        
        this.context.iteration += 1;
        this.logger.info(`Step ${this.context.iteration} started`);
        await this.executionStep();
      }
      return this.context.executionResult;
    } catch (error: any) {
      this.logger.error(`❌ Agent execution error: ${error.message}`);
      this.context.state = models.AgentStatesEnum.FAILED;
      throw error;
    }
  }
}
