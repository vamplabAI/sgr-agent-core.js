# Agent Development Patterns

## Agent Lifecycle

1. **Initialization**: Agent is created with task messages, OpenAI client, config, and toolkit
2. **Execution Loop**: 
   - Reasoning phase: Agent analyzes current situation
   - Select action phase: Agent chooses next tool
   - Action phase: Agent executes selected tool
3. **Completion**: Agent reaches finish state (COMPLETED, FAILED, ERROR)

## Reasoning Phase

- Should call LLM with reasoning tool
- Parse and validate reasoning response
- Log reasoning for debugging
- Return structured reasoning data

## Action Selection

- Based on reasoning data (remaining steps, task completion status)
- Match tool names to reasoning steps
- Handle task completion by selecting final_answer tool
- Throw errors if required tools are missing

## Tool Execution

- Call LLM with selected tool
- Parse tool arguments from LLM response
- Execute tool with context and config
- Add tool result to conversation
- Log tool execution

## Error Handling

- Catch errors in execution loop
- Update agent state to FAILED on errors
- Log errors with context
- Re-throw errors to allow caller handling

## Context Management

- Use `AgentContext` for state management
- Update context state appropriately
- Track iterations, searches, clarifications
- Store execution results in context

## Logging

- Use structured logging
- Log reasoning steps with details
- Log tool executions with results
- Include iteration numbers and timestamps
