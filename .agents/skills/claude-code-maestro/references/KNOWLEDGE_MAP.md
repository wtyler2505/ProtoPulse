# Claude Code Raw Docs Knowledge Map
Use this to quickly find which raw markdown file contains the topic you need.

## File: agent-sdk-claude-code-features.md
  # Use Claude Code features in the SDK
  ## Enable Claude Code features with settingSources
  ## Project instructions (CLAUDE.md and rules)
  ### CLAUDE.md load locations
  ## Skills
  ## Hooks
  ### When to use which hook type
  ## Choose the right feature
  ## Related resources

## File: agent-sdk-cost-tracking.md
  # Track cost and usage
  ## Understand token usage
  ## Get the total cost of a query
  ## Track per-step and per-model usage
  ### Track per-step usage
  ### Break down usage per model
  ## Accumulate costs across multiple calls
  ## Handle errors, caching, and token discrepancies
  ### Resolve output token discrepancies
  ### Track costs on failed conversations
  ### Track cache tokens
  ## Related documentation

## File: agent-sdk-custom-tools.md
  # Give Claude custom tools
  ## Quick reference
  ## Create a custom tool
  ### Weather tool example
  ### Call a custom tool
  ### Add more tools
  ### Add tool annotations
  ## Control tool access
  ### Tool name format
  ### Configure allowed tools
  ## Handle errors
  ## Return images and resources
  ### Images
  ### Resources
  ## Example: unit converter
  ## Next steps
  ## Related documentation

## File: agent-sdk-file-checkpointing.md
  # Rewind file changes with checkpointing
  ## How checkpointing works
  ## Implement checkpointing
  ## Common patterns
  ### Checkpoint before risky operations
  ### Multiple restore points
  ## Try it out
  ## Limitations
  ## Troubleshooting
  ### Checkpointing options not recognized
  ### User messages don't have UUIDs
  ### "No file checkpoint found for message" error
  ### "ProcessTransport is not ready for writing" error
  ## Next steps

## File: agent-sdk-hooks.md
  # Intercept and control agent behavior with hooks
  ## How hooks work
  ## Available hooks
  ## Configure hooks
  ### Matchers
  ### Callback functions
  ## Examples
  ### Modify tool input
  ### Add context and block a tool
  ### Auto-approve specific tools
  ### Chain multiple hooks
  ### Filter with regex matchers
  ### Track subagent activity
  ### Make HTTP requests from hooks
  ### Forward notifications to Slack
  ## Fix common issues
  ### Hook not firing
  ### Matcher not filtering as expected
  ### Hook timeout
  ### Tool blocked unexpectedly
  ### Modified input not applied
  ### Session hooks not available in Python
  ### Subagent permission prompts multiplying
  ### Recursive hook loops with subagents
  ### systemMessage not appearing in output
  ## Related resources

## File: agent-sdk-hosting.md
  # Hosting the Agent SDK
  ## Hosting Requirements
  ### Container-Based Sandboxing
  ### System Requirements
  ## Understanding the SDK Architecture
  ## Sandbox Provider Options
  ## Production Deployment Patterns
  ### Pattern 1: Ephemeral Sessions
  ### Pattern 2: Long-Running Sessions
  ### Pattern 3: Hybrid Sessions
  ### Pattern 4: Single Containers
  ## FAQ
  ### How do I communicate with my sandboxes?
  ### What is the cost of hosting a container?
  ### When should I shut down idle containers vs. keeping them warm?
  ### How often should I update the Claude Code CLI?
  ### How do I monitor container health and agent performance?
  ### How long can an agent session run before timing out?
  ## Next Steps

## File: agent-sdk-mcp.md
  # Connect to external tools with MCP
  ## Quickstart
  ## Add an MCP server
  ### In code
  ### From a config file
  ## Allow MCP tools
  ### Tool naming convention
  ### Grant access with allowedTools
  ### Discover available tools
  ## Transport types
  ### stdio servers
  ### HTTP/SSE servers
  ### SDK MCP servers
  ## MCP tool search
  ## Authentication
  ### Pass credentials via environment variables
  ### HTTP headers for remote servers
  ### OAuth2 authentication
  ## Examples
  ### List issues from a repository
  ### Query a database
  ## Error handling
  ## Troubleshooting
  ### Server shows "failed" status
  ### Tools not being called
  ### Connection timeouts
  ## Related resources

## File: agent-sdk-migration-guide.md
  # Migrate to Claude Agent SDK
  ## Overview
  ## What's Changed
  ## Migration Steps
  ### For TypeScript/JavaScript Projects
  ### For Python Projects
  # Before
  # After
  # Before
  # After
  ## Breaking changes
  ### Python: ClaudeCodeOptions renamed to ClaudeAgentOptions
  # BEFORE (claude-code-sdk)
  # AFTER (claude-agent-sdk)
  ### System prompt no longer default
  ### Settings Sources No Longer Loaded by Default
  ## Why the Rename?
  ## Getting Help
  ## Next Steps

