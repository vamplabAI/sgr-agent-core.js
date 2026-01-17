/**
 * Callback interface for streaming responses.
 */
export interface StreamingCallback {
  /**
   * Called when a text chunk is received from the LLM.
   * @param chunk - Text chunk content
   */
  onChunk?: (chunk: string) => void;
  
  /**
   * Called when a tool call is detected in the stream.
   * @param toolCallId - Unique identifier for the tool call
   * @param toolName - Name of the tool being called
   * @param toolArguments - Tool call arguments (may be partial during streaming)
   */
  onToolCall?: (toolCallId: string, toolName: string, toolArguments: string) => void;
  
  /**
   * Called when streaming is finished.
   * @param finalContent - Complete final content
   */
  onFinish?: (finalContent: string) => void;
}

/**
 * Simple streaming handler that collects chunks and provides callbacks.
 */
export class StreamingHandler {
  private chunks: string[] = [];
  private toolCalls: Map<string, { toolName: string; arguments: string }> = new Map();
  private callback?: StreamingCallback;

  constructor(callback?: StreamingCallback) {
    this.callback = callback;
  }

  /**
   * Handle a streaming chunk from OpenAI API.
   */
  handleChunk(chunk: any): void {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return;

    // Handle content chunks
    if (delta.content) {
      this.chunks.push(delta.content);
      this.callback?.onChunk?.(delta.content);
    }

    // Handle tool calls
    if (delta.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        const toolCallId = toolCall.id;
        if (!toolCallId) continue;

        if (!this.toolCalls.has(toolCallId)) {
          this.toolCalls.set(toolCallId, {
            toolName: toolCall.function?.name || "",
            arguments: toolCall.function?.arguments || "",
          });
        } else {
          const existing = this.toolCalls.get(toolCallId)!;
          existing.arguments += toolCall.function?.arguments || "";
        }

        const toolCallData = this.toolCalls.get(toolCallId)!;
        this.callback?.onToolCall?.(
          toolCallId,
          toolCallData.toolName,
          toolCallData.arguments
        );
      }
    }
  }

  /**
   * Get the complete accumulated content.
   */
  getContent(): string {
    return this.chunks.join("");
  }

  /**
   * Get all tool calls collected during streaming.
   */
  getToolCalls(): Map<string, { toolName: string; arguments: string }> {
    return this.toolCalls;
  }

  /**
   * Finish streaming and call onFinish callback.
   */
  finish(): void {
    const finalContent = this.getContent();
    this.callback?.onFinish?.(finalContent);
  }

  /**
   * Reset the handler for a new stream.
   */
  reset(): void {
    this.chunks = [];
    this.toolCalls.clear();
  }
}
