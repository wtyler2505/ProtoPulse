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
  # Get structured output from agents
  ## Why structured outputs?
  ## Quick start
  ## Type-safe schemas with Zod and Pydantic
  ## Output format configuration
  ## Example: TODO tracking agent
  ## Error handling
  ## Related resources

## File: agent-sdk-subagents.md
  # Subagents in the SDK
  ## Overview
  ## Benefits of using subagents
  ### Context isolation
  ### Parallelization
  ### Specialized instructions and knowledge
  ### Tool restrictions
  ## Creating subagents
  ### Programmatic definition (recommended)
  ### AgentDefinition configuration
  ### Filesystem-based definition (alternative)
  ## What subagents inherit
  ## Invoking subagents
  ### Automatic invocation
  ### Explicit invocation
  ### Dynamic agent configuration
  ## Detecting subagent invocation
  ## Resuming subagents
  ## Tool restrictions
  ### Common tool combinations
  ## Troubleshooting
  ### Claude not delegating to subagents
  ### Filesystem-based agents not loading
  ### Windows: long prompt failures
  ## Related documentation

## File: agent-sdk-todo-tracking.md
  # Todo Lists
  ### Todo Lifecycle
  ### When Todos Are Used
  ## Examples
  ### Monitoring Todo Changes
  ### Real-time Progress Display
  ## Related Documentation

## File: agent-sdk-tool-search.md
  # Scale to many tools with tool search
  ## How tool search works
  ## Configure tool search
  ## Optimize tool discovery
  ## Limits
  ## Related documentation

## File: agent-sdk-typescript.md
  # Agent SDK reference - TypeScript
  ## Installation
  ## Functions
  ### `query()`
  ### `tool()`
  ### `createSdkMcpServer()`
  ### `listSessions()`
  ### `getSessionMessages()`
  ### `getSessionInfo()`
  ### `renameSession()`
  ### `tagSession()`
  ## Types
  ### `Options`
  ### `Query` object
  ### `SDKControlInitializeResponse`
  ### `AgentDefinition`
  ### `AgentMcpServerSpec`
  ### `SettingSource`
  ### `PermissionMode`
  ### `CanUseTool`
  ### `PermissionResult`
  ### `ToolConfig`
  ### `McpServerConfig`
  ### `SdkPluginConfig`
  ## Message Types
  ### `SDKMessage`
  ### `SDKAssistantMessage`
  ### `SDKUserMessage`
  ### `SDKUserMessageReplay`
  ### `SDKResultMessage`
  ### `SDKSystemMessage`
  ### `SDKPartialAssistantMessage`
  ### `SDKCompactBoundaryMessage`
  ### `SDKPermissionDenial`
  ## Hook Types
  ### `HookEvent`
  ### `HookCallback`
  ### `HookCallbackMatcher`
  ### `HookInput`
  ### `BaseHookInput`
  ### `HookJSONOutput`
  ## Tool Input Types
  ### `ToolInputSchemas`
  ### Agent
  ### AskUserQuestion
  ### Bash
  ### Monitor
  ### TaskOutput
  ### Edit
  ### Read
  ### Write
  ### Glob
  ### Grep
  ### TaskStop
  ### NotebookEdit
  ### WebFetch
  ### WebSearch
  ### TodoWrite
  ### ExitPlanMode
  ### ListMcpResources
  ### ReadMcpResource
  ### Config
  ### EnterWorktree
  ## Tool Output Types
  ### `ToolOutputSchemas`
  ### Agent
  ### AskUserQuestion
  ### Bash
  ### Monitor
  ### Edit
  ### Read
  ### Write
  ### Glob
  ### Grep
  ### TaskStop
  ### NotebookEdit
  ### WebFetch
  ### WebSearch
  ### TodoWrite
  ### ExitPlanMode
  ### ListMcpResources
  ### ReadMcpResource
  ### Config
  ### EnterWorktree
  ## Permission Types
  ### `PermissionUpdate`
  ### `PermissionBehavior`
  ### `PermissionUpdateDestination`
  ### `PermissionRuleValue`
  ## Other Types
  ### `ApiKeySource`
  ### `SdkBeta`
  ### `SlashCommand`
  ### `ModelInfo`
  ### `AgentInfo`
  ### `McpServerStatus`
  ### `McpServerStatusConfig`
  ### `AccountInfo`
  ### `ModelUsage`
  ### `ConfigScope`
  ### `NonNullableUsage`
  ### `Usage`
  ### `CallToolResult`
  ### `ThinkingConfig`
  ### `SpawnedProcess`
  ### `SpawnOptions`
  ### `McpSetServersResult`
  ### `RewindFilesResult`
  ### `SDKStatusMessage`
  ### `SDKTaskNotificationMessage`
  ### `SDKToolUseSummaryMessage`
  ### `SDKHookStartedMessage`
  ### `SDKHookProgressMessage`
  ### `SDKHookResponseMessage`
  ### `SDKToolProgressMessage`
  ### `SDKAuthStatusMessage`
  ### `SDKTaskStartedMessage`
  ### `SDKTaskProgressMessage`
  ### `SDKFilesPersistedEvent`
  ### `SDKRateLimitEvent`
  ### `SDKLocalCommandOutputMessage`
  ### `SDKPromptSuggestionMessage`
  ### `AbortError`
  ## Sandbox Configuration
  ### `SandboxSettings`
  ### `SandboxNetworkConfig`
  ### `SandboxFilesystemConfig`
  ### Permissions Fallback for Unsandboxed Commands
  ## See also

## File: agent-sdk-typescript-v2-preview.md
  # TypeScript SDK V2 interface (preview)
  ## Installation
  ## Quick start
  ### One-shot prompt
  ### Basic session
  ### Multi-turn conversation
  ### Session resume
  ### Cleanup
  ## API reference
  ### `unstable_v2_createSession()`
  ### `unstable_v2_resumeSession()`
  ### `unstable_v2_prompt()`
  ### SDKSession interface
  ## Feature availability
  ## Feedback
  ## See also

## File: agent-sdk-user-input.md
  # Handle approvals and user input
  ## Detect when Claude needs input
  ## Handle tool approval requests
  ### Respond to tool requests
  ## Handle clarifying questions
  ### Question format
  ### Response format
  ### Complete example
  ## Limitations
  ## Other ways to get user input
  ### Streaming input
  ### Custom tools
  ## Related resources

