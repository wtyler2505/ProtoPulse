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