## File: agent-sdk-modifying-system-prompts.md
  # Modifying system prompts
  ## Understanding system prompts
  ## Methods of modification
  ### Method 1: CLAUDE.md files (project-level instructions)
  # Project Guidelines
  ## Code Style
  ## Testing
  ## Commands
  ### Method 2: Output styles (persistent configurations)
  ### Method 3: Using `systemPrompt` with append
  ### Method 4: Custom system prompts
  ## Comparison of all four approaches
  ## Use cases and best practices
  ### When to use CLAUDE.md
  ### When to use output styles
  ### When to use `systemPrompt` with append
  ### When to use custom `systemPrompt`
  ## Combining approaches
  ### Example: Output style with session-specific additions
  ## See also

## File: agent-sdk-observability.md
  # Observability with OpenTelemetry
  ## How telemetry flows from the SDK
  ## Enable telemetry export
  ### Flush telemetry from short-lived calls
  ## Read agent traces
  ## Tag telemetry from your agent
  ## Control sensitive data in exports
  ## Related documentation

## File: agent-sdk-overview.md
  # Agent SDK overview
  ## Get started
  ## Capabilities
  ### Claude Code features
  ## Compare the Agent SDK to other Claude tools
  ## Changelog
  ## Reporting bugs
  ## Branding guidelines
  ## License and terms
  ## Next steps

## File: agent-sdk-permissions.md
  # Configure permissions
  ## How permissions are evaluated
  ## Allow and deny rules
  ## Permission modes
  ### Available modes
  ### Set permission mode
  ### Mode details
  ## Related resources

## File: agent-sdk-plugins.md
  # Plugins in the SDK
  ## What are plugins?
  ## Loading plugins
  ### Path specifications
  ## Verifying plugin installation
  ## Using plugin skills
  ## Complete example
  ## Plugin structure reference
  ## Common use cases
  ### Development and testing
  ### Project-specific extensions
  ### Multiple plugin sources
  ## Troubleshooting
  ### Plugin not loading
  ### Skills not appearing
  ### Path resolution issues
  ## See also

## File: agent-sdk-python.md
  # Agent SDK reference - Python
  ## Installation
  ## Choosing between `query()` and `ClaudeSDKClient`
  ### Quick comparison
  ### When to use `query()` (new session each time)
  ### When to use `ClaudeSDKClient` (continuous conversation)
  ## Functions
  ### `query()`
  ### `tool()`
  ### `create_sdk_mcp_server()`
  # Use with Claude
  ### `list_sessions()`
  ### `get_session_messages()`
  ### `get_session_info()`
  ### `rename_session()`
  ### `tag_session()`
  # Tag a session
  # Later: find all sessions with that tag
  ## Classes
  ### `ClaudeSDKClient`
  ## Types
  ### `SdkMcpTool`
  ### `Transport`
  ### `ClaudeAgentOptions`
  ### `OutputFormat`
  # Expected dict shape for output_format
  ### `SystemPromptPreset`
  ### `SettingSource`
  # Load all settings like SDK v0.0.x did
  # Load only project settings, ignore user and local
  # Ensure consistent behavior in CI by excluding local settings
  # Define everything programmatically (default behavior)
  # No filesystem dependencies - setting_sources defaults to None
  # Load project settings to include CLAUDE.md files
  ### `AgentDefinition`
  ### `PermissionMode`
  ### `CanUseTool`
  ### `ToolPermissionContext`
  ### `PermissionResult`
  ### `PermissionResultAllow`
  ### `PermissionResultDeny`
  ### `PermissionUpdate`
  ### `PermissionRuleValue`
  ### `ToolsPreset`
  ### `ThinkingConfig`
  # Option 1: dict literal (recommended, no import needed)
  # Option 2: constructor-style (returns a plain dict)
  # config.budget_tokens would raise AttributeError
  ### `SdkBeta`
  ### `McpSdkServerConfig`
  ### `McpServerConfig`
  ### `McpServerStatusConfig`
  ### `McpStatusResponse`
  ### `McpServerStatus`
  ### `SdkPluginConfig`
  ## Message Types
  ### `Message`
  ### `UserMessage`
  ### `AssistantMessage`
  ### `AssistantMessageError`
  ### `SystemMessage`
  ### `ResultMessage`
  ### `StreamEvent`
  ### `RateLimitEvent`
  ### `RateLimitInfo`
  ### `TaskStartedMessage`
  ### `TaskUsage`
  ### `TaskProgressMessage`
  ### `TaskNotificationMessage`
  ## Content Block Types
  ### `ContentBlock`
  ### `TextBlock`
  ### `ThinkingBlock`
  ### `ToolUseBlock`
  ### `ToolResultBlock`
  ## Error Types
  ### `ClaudeSDKError`
  ### `CLINotFoundError`
  ### `CLIConnectionError`
  ### `ProcessError`
  ### `CLIJSONDecodeError`
  ## Hook Types
  ### `HookEvent`
  ### `HookCallback`
  ### `HookContext`
  ### `HookMatcher`
  ### `HookInput`
  ### `BaseHookInput`
  ### `PreToolUseHookInput`
  ### `PostToolUseHookInput`
  ### `PostToolUseFailureHookInput`
  ### `UserPromptSubmitHookInput`
  ### `StopHookInput`
  ### `SubagentStopHookInput`
  ### `PreCompactHookInput`
  ### `NotificationHookInput`
  ### `SubagentStartHookInput`
  ### `PermissionRequestHookInput`
  ### `HookJSONOutput`
  ### Hook Usage Example
  ## Tool Input/Output Types
  ### Agent
  ### AskUserQuestion
  ### Bash
  ### Monitor
  ### Edit
  ### Read
  ### Write
  ### Glob
  ### Grep
  ### NotebookEdit
  ### WebFetch
  ### WebSearch
  ### TodoWrite
  ### BashOutput
  ### KillBash
  ### ExitPlanMode
  ### ListMcpResources
  ### ReadMcpResource
  ## Advanced Features with ClaudeSDKClient
  ### Building a Continuous Conversation Interface
  # Example conversation:
  # Turn 1 - You: "Create a file called hello.py"
  # Turn 1 - Claude: "I'll create a hello.py file for you..."
  # Turn 2 - You: "What's in that file?"
  # Turn 2 - Claude: "The hello.py file I just created contains..." (remembers!)
  # Turn 3 - You: "Add a main function to it"
  # Turn 3 - Claude: "I'll add a main function to hello.py..." (knows which file!)
  ### Using Hooks for Behavior Modification
  ### Real-time Progress Monitoring
  ## Example Usage
  ### Basic file operations (using query)
  ### Error handling
  ### Streaming mode with client
  ### Using custom tools with ClaudeSDKClient
  # Define custom tools with @tool decorator
  ## Sandbox Configuration
  ### `SandboxSettings`
  ### `SandboxNetworkConfig`
  ### `SandboxIgnoreViolations`
  ### Permissions Fallback for Unsandboxed Commands
  # Required: dummy hook keeps the stream open for can_use_tool
  ## See also