## File: agent-teams.md
  # Orchestrate teams of Claude Code sessions
  ## When to use agent teams
  ### Compare with subagents
  ## Enable agent teams
  ## Start your first agent team
  ## Control your agent team
  ### Choose a display mode
  ### Specify teammates and models
  ### Require plan approval for teammates
  ### Talk to teammates directly
  ### Assign and claim tasks
  ### Shut down teammates
  ### Clean up the team
  ### Enforce quality gates with hooks
  ## How agent teams work
  ### How Claude starts agent teams
  ### Architecture
  ### Use subagent definitions for teammates
  ### Permissions
  ### Context and communication
  ### Token usage
  ## Use case examples
  ### Run a parallel code review
  ### Investigate with competing hypotheses
  ## Best practices
  ### Give teammates enough context
  ### Choose an appropriate team size
  ### Size tasks appropriately
  ### Wait for teammates to finish
  ### Start with research and review
  ### Avoid file conflicts
  ### Monitor and steer
  ## Troubleshooting
  ### Teammates not appearing
  ### Too many permission prompts
  ### Teammates stopping on errors
  ### Lead shuts down before work is done
  ### Orphaned tmux sessions
  ## Limitations
  ## Next steps

## File: authentication.md
  # Authentication
  ## Log in to Claude Code
  ## Set up team authentication
  ### Claude for Teams or Enterprise
  ### Claude Console authentication
  ### Cloud provider authentication
  ## Credential management
  ### Authentication precedence
  ### Generate a long-lived token

## File: best-practices.md
  # Best Practices for Claude Code
  ## Give Claude a way to verify its work
  ## Explore first, then plan, then code
  ## Provide specific context in your prompts
  ### Provide rich content
  ## Configure your environment
  ### Write an effective CLAUDE.md
  # Code style
  # Workflow
  # Additional Instructions
  ### Configure permissions
  ### Use CLI tools
  ### Connect MCP servers
  ### Set up hooks
  ### Create skills
  # API Conventions
  ### Create custom subagents
  ### Install plugins
  ## Communicate effectively
  ### Ask codebase questions
  ### Let Claude interview you
  ## Manage your session
  ### Course-correct early and often
  ### Manage context aggressively
  ### Use subagents for investigation
  ### Rewind with checkpoints
  ### Resume conversations
  ## Automate and scale
  ### Run non-interactive mode
  # One-off queries
  # Structured output for scripts
  # Streaming for real-time processing
  ### Run multiple Claude sessions
  ### Fan out across files
  ### Run autonomously with auto mode
  ## Avoid common failure patterns
  ## Develop your intuition
  ## Related resources

## File: changelog.md
  # Changelog

## File: channels.md
  # Push events into a running session with channels
  ## Supported channels
  ## Quickstart
  ## Security
  ## Enterprise controls
  ### Enable channels for your organization
  ### Restrict which channel plugins can run
  ## Research preview
  ## How channels compare
  ## Next steps

## File: channels-reference.md
  # Channels reference
  ## Overview
  ## What you need
  ## Example: build a webhook receiver
  ## Test during the research preview
  # Testing a plugin you're developing
  # Testing a bare .mcp.json server (no plugin wrapper yet)
  ## Server options
  ## Notification format
  ## Expose a reply tool
  ## Gate inbound messages
  ## Relay permission prompts
  ### How relay works
  ### Permission request fields
  ### Add relay to a chat bridge
  ### Full example
  ## Package as a plugin
  ## See also

## File: checkpointing.md
  # Checkpointing
  ## How checkpoints work
  ### Automatic tracking
  ### Rewind and summarize
  ## Common use cases
  ## Limitations
  ### Bash command changes not tracked
  ### External changes not tracked
  ### Not a replacement for version control
  ## See also

## File: chrome.md
  # Use Claude Code with Chrome (beta)
  ## Capabilities
  ## Prerequisites
  ## Get started in the CLI
  ### Enable Chrome by default
  ### Manage site permissions
  ## Example workflows
  ### Test a local web application
  ### Debug with console logs
  ### Automate form filling
  ### Draft content in Google Docs
  ### Extract data from web pages
  ### Run multi-site workflows
  ### Record a demo GIF
  ## Troubleshooting
  ### Extension not detected
  ### Browser not responding
  ### Connection drops during long sessions
  ### Windows-specific issues
  ### Common error messages
  ## See also

## File: claude-code-on-the-web.md
  # Use Claude Code on the web
  ## GitHub authentication options
  ## The cloud environment
  ### What's available in cloud sessions
  ### Installed tools
  ### Work with GitHub issues and pull requests
  ### Run tests, start services, and add packages
  ### Resource limits
  ### Configure your environment
  ## Setup scripts
  ### Setup scripts vs. SessionStart hooks
  ### Install dependencies with a SessionStart hook
  ## Network access
  ### Access levels
  ### Allow specific domains
  ### GitHub proxy
  ### Security proxy
  ### Default allowed domains
  ## Move tasks between web and terminal
  ### From terminal to web
  ### From web to terminal
  ## Work with sessions
  ### Manage context
  ### Review changes
  ### Share sessions
  ### Archive sessions
  ### Delete sessions
  ## Auto-fix pull requests
  ### How Claude responds to PR activity
  ## Security and isolation
  ## Limitations
  ## Related resources

## File: claude-directory.md
  # Explore the .claude directory
  ## Commands
  ## Stack
  ## Rules
  # API credentials
  # Testing Rules
  # API Design Rules
  ## Diff to review
  ## Input Validation
  ## Authentication
  ## Patterns seen
  ## Recurring issues
  ## Project
  ## Reference
  ## Auth Token Issues
  ## Database Connection Drops
  ## What's not shown
  ## File reference
  ## Check what loaded
  ## Application data
  ### Cleaned up automatically
  ### Kept until you delete them
  ### Plaintext storage
  ### Clear local data
  ## Related resources

## File: cli-reference.md
  # CLI reference
  ## CLI commands
  ## CLI flags
  ### System prompt flags
  ## See also

## File: code-review.md
  # Code Review
  ## How reviews work
  ### Severity levels
  ### Rate and reply to findings
  ### Check run output
  ### What Code Review checks
  ## Set up Code Review
  ## Manually trigger reviews
  ## Customize reviews
  ### CLAUDE.md
  ### REVIEW\.md
  # Code Review Guidelines
  ## Always check
  ## Style
  ## Skip
  ## View usage
  ## Pricing
  ## Troubleshooting
  ### Retrigger a failed or timed-out review
  ### Find issues that aren't showing as inline comments
  ## Related resources

## File: commands.md
  # Commands
  ## MCP prompts
  ## See also

