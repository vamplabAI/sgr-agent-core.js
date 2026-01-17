# TypeScript Development Rules

## Code Style

- Use TypeScript strict mode
- Prefer interfaces over types for object shapes
- Use `readonly` for immutable properties
- Use `protected` for internal methods that subclasses may override
- Use `abstract` for base classes that must be extended
- Avoid `any` type - use `unknown` or proper types instead
- Use async/await for asynchronous operations
- Prefer named exports over default exports

## Project Structure

- All source code in `src/` directory
- Examples in `examples/` directory
- Types and interfaces should be exported from their respective modules
- Use index files for clean exports

## Agent Development

- All agents must extend `BaseAgent`
- Implement three abstract methods: `reasoningPhase()`, `selectActionPhase()`, `actionPhase()`
- Use `this.context` to manage agent state
- Use `this.logger` for logging
- Handle errors gracefully and update agent state

## Tool Development

- All tools must implement `BaseTool` interface
- Tools should be stateless - use context for state management
- Tool descriptions should be clear and help LLM understand when to use them
- Return string results from `execute()` method

## Configuration

- All configuration passed through constructors (no YAML/config files)
- Use TypeScript interfaces for configuration types
- Provide sensible defaults where possible
- Validate required fields in constructors

## Testing

- Write tests for all public APIs
- Test error cases and edge conditions
- Use descriptive test names
- Mock external dependencies (OpenAI client, etc.)

## Documentation

- **All comments and documentation MUST be in English only**
- **NO emojis in code comments, documentation, or commit messages**
- Use JSDoc comments for public APIs
- Document complex logic and algorithms
- Keep README up to date with examples
- Write clear, concise comments that explain "why" not just "what"
- Write clear, concise comments that explain "why" not just "what"