## File: agent-sdk-quickstart.md
  # Quickstart
  ## Prerequisites
  ## Setup
  ## Create a buggy file
  ## Build an agent that finds and fixes bugs
  ### Run your agent
  ### Try other prompts
  ### Customize your agent
  ## Key concepts
  ## Next steps

## File: agent-sdk-secure-deployment.md
  # Securely deploying AI agents
  ## Threat model
  ## Built-in security features
  ## Security principles
  ### Security boundaries
  ### Least privilege
  ### Defense in depth
  ## Isolation technologies
  ### Sandbox runtime
  ### Containers
  ### gVisor
  ### Virtual machines
  ### Cloud deployments
  ## Credential management
  ### The proxy pattern
  ### Configuring Claude Code to use a proxy
  ### Implementing a proxy
  ### Credentials for other services
  ## Filesystem configuration
  ### Read-only code mounting
  ### Writable locations
  ## Further reading

## File: agent-sdk-sessions.md
  # Work with sessions
  ## Choose an approach
  ### Continue, resume, and fork
  ## Automatic session management
  ### Python: `ClaudeSDKClient`
  ### TypeScript: `continue: true`
  ## Use session options with `query()`
  ### Capture the session ID
  ### Resume by ID
  ### Fork to explore alternatives
  ## Resume across hosts
  ## Related resources

## File: agent-sdk-skills.md
  # Agent Skills in the SDK
  ## Overview
  ## How Skills Work with the SDK
  ## Using Skills with the SDK
  ## Skill Locations
  ## Creating Skills
  ## Tool Restrictions
  ## Discovering Available Skills
  ## Testing Skills
  ## Troubleshooting
  ### Skills Not Found
  # Check project Skills
  # Check personal Skills
  ### Skill Not Being Used
  ### Additional Troubleshooting
  ## Related Documentation
  ### Skills Guides
  ### SDK Resources

## File: agent-sdk-slash-commands.md
  # Slash Commands in the SDK
  ## Discovering Available Slash Commands
  ## Sending Slash Commands
  ## Common Slash Commands
  ### `/compact` - Compact Conversation History
  ### `/clear` - Clear Conversation
  ## Creating Custom Slash Commands
  ### File Locations
  ### File Format
  ### Using Custom Commands in the SDK
  ### Advanced Features
  ## Context
  ## Task
  ### Organization with Namespacing
  ### Practical Examples
  ## Changed Files
  ## Detailed Changes
  ## Review Checklist
  ## See Also

## File: agent-sdk-streaming-output.md
  # Stream responses in real-time
  ## Enable streaming output
  ## StreamEvent reference
  ## Message flow
  ## Stream text responses
  ## Stream tool calls
  ## Build a streaming UI
  ## Known limitations
  ## Next steps

## File: agent-sdk-streaming-vs-single-mode.md
  # Streaming Input
  ## Overview
  ## Streaming Input Mode (Recommended)
  ### How It Works
  ### Benefits
  ### Implementation Example
  ## Single Message Input
  ### When to Use Single Message Input
  ### Limitations
  ### Implementation Example

## File: agent-sdk-structured-outputs.md