## File: common-workflows.md
  # Common workflows
  ## Understand new codebases
  ### Get a quick codebase overview
  ### Find relevant code
  ## Fix bugs efficiently
  ## Refactor code
  ## Use specialized subagents
  ## Use Plan Mode for safe code analysis
  ### When to use Plan Mode
  ### How to use Plan Mode
  ### Example: Planning a complex refactor
  ### Configure Plan Mode as default
  ## Work with tests
  ## Create pull requests
  ## Handle documentation
  ## Work with images
  ## Reference files and directories
  ## Use extended thinking (thinking mode)
  ### Configure thinking mode
  ### How extended thinking works
  ## Resume previous conversations
  ### Name your sessions
  ### Use the session picker
  ## Run parallel Claude Code sessions with Git worktrees
  # Start Claude in a worktree named "feature-auth"
  # Creates .claude/worktrees/feature-auth/ with a new branch
  # Start another session in a separate worktree
  # Auto-generates a name like "bright-running-fox"
  ### Subagent worktrees
  ### Worktree cleanup
  ### Copy gitignored files to worktrees
  ### Manage worktrees manually
  # Create a worktree with a new branch
  # Create a worktree with an existing branch
  # Start Claude in the worktree
  # Clean up when done
  ### Non-git version control
  ## Get notified when Claude needs your attention
  ## Use Claude as a unix-style utility
  ### Add Claude to your verification process
  ### Pipe in, pipe out
  ### Control output format
  ## Run Claude on a schedule
  ## Ask Claude about its capabilities
  ### Example questions
  ## Next steps

## File: computer-use.md
  # Let Claude use your computer from the CLI
  ## What you can do with computer use
  ## When computer use applies
  ## Enable computer use
  ## Approve apps per session
  ## How Claude works on your screen
  ### One session at a time
  ### Apps are hidden while Claude works
  ### Stop at any time
  ## Safety and the trust boundary
  ## Example workflows
  ### Validate a native build
  ### Reproduce a layout bug
  ### Test a simulator flow
  ## Differences from the Desktop app
  ## Troubleshooting
  ### "Computer use is in use by another Claude session"
  ### macOS permissions prompt keeps reappearing
  ### `computer-use` doesn't appear in `/mcp`
  ## See also

## File: context-window.md
  # Explore the context window
  ## What the timeline shows
  ## What survives compaction
  ## Check your own session
  ## Related resources

## File: costs.md
  # Manage costs effectively
  ## Track your costs
  ### Using the `/cost` command
  ## Managing costs for teams
  ### Rate limit recommendations
  ### Agent team token costs
  ## Reduce token usage
  ### Manage context proactively
  # Compact instructions
  ### Choose the right model
  ### Reduce MCP server overhead
  ### Install code intelligence plugins for typed languages
  ### Offload processing to hooks and skills
  ### Move instructions from CLAUDE.md to skills
  ### Adjust extended thinking
  ### Delegate verbose operations to subagents
  ### Manage agent team costs
  ### Write specific prompts
  ### Work efficiently on complex tasks
  ## Background token usage
  ## Understanding changes in Claude Code behavior

## File: data-usage.md
  # Data usage
  ## Data policies
  ### Data training policy
  ### Development Partner Program
  ### Feedback using the `/feedback` command
  ### Session quality surveys
  ### Data retention
  ## Data access
  ## Local Claude Code: Data flow and dependencies
  ### Cloud execution: Data flow and dependencies
  ## Telemetry services
  ## Default behaviors by API provider

## File: desktop.md
  # Use Claude Code Desktop
  ## Start a session
  ## Work with code
  ### Use the prompt box
  ### Add files and context to prompts
  ### Choose a permission mode
  ### Preview your app
  ### Review changes with diff view
  ### Review your code
  ### Monitor pull request status
  ## Let Claude use your computer
  ### When computer use applies
  ### Enable computer use
  ### App permissions
  ## Manage sessions
  ### Work in parallel with sessions
  ### Run long-running tasks remotely
  ### Continue in another surface
  ### Sessions from Dispatch
  ## Extend Claude Code
  ### Connect external tools
  ### Use skills
  ### Install plugins
  ### Configure preview servers
  ## Environment configuration
  ### Local sessions
  ### Remote sessions
  ### SSH sessions
  ## Enterprise configuration
  ### Admin console controls
  ### Managed settings
  ### Device management policies
  ### Authentication and SSO
  ### Data handling
  ### Deployment
  ## Coming from the CLI?
  ### CLI flag equivalents
  ### Shared configuration
  ### Feature comparison
  ### What's not available in Desktop
  ## Troubleshooting
  ### Check your version
  ### 403 or authentication errors in the Code tab
  ### Blank or stuck screen on launch
  ### "Failed to load session"
  ### Session not finding installed tools
  ### Git and Git LFS errors
  ### MCP servers not working on Windows
  ### App won't quit
  ### Windows-specific issues
  ### Cowork tab unavailable on Intel Macs
  ### "Branch doesn't exist yet" when opening in CLI
  ### Still stuck?

## File: desktop-quickstart.md
  # Get started with the desktop app
  ## Install
  ## Start your first session
  ## Now what?
  ## Coming from the CLI?
  ## What's next

## File: desktop-scheduled-tasks.md
  # Schedule recurring tasks in Claude Code Desktop
  ## Compare scheduling options
  ## Create a scheduled task
  ## Frequency options
  ## How scheduled tasks run
  ## Missed runs
  ## Permissions for scheduled tasks
  ## Manage scheduled tasks
  ## Related resources

## File: devcontainer.md
  # Development containers
  ## Key features
  ## Getting started in 4 steps
  ## Configuration breakdown
  ## Security features
  ## Customization options
  ## Example use cases
  ### Secure client work
  ### Team onboarding
  ### Consistent CI/CD environments
  ## Related resources

## File: discover-plugins.md
  # Discover and install prebuilt plugins through marketplaces
  ## How marketplaces work
  ## Official Anthropic marketplace
  ### Code intelligence
  ### External integrations
  ### Development workflows
  ### Output styles
  ## Try it: add the demo marketplace
  ## Add marketplaces
  ### Add from GitHub
  ### Add from other Git hosts
  ### Add from local paths
  ### Add from remote URLs
  ## Install plugins
  ## Manage installed plugins
  ### Apply plugin changes without restarting
  ## Manage marketplaces
  ### Use the interactive interface
  ### Use CLI commands
  ### Configure auto-updates
  ## Configure team marketplaces
  ## Security
  ## Troubleshooting
  ### /plugin command not recognized
  ### Common issues
  ### Code intelligence issues
  ## Next steps

## File: env-vars.md
  # Environment variables
  ## See also

## File: fast-mode.md
  # Speed up responses with fast mode
  ## Toggle fast mode
  ## Understand the cost tradeoff
  ## Decide when to use fast mode
  ### Fast mode vs effort level
  ## Requirements
  ### Enable fast mode for your organization
  ### Require per-session opt-in
  ## Handle rate limits
  ## Research preview
  ## See also

