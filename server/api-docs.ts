interface RouteDoc {
  method: string;
  path: string;
  description: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: string;
  response?: string;
}

export const apiDocs: RouteDoc[] = [
  { method: "POST", path: "/api/auth/register", description: "Register a new user", body: "{ username: string (3-50 chars, alphanumeric/_/-), password: string (6-128 chars) }", response: "{ sessionId, user: { id, username } }" },
  { method: "POST", path: "/api/auth/login", description: "Log in with credentials", body: "{ username: string, password: string }", response: "{ sessionId, user: { id, username } }" },
  { method: "POST", path: "/api/auth/logout", description: "Log out (invalidate session)", response: "204 No Content" },
  { method: "GET", path: "/api/auth/me", description: "Get current authenticated user", response: "{ id, username }" },
  { method: "GET", path: "/api/settings/api-keys", description: "List stored API key providers for current user", response: "{ providers: string[] }" },
  { method: "POST", path: "/api/settings/api-keys", description: "Store an API key for a provider", body: "{ provider: 'anthropic'|'gemini', apiKey: string }", response: "{ message: string }" },
  { method: "DELETE", path: "/api/settings/api-keys/:provider", description: "Delete a stored API key", params: { provider: "anthropic|gemini" }, response: "204 No Content" },
  { method: "GET", path: "/api/projects", description: "List all projects", query: { limit: "number (1-100, default 50)", offset: "number (default 0)", sort: "asc|desc (default desc)" } },
  { method: "GET", path: "/api/projects/:id", description: "Get a project by ID", params: { id: "Project ID" } },
  { method: "POST", path: "/api/projects", description: "Create a new project", body: "{ name: string, description?: string }" },
  { method: "PATCH", path: "/api/projects/:id", description: "Update a project", params: { id: "Project ID" }, body: "Partial<{ name, description }>" },
  { method: "DELETE", path: "/api/projects/:id", description: "Delete a project", params: { id: "Project ID" } },
  { method: "GET", path: "/api/projects/:id/nodes", description: "List architecture nodes", params: { id: "Project ID" }, query: { limit: "number", offset: "number", sort: "asc|desc" } },
  { method: "POST", path: "/api/projects/:id/nodes", description: "Create a node", params: { id: "Project ID" } },
  { method: "PUT", path: "/api/projects/:id/nodes", description: "Replace all nodes", params: { id: "Project ID" } },
  { method: "PATCH", path: "/api/projects/:id/nodes/:nodeId", description: "Update a node", params: { id: "Project ID", nodeId: "Node ID" } },
  { method: "GET", path: "/api/projects/:id/edges", description: "List architecture edges", params: { id: "Project ID" } },
  { method: "POST", path: "/api/projects/:id/edges", description: "Create an edge", params: { id: "Project ID" } },
  { method: "PUT", path: "/api/projects/:id/edges", description: "Replace all edges", params: { id: "Project ID" } },
  { method: "PATCH", path: "/api/projects/:id/edges/:edgeId", description: "Update an edge", params: { id: "Project ID", edgeId: "Edge ID" } },
  { method: "GET", path: "/api/projects/:id/bom", description: "List BOM items", params: { id: "Project ID" } },
  { method: "GET", path: "/api/projects/:id/bom/:bomId", description: "Get a BOM item", params: { id: "Project ID", bomId: "BOM Item ID" } },
  { method: "POST", path: "/api/projects/:id/bom", description: "Create a BOM item", params: { id: "Project ID" } },
  { method: "PATCH", path: "/api/projects/:id/bom/:bomId", description: "Update a BOM item", params: { id: "Project ID", bomId: "BOM Item ID" } },
  { method: "DELETE", path: "/api/projects/:id/bom/:bomId", description: "Delete a BOM item", params: { id: "Project ID", bomId: "BOM Item ID" } },
  { method: "GET", path: "/api/projects/:id/validation", description: "List validation issues", params: { id: "Project ID" } },
  { method: "POST", path: "/api/projects/:id/validation", description: "Create a validation issue", params: { id: "Project ID" } },
  { method: "PUT", path: "/api/projects/:id/validation", description: "Replace all validation issues", params: { id: "Project ID" } },
  { method: "DELETE", path: "/api/projects/:id/validation/:issueId", description: "Delete a validation issue", params: { id: "Project ID", issueId: "Issue ID" } },
  { method: "GET", path: "/api/projects/:id/chat", description: "List chat messages", params: { id: "Project ID" } },
  { method: "POST", path: "/api/projects/:id/chat", description: "Create a chat message", params: { id: "Project ID" } },
  { method: "DELETE", path: "/api/projects/:id/chat", description: "Delete all chat messages", params: { id: "Project ID" } },
  { method: "DELETE", path: "/api/projects/:id/chat/:msgId", description: "Delete a chat message", params: { id: "Project ID", msgId: "Message ID" } },
  { method: "GET", path: "/api/projects/:id/history", description: "List history items", params: { id: "Project ID" } },
  { method: "POST", path: "/api/projects/:id/history", description: "Create a history item", params: { id: "Project ID" } },
  { method: "DELETE", path: "/api/projects/:id/history", description: "Delete all history items", params: { id: "Project ID" } },
  { method: "DELETE", path: "/api/projects/:id/history/:itemId", description: "Delete a history item", params: { id: "Project ID", itemId: "History Item ID" } },
  { method: "POST", path: "/api/seed", description: "Seed demo project (dev only)" },
  { method: "POST", path: "/api/chat/ai", description: "Send AI chat message (non-streaming)" },
  { method: "POST", path: "/api/chat/ai/stream", description: "Send AI chat message (streaming SSE)" },
  { method: "GET", path: "/api/health", description: "Health check with DB connectivity" },
  { method: "GET", path: "/api/metrics", description: "Server metrics (request counts, avg latency)" },
  { method: "GET", path: "/api/docs", description: "This API documentation" },
];