## File: features-overview.md
  # Extend Claude Code
  ## Overview
  ## Match features to your goal
  ### Build your setup over time
  ### Compare similar features
  ### Understand how features layer
  ### Combine features
  ## Understand context costs
  ### Context cost by feature
  ### Understand how features load
  ## Learn more

## File: fullscreen.md
  # Fullscreen rendering
  ## Enable fullscreen rendering
  ## What changes
  ## Use the mouse
  ## Scroll the conversation
  ### Adjust wheel scroll speed
  ## Search and review the conversation
  ## Use with tmux
  ## Keep native text selection
  ## Research preview

## File: github-actions.md
  # Claude Code GitHub Actions
  ## Why use Claude Code GitHub Actions?
  ## What can Claude do?
  ### Claude Code Action
  ## Setup
  ## Quick setup
  ## Manual setup
  ## Upgrading from Beta
  ### Essential changes
  ### Breaking Changes Reference
  ### Before and After Example
  ## Example use cases
  ### Basic workflow
  ### Using skills
  ### Custom automation with prompts
  ### Common use cases
  ## Best practices
  ### CLAUDE.md configuration
  ### Security considerations
  ### Optimizing performance
  ### CI costs
  ## Configuration examples
  ## Using with AWS Bedrock & Google Vertex AI
  ### Prerequisites
  ## Troubleshooting
  ### Claude not responding to @claude commands
  ### CI not running on Claude's commits
  ### Authentication errors
  ## Advanced configuration
  ### Action parameters
  ### Alternative integration methods
  ### Customizing Claude's behavior

## File: gitlab-ci-cd.md
  # Claude Code GitLab CI/CD
  ## Why use Claude Code with GitLab?
  ## How it works
  ## What can Claude do?
  ## Setup
  ### Quick setup
  ### Manual setup (recommended for production)
  ## Example use cases
  ### Turn issues into MRs
  ### Get implementation help
  ### Fix bugs quickly
  ## Using with AWS Bedrock & Google Vertex AI
  ## Configuration examples
  ### Basic .gitlab-ci.yml (Claude API)
  ### AWS Bedrock job example (OIDC)
  ### Google Vertex AI job example (Workload Identity Federation)
  ## Best practices
  ### CLAUDE.md configuration
  ### Security considerations
  ### Optimizing performance
  ### CI costs
  ## Security and governance
  ## Troubleshooting
  ### Claude not responding to @claude commands
  ### Job can't write comments or open MRs
  ### Authentication errors
  ## Advanced configuration
  ### Common parameters and variables
  ### Customizing Claude's behavior

## File: headless.md
  # Run Claude Code programmatically
  ## Basic usage
  ### Start faster with bare mode
  ## Examples
  ### Get structured output
  ### Stream responses
  ### Auto-approve tools
  ### Create a commit
  ### Customize the system prompt
  ### Continue conversations
  # First request
  # Continue the most recent conversation
  ## Next steps

## File: hooks-guide.md
  # Automate workflows with hooks
  ## Set up your first hook
  ## What you can automate
  ### Get notified when Claude needs input
  ### Auto-format code after edits
  ### Block edits to protected files
  ### Re-inject context after compaction
  ### Audit configuration changes
  ### Reload environment when directory or files change
  ### Auto-approve specific permission prompts
  ## How hooks work
  ### Read input and return output
  ### Filter hooks with matchers
  ### Configure hook location
  ## Prompt-based hooks
  ## Agent-based hooks
  ## HTTP hooks
  ## Limitations and troubleshooting
  ### Limitations
  ### Hooks and permission modes
  ### Hook not firing
  ### Hook error in output
  ### `/hooks` shows no hooks configured
  ### Stop hook runs forever
  # ... rest of your hook logic
  ### JSON validation failed
  # In ~/.zshrc or ~/.bashrc
  ### Debug techniques
  ## Learn more

## File: hooks.md
  # Hooks reference
  ## Hook lifecycle
  ### How a hook resolves
  # .claude/hooks/block-rm.sh
  ## Configuration
  ### Hook locations
  ### Matcher patterns
  ### Hook handler fields
  ### Reference scripts by path
  ### Hooks in skills and agents
  ### The `/hooks` menu
  ### Disable or remove hooks
  ## Hook input and output
  ### Common input fields
  ### Exit code output
  # Reads JSON input from stdin, checks the command
  ### HTTP response handling
  ### JSON output
  ## Hook events
  ### SessionStart
  # Run your setup commands that modify the environment
  ### InstructionsLoaded
  ### UserPromptSubmit
  ### PreToolUse
  ### PermissionRequest
  ### PostToolUse
  ### PostToolUseFailure
  ### PermissionDenied
  ### Notification
  ### SubagentStart
  ### SubagentStop
  ### TaskCreated
  ### TaskCompleted
  # Run the test suite
  ### Stop
  ### StopFailure
  ### TeammateIdle
  ### ConfigChange
  ### CwdChanged
  ### FileChanged
  ### WorktreeCreate
  ### WorktreeRemove
  ### PreCompact
  ### PostCompact
  ### SessionEnd
  ### Elicitation
  ### ElicitationResult
  ## Prompt-based hooks
  ### How prompt-based hooks work
  ### Prompt hook configuration
  ### Response schema
  ### Example: Multi-criteria Stop hook
  ## Agent-based hooks
  ### How agent hooks work
  ### Agent hook configuration
  ## Run hooks in the background
  ### Configure an async hook
  ### How async hooks execute
  ### Example: run tests after file changes
  # run-tests-async.sh
  # Read hook input from stdin
  # Only run tests for source files
  # Run tests and report results via systemMessage
  ### Limitations
  ## Security considerations
  ### Disclaimer
  ### Security best practices
  ## Windows PowerShell tool
  ## Debug hooks

## File: how-claude-code-works.md
  # How Claude Code works
  ## The agentic loop
  ### Models
  ### Tools
  ## What Claude can access
  ## Environments and interfaces
  ### Execution environments
  ### Interfaces
  ## Work with sessions
  ### Work across branches
  ### Resume or fork sessions
  ### The context window
  ## Stay safe with checkpoints and permissions
  ### Undo changes with checkpoints
  ### Control what Claude can do
  ## Work effectively with Claude Code
  ### Ask Claude Code for help
  ### It's a conversation
  ### Be specific upfront
  ### Give Claude something to verify against
  ### Explore before implementing
  ### Delegate, don't dictate
  ## What's next

## File: interactive-mode.md
  # Interactive mode
  ## Keyboard shortcuts
  ### General controls
  ### Text editing
  ### Theme and display
  ### Multiline input
  ### Quick commands
  ### Transcript viewer
  ### Voice input
  ## Commands
  ## Vim editor mode
  ### Mode switching
  ### Navigation (NORMAL mode)
  ### Editing (NORMAL mode)
  ### Text objects (NORMAL mode)
  ## Command history
  ### Reverse search with Ctrl+R
  ## Background bash commands
  ### How backgrounding works
  ### Bash mode with `!` prefix
  ## Prompt suggestions
  ## Side questions with /btw
  ## Task list
  ## PR review status
  ## See also

## File: keybindings.md
  # Customize keyboard shortcuts
  ## Configuration file
  ## Contexts
  ## Available actions
  ### App actions
  ### History actions
  ### Chat actions
  ### Autocomplete actions
  ### Confirmation actions
  ### Permission actions
  ### Transcript actions
  ### History search actions
  ### Task actions
  ### Theme actions
  ### Help actions
  ### Tabs actions
  ### Attachments actions
  ### Footer actions
  ### Message selector actions
  ### Diff actions
  ### Model picker actions
  ### Select actions
  ### Plugin actions
  ### Settings actions
  ### Voice actions
  ### Scroll actions
  ## Keystroke syntax
  ### Modifiers
  ### Uppercase letters
  ### Chords
  ### Special keys
  ## Unbind default shortcuts
  ## Reserved shortcuts
  ## Terminal conflicts
  ## Vim mode interaction
  ## Validation

## File: legal-and-compliance.md
  # Legal and compliance
  ## Legal agreements
  ### License
  ### Commercial agreements
  ## Compliance
  ### Healthcare compliance (BAA)
  ## Usage policy
  ### Acceptable use
  ### Authentication and credential use
  ## Security and trust
  ### Trust and safety
  ### Security vulnerability reporting

## File: llm-gateway.md
  # LLM gateway configuration
  ## Gateway requirements
  ## Configuration
  ### Model selection
  ## LiteLLM configuration
  ### Prerequisites
  ### Basic LiteLLM setup
  # Set in environment
  # Or in Claude Code settings
  # ~/bin/get-litellm-key.sh
  # Example: Fetch key from vault
  # Example: Generate JWT token
  # Refresh every hour (3600000 ms)
  ## Additional resources

## File: mcp.md
  # Connect Claude Code to tools via MCP
  ## What you can do with MCP
  ## Popular MCP servers
  ## Installing MCP servers
  ### Option 1: Add a remote HTTP server
  # Basic syntax
  # Real example: Connect to Notion
  # Example with Bearer token
  ### Option 2: Add a remote SSE server
  # Basic syntax
  # Real example: Connect to Asana
  # Example with authentication header
  ### Option 3: Add a local stdio server
  # Basic syntax
  # Real example: Add Airtable server
  ### Managing your servers
  # List all configured servers
  # Get details for a specific server
  # Remove a server
  # (within Claude Code) Check server status
  ### Dynamic tool updates
  ### Push messages with channels
  ### Plugin-provided MCP servers
  # Within Claude Code, see all MCP servers including plugin ones
  ## MCP installation scopes
  ### Local scope
  # Add a local-scoped server (default)
  # Explicitly specify local scope
  ### Project scope
  # Add a project-scoped server
  ### User scope
  # Add a user server
  ### Scope hierarchy and precedence
  ### Environment variable expansion in `.mcp.json`
  ## Practical examples
  ### Example: Monitor errors with Sentry
  ### Example: Connect to GitHub for code reviews
  ### Example: Query your PostgreSQL database
  ## Authenticate with remote MCP servers
  ### Use a fixed OAuth callback port
  # Fixed callback port with dynamic client registration
  ### Use pre-configured OAuth credentials
  ### Override OAuth metadata discovery
  ### Use dynamic headers for custom authentication
  ## Add MCP servers from JSON configuration
  ## Import MCP servers from Claude Desktop
  ## Use MCP servers from Claude.ai
  ## Use Claude Code as an MCP server
  # Start Claude as a stdio MCP server
  ## MCP output limits and warnings
  ### Raise the limit for a specific tool
  ## Respond to MCP elicitation requests
  ## Use MCP resources
  ### Reference MCP resources
  ## Scale with MCP Tool Search
  ### How it works
  ### For MCP server authors
  ### Configure tool search
  # Use a custom 5% threshold
  # Disable tool search entirely
  ## Use MCP prompts as commands
  ### Execute MCP prompts
  ## Managed MCP configuration
  ### Option 1: Exclusive control with managed-mcp.json
  ### Option 2: Policy-based control with allowlists and denylists

## File: memory.md
  # How Claude remembers your project
  ## CLAUDE.md vs auto memory
  ## CLAUDE.md files
  ### When to add to CLAUDE.md
  ### Choose where to put CLAUDE.md files
  ### Set up a project CLAUDE.md
  ### Write effective instructions
  ### Import additional files
  # Additional Instructions
  # Individual Preferences
  ### AGENTS.md
  ## Claude Code
  ### How CLAUDE.md files load
  ### Organize rules with `.claude/rules/`
  # API Development Rules
  ### Manage CLAUDE.md for large teams
  ## Auto memory
  ### Enable or disable auto memory
  ### Storage location
  ### How it works
  ### Audit and edit your memory
  ## View and edit with `/memory`
  ## Troubleshoot memory issues
  ### Claude isn't following my CLAUDE.md
  ### I don't know what auto memory saved
  ### My CLAUDE.md is too large
  ### Instructions seem lost after `/compact`
  ## Related resources

## File: model-config.md
  # Model configuration
  ## Available models
  ### Model aliases
  ### Setting your model
  # Start with Opus
  # Switch to Sonnet during session
  ## Restrict model selection
  ### Default model behavior
  ### Control the model users run on
  ### Merge behavior
  ### Mantle model IDs
  ## Special model behavior
  ### `default` model setting
  ### `opusplan` model setting
  ### Adjust effort level
  ### Extended context
  # Use the opus[1m] or sonnet[1m] alias
  # Or append [1m] to a full model name
  ## Checking your current model
  ## Add a custom model option
  ## Environment variables
  ### Pin models for third-party deployments
  ### Customize pinned model display and capabilities
  ### Override model IDs per version
  ### Prompt caching configuration

## File: monitoring-usage.md
  # Monitoring
  ## Quick start
  # 1. Enable telemetry
  # 2. Choose exporters (both are optional - configure only what you need)
  # 3. Configure OTLP endpoint (for OTLP exporter)
  # 4. Set authentication (if required)
  # 5. For debugging: reduce export intervals
  # 6. Run Claude Code
  ## Administrator configuration
  ## Configuration details
  ### Common configuration variables
  ### Metrics cardinality control
  ### Traces (beta)
  ### Dynamic headers
  # Example: Multiple headers
  ### Multi-team organization support
  # Add custom attributes for team identification
  ### Example configurations
  # Console debugging (1-second intervals)
  # OTLP/gRPC
  # Prometheus
  # Multiple exporters
  # Different endpoints/backends for metrics and logs
  # Metrics only (no events/logs)
  # Events/logs only (no metrics)
  ## Available metrics and events
  ### Standard attributes
  ### Metrics
  ### Metric details
  ### Events
  ## Interpret metrics and events data
  ### Usage monitoring
  ### Cost monitoring
  ### Alerting and segmentation
  ### Detect retry exhaustion
  ### Event analysis
  ## Backend considerations
  ### For metrics
  ### For events/logs
  ### For traces
  ## Service information
  ## ROI measurement resources
  ## Security and privacy
  ## Monitor Claude Code on Amazon Bedrock

## File: network-config.md
  # Enterprise network configuration
  ## Proxy configuration
  ### Environment variables
  # HTTPS proxy (recommended)
  # HTTP proxy (if HTTPS not available)
  # Bypass proxy for specific requests - space-separated format
  # Bypass proxy for specific requests - comma-separated format
  # Bypass proxy for all requests
  ### Basic authentication
  ## Custom CA certificates
  ## mTLS authentication
  # Client certificate for authentication
  # Client private key
  # Optional: Passphrase for encrypted private key
  ## Network access requirements
  ## Additional resources

## File: output-styles.md
  # Output styles
  ## Built-in output styles
  ## How output styles work
  ## Change your output style
  ## Create a custom output style
  # Custom Style Instructions
  ## Specific Behaviors
  ### Frontmatter
  ## Comparisons to related features
  ### Output Styles vs. CLAUDE.md vs. --append-system-prompt
  ### Output Styles vs. [Agents](/en/sub-agents)
  ### Output Styles vs. [Skills](/en/skills)

## File: overview.md
  # Claude Code overview
  ## Get started
  ## What you can do
  ## Use Claude Code everywhere
  ## Next steps

## File: permission-modes.md
  # Choose a permission mode
  ## Available modes
  ## Switch permission modes
  ## Auto-approve file edits with acceptEdits mode
  ## Analyze before you edit with plan mode
  ## Eliminate prompts with auto mode
  ### What the classifier blocks by default
  ### When auto mode falls back
  ## Allow only pre-approved tools with dontAsk mode
  ## Skip all checks with bypassPermissions mode
  ## Protected paths
  ## See also

## File: permissions.md
  # Configure permissions
  ## Permission system
  ## Manage permissions
  ## Permission modes
  ## Permission rule syntax
  ### Match all uses of a tool
  ### Use specifiers for fine-grained control
  ### Wildcard patterns
  ## Tool-specific permission rules
  ### Bash
  ### Read and Edit
  ### WebFetch
  ### MCP
  ### Agent (subagents)
  ## Extend permissions with hooks
  ## Working directories
  ### Additional directories grant file access, not configuration
  ## How permissions interact with sandboxing
  ## Managed settings
  ### Managed-only settings
  ## Review auto mode denials
  ## Configure the auto mode classifier
  ### Define trusted infrastructure
  ### Override the block and allow rules
  ### Inspect the defaults and your effective config
  ## Settings precedence
  ## Example configurations
  ## See also

## File: platforms.md
  # Platforms and integrations
  ## Where to run Claude Code
  ## Connect your tools
  ## Work when you are away from your terminal
  ## Related resources
  ### Platforms
  ### Integrations
  ### Remote access

## File: plugin-marketplaces.md
  # Create and distribute a plugin marketplace
  ## Overview
  ## Walkthrough: create a local marketplace
  ## Create the marketplace file
  ## Marketplace schema
  ### Required fields
  ### Owner fields
  ### Optional metadata
  ## Plugin entries
  ### Required fields
  ### Optional plugin fields
  ## Plugin sources
  ### Relative paths
  ### GitHub repositories
  ### Git repositories
  ### Git subdirectories
  ### npm packages
  ### Advanced plugin entries
  ### Strict mode
  ## Host and distribute marketplaces
  ### Host on GitHub (recommended)
  ### Host on other git services
  ### Private repositories
  ### Test locally before distribution
  ### Require marketplaces for your team
  ### Pre-populate plugins for containers
  ### Managed marketplace restrictions
  ### Version resolution and release channels
  ## Validation and testing
  ## Manage marketplaces from the CLI
  ### Plugin marketplace add
  ### Plugin marketplace list
  ### Plugin marketplace remove
  ### Plugin marketplace update
  ## Troubleshooting
  ### Marketplace not loading
  ### Marketplace validation errors
  ### Plugin installation failures
  ### Private repository authentication fails
  ### Marketplace updates fail in offline environments
  ### Git operations time out
  ### Plugins with relative paths fail in URL-based marketplaces
  ### Files not found after installation
  ## See also

## File: plugins.md
  # Create plugins
  ## When to use plugins vs standalone configuration
  ## Quickstart
  ### Prerequisites
  ### Create your first plugin
  ## Plugin structure overview
  ## Develop more complex plugins
  ### Add Skills to your plugin
  ### Add LSP servers to your plugin
  ### Ship default settings with your plugin
  ### Organize complex plugins
  ### Test your plugins locally
  ### Debug plugin issues
  ### Share your plugins
  ### Submit your plugin to the official marketplace
  ## Convert existing configurations to plugins
  ### Migration steps
  ### What changes when migrating
  ## Next steps
  ### For plugin users
  ### For plugin developers

## File: plugins-reference.md
  # Plugins reference
  ## Plugin components reference
  ### Skills
  ### Agents
  ### Hooks
  ### MCP servers
  ### LSP servers
  ## Plugin installation scopes
  ## Plugin manifest schema
  ### Complete schema
  ### Required fields
  ### Metadata fields
  ### Component path fields
  ### User configuration
  ### Channels
  ### Path behavior rules
  ### Environment variables
  ## Plugin caching and file resolution
  ### Path traversal limitations
  ### Working with external dependencies
  ## Plugin directory structure
  ### Standard plugin layout
  ### File locations reference
  ## CLI commands reference
  ### plugin install
  # Install to user scope (default)
  # Install to project scope (shared with team)
  # Install to local scope (gitignored)
  ### plugin uninstall
  ### plugin enable
  ### plugin disable
  ### plugin update
  ## Debugging and development tools
  ### Debugging commands
  ### Common issues
  ### Example error messages
  ### Hook troubleshooting
  ### MCP server troubleshooting
  ### Directory structure mistakes
  ## Distribution and versioning reference
  ### Version management
  ## See also

## File: quickstart.md
  # Quickstart
  ## Before you begin
  ## Step 1: Install Claude Code
  ## Step 2: Log in to your account
  # You'll be prompted to log in on first use
  # Follow the prompts to log in with your account
  ## Step 3: Start your first session
  ## Step 4: Ask your first question
  ## Step 5: Make your first code change
  ## Step 6: Use Git with Claude Code
  ## Step 7: Fix a bug or add a feature
  ## Step 8: Test out other common workflows
  ## Essential commands
  ## Pro tips for beginners
  ## What's next?
  ## Getting help

## File: remote-control.md
  # Continue local sessions from any device with Remote Control
  ## Requirements
  ## Start a Remote Control session
  ### Connect from another device
  ### Enable Remote Control for all sessions
  ## Connection and security
  ## Remote Control vs Claude Code on the web
  ## Limitations
  ## Troubleshooting
  ### "Remote Control requires a claude.ai subscription"
  ### "Remote Control requires a full-scope login token"
  ### "Unable to determine your organization for Remote Control eligibility"
  ### "Remote Control is not yet enabled for your account"
  ### "Remote Control is disabled by your organization's policy"
  ### "Remote credentials fetch failed"
  ## Choose the right approach
  ## Related resources

## File: sandboxing.md
  # Sandboxing
  ## Overview
  ## Why sandboxing matters
  ## How it works
  ### Filesystem isolation
  ### Network isolation
  ### OS-level enforcement
  ## Getting started
  ### Prerequisites
  ### Enable sandboxing
  ### Sandbox modes
  ### Configure sandboxing
  ## Security benefits
  ### Protection against prompt injection
  ### Reduced attack surface
  ### Transparent operation
  ## Security Limitations
  ## How sandboxing relates to permissions
  ## Advanced usage
  ### Custom proxy configuration
  ### Integration with existing security tools
  ## Best practices
  ## Open source
  ## Limitations
  ## What sandboxing does not cover
  ## See also

## File: scheduled-tasks.md
  # Run prompts on a schedule
  ## Compare scheduling options
  ## Schedule a recurring prompt with /loop
  ### Interval syntax
  ### Loop over another command
  ## Set a one-time reminder
  ## Manage scheduled tasks
  ## How scheduled tasks run
  ### Jitter
  ### Seven-day expiry
  ## Cron expression reference
  ## Disable scheduled tasks
  ## Limitations

## File: security.md
  # Security
  ## How we approach security
  ### Security foundation
  ### Permission-based architecture
  ### Built-in protections
  ### User responsibility
  ## Protect against prompt injection
  ### Core protections
  ### Privacy safeguards
  ### Additional safeguards
  ## MCP security
  ## IDE security
  ## Cloud execution security
  ## Security best practices
  ### Working with sensitive code
  ### Team security
  ### Reporting security issues
  ## Related resources

## File: server-managed-settings.md
  # Configure server-managed settings (public beta)
  ## Requirements
  ## Choose between server-managed and endpoint-managed settings
  ## Configure server-managed settings
  ### Verify settings delivery
  ### Access control
  ### Managed-only settings
  ### Current limitations
  ## Settings delivery
  ### Settings precedence
  ### Fetch and caching behavior
  ### Enforce fail-closed startup
  ### Security approval dialogs
  ## Platform availability
  ## Audit logging
  ## Security considerations
  ## See also

## File: settings.md
  # Claude Code settings
  ## Configuration scopes
  ### Available scopes
  ### When to use each scope
  ### How scopes interact
  ### What uses scopes
  ## Settings files
  ### Available settings
  ### Global config settings
  ### Worktree settings
  ### Permission settings
  ### Permission rule syntax
  ### Sandbox settings
  ### Attribution settings
  ### File suggestion settings
  ### Hook configuration
  ### Settings precedence
  ### Verify active settings
  ### Key points about the configuration system
  ### System prompt
  ### Excluding sensitive files
  ## Subagent configuration
  ## Plugin configuration
  ### Plugin settings
  ### Managing plugins
  ## Environment variables
  ## Tools available to Claude
  ## See also

## File: setup.md
  # Advanced setup
  ## System requirements
  ### Additional dependencies
  ## Install Claude Code
  ### Set up on Windows
  ### Alpine Linux and musl-based distributions
  ## Verify your installation
  ## Authenticate
  ## Update Claude Code
  ### Auto-updates
  ### Configure release channel
  ### Disable auto-updates
  ### Update manually
  ## Advanced installation options
  ### Install a specific version
  ### Deprecated npm installation
  # Install the native binary
  # Remove the old npm installation
  ### Binary integrity and code signing
  ## Uninstall Claude Code
  ### Native installation
  ### Homebrew installation
  ### WinGet installation
  ### npm
  ### Remove configuration files

## File: skills.md
  # Extend Claude with skills
  ## Bundled skills
  ## Getting started
  ### Create your first skill
  ### Where skills live
  ## Configure skills
  ### Types of skill content
  ### Frontmatter reference
  ### Add supporting files
  ## Additional resources
  ### Control who invokes a skill
  ### Skill content lifecycle
  ### Pre-approve tools for a skill
  ### Pass arguments to skills
  ## Advanced patterns
  ### Inject dynamic context
  ## Pull request context
  ## Your task
  ## Environment
  ### Run skills in a subagent
  ### Restrict Claude's skill access
  # Add to deny rules:
  # Allow only specific skills
  # Deny specific skills
  ## Share skills
  ### Generate visual output
  # Codebase Visualizer
  ## Usage
  ## What the visualization shows
  ## Troubleshooting
  ### Skill not triggering
  ### Skill triggers too often
  ### Skill descriptions are cut short
  ## Related resources

## File: statusline.md
  # Customize your status line
  ## Set up a status line
  ### Use the /statusline command
  ### Manually configure a status line
  ### Disable the status line
  ## Build a status line step by step
  ## How status lines work
  ## Available data
  ### Context window fields
  ## Examples
  ### Context window usage
  ### Git status with colors
  ### Cost and duration tracking
  ### Display multiple lines
  ### Clickable links
  ### Rate limit usage
  ### Cache expensive operations
  ### Windows configuration
  ## Tips
  ## Troubleshooting

## File: sub-agents.md
  # Create custom subagents
  ## Built-in subagents
  ## Quickstart: create your first subagent
  ## Configure subagents
  ### Use the /agents command
  ### Choose the subagent scope
  ### Write subagent files
  ### Choose a model
  ### Control subagent capabilities
  # ./scripts/validate-readonly-query.sh
  # Block SQL write operations (case-insensitive)
  ### Define hooks for subagents
  ## Work with subagents
  ### Understand automatic delegation
  ### Invoke subagents explicitly
  ### Run subagents in foreground or background
  ### Common patterns
  ### Choose between subagents and main conversation
  ### Manage subagent context
  ## Example subagents
  ### Code reviewer
  ### Debugger
  ### Data scientist
  ### Database query validator
  # Blocks SQL write operations, allows SELECT queries
  # Read JSON input from stdin
  # Extract the command field from tool_input using jq
  # Block write operations (case-insensitive)
  ## Next steps

## File: terminal-config.md
  # Optimize your terminal setup
  ### Themes and appearance
  ### Line breaks
  ### Notification setup
  ### Reduce flicker and memory usage
  ### Handling large inputs
  ### Vim Mode

## File: third-party-integrations.md
  # Enterprise deployment overview
  ## Compare deployment options
  ## Configure proxies and gateways
  ### Amazon Bedrock
  ### Microsoft Foundry
  ### Google Vertex AI
  ## Best practices for organizations
  ### Invest in documentation and memory
  ### Simplify deployment
  ### Start with guided usage
  ### Pin model versions for cloud providers
  ### Configure security policies
  ### Leverage MCP for integrations
  ## Next steps

## File: tools-reference.md
  # Tools reference
  ## Bash tool behavior
  ## LSP tool behavior
  ## Monitor tool
  ## PowerShell tool
  ### Enable the PowerShell tool
  ### Shell selection in settings, hooks, and skills
  ### Preview limitations
  ## Check which tools are available
  ## See also

## File: troubleshooting.md
  # Troubleshooting
  ## Troubleshoot installation issues
  ## Debug installation problems
  ### Check network connectivity
  ### Verify your PATH
  ### Check for conflicting installations
  ### Check directory permissions
  ### Verify the binary works
  ## Common installation issues
  ### Install script returns HTML instead of a shell script
  ### `command not found: claude` after installation
  ### `curl: (56) Failure writing output to destination`
  ### TLS or SSL connection errors
  ### `Failed to fetch version from storage.googleapis.com`
  ### Windows: `irm` or `&&` not recognized
  ### Install killed on low-memory Linux servers
  ### Install hangs in Docker
  ### Windows: Claude Desktop overrides `claude` CLI command
  ### Windows: "Claude Code on Windows requires git-bash"
  ### Linux: wrong binary variant installed (musl/glibc mismatch)
  ### `Illegal instruction` on Linux
  ### `dyld: cannot load` on macOS
  ### Windows installation issues: errors in WSL
  # Load nvm if it exists
  ### WSL2 sandbox setup
  ### Permission errors during installation
  ## Permissions and authentication
  ### Repeated permission prompts
  ### Authentication issues
  ### OAuth error: Invalid code
  ### 403 Forbidden after login
  ### Model not found or not accessible
  ### "This organization has been disabled" with an active subscription
  ### OAuth login fails in WSL2
  ### "Not logged in" or token expired
  ## Configuration file locations
  ### Resetting configuration
  # Reset all user settings and state
  # Reset project-specific settings
  ## Performance and stability
  ### High CPU or memory usage
  ### Auto-compaction stops with a thrashing error
  ### Command hangs or freezes
  ### Search and discovery issues
  # macOS (Homebrew)  
  # Windows (winget)
  # Ubuntu/Debian
  # Alpine Linux
  # Arch Linux
  ### Slow or incomplete search results on WSL
  ## IDE integration issues
  ### JetBrains IDE not detected on WSL2
  ### Report Windows IDE integration issues
  ### Escape key not working in JetBrains IDE terminals
  ## Markdown formatting issues
  ### Missing language tags in code blocks
  ### Inconsistent spacing and formatting
  ### Reduce markdown formatting issues
  ## Get more help

## File: ultraplan.md
  # Plan in the cloud with ultraplan
  ## Launch ultraplan from the CLI
  ## Review and revise the plan in your browser
  ## Choose where to execute
  ### Execute on the web
  ### Send the plan back to your terminal
  ## Related resources

## File: voice-dictation.md
  # Voice dictation
  ## Requirements
  ## Enable voice dictation
  ## Record a prompt
  ## Change the dictation language
  ## Rebind the push-to-talk key
  ## Troubleshooting
  ### Terminal not listed in macOS Microphone settings
  ## See also

## File: vs-code.md
  # Use Claude Code in VS Code
  ## Prerequisites
  ## Install the extension
  ## Get started
  ## Use the prompt box
  ### Reference files and folders
  ### Resume past conversations
  ### Resume remote sessions from Claude.ai
  ## Customize your workflow
  ### Choose where Claude lives
  ### Run multiple conversations
  ### Switch to terminal mode
  ## Manage plugins
  ### Install plugins
  ### Manage marketplaces
  ## Automate browser tasks with Chrome
  ## VS Code commands and shortcuts
  ### Launch a VS Code tab from other tools
  ## Configure settings
  ### Extension settings
  ## VS Code extension vs. Claude Code CLI
  ### Rewind with checkpoints
  ### Run CLI in VS Code
  ### Switch between extension and CLI
  ### Include terminal output in prompts
  ### Monitor background processes
  ### Connect to external tools with MCP
  ## Work with git
  ### Create commits and pull requests
  ### Use git worktrees for parallel tasks
  ## Use third-party providers
  ## Security and privacy
  ### The built-in IDE MCP server
  ## Fix common issues
  ### Extension won't install
  ### Spark icon not visible
  ### Claude Code never responds
  ## Uninstall the extension
  ## Next steps

## File: web-quickstart.md
  # Get started with Claude Code on the web
  ## How sessions run
  ## Compare ways to run Claude Code
  ## Connect GitHub and create an environment
  ### Connect from your terminal
  ## Start a task
  ## Review and iterate
  ## Troubleshoot setup
  ### No repositories appear after connecting GitHub
  ### The page only shows a GitHub login button
  ### "Not available for the selected organization"
  ### `/web-setup` returns "Unknown command"
  ### "No cloud environment available" when using `--remote`
  ### Setup script failed
  ### Session keeps running after closing the tab
  ## Next steps

## File: web-scheduled-tasks.md
  # Schedule tasks on the web
  ## Compare scheduling options
  ## Create a scheduled task
  ### Frequency options
  ### Repositories and branch permissions
  ### Connectors
  ### Environments
  ## Manage scheduled tasks
  ### View and interact with runs
  ### Edit and control tasks
  ## Related resources

## File: whats-new-2026-w13.md
  # Week 13 · March 23–27, 2026

## File: whats-new-2026-w14.md
  # Week 14 · March 30 – April 3, 2026

## File: whats-new.md
  # What's new

## File: zero-data-retention.md
  # Zero data retention
  ## ZDR scope
  ### What ZDR covers
  ### What ZDR does not cover
  ## Features disabled under ZDR
  ## Data retention for policy violations
  ## Request ZDR
