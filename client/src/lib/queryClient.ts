import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Sanitize a URL string: collapse consecutive slashes in the path portion
 * (after the protocol) and strip a trailing slash.
 */
function sanitizeUrl(raw: string): string {
  // Collapse double+ slashes in the path (preserve protocol "//")
  const cleaned = raw.replace(/([^:]\/)\/+/g, "$1");
  // Strip trailing slash (unless the URL is just "/")
  return cleaned.length > 1 ? cleaned.replace(/\/+$/, "") : cleaned;
}

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const rawUrl = queryKey[0] as string;
    const url = sanitizeUrl(rawUrl);

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);

    const text = await res.text();
    if (!text) {
      throw new Error(`API returned empty response for ${url}`);
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`API returned invalid JSON for ${url}`);
    }

    if (data === null || data === undefined) {
      throw new Error(`API returned null/undefined for ${url}`);
    }

    return data;
  };

/**
 * Extract a human-readable message from an API error.
 * Strips the HTTP status prefix (e.g. "400: ") if present.
 */
function friendlyErrorMessage(error: Error): string {
  const msg = error.message;
  // Strip leading "NNN: " status prefix from throwIfResNotOk
  const stripped = msg.replace(/^\d{3}:\s*/, "");
  return stripped || "An unexpected error occurred";
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
    mutations: {
      retry: false,
      onError: (error: Error) => {
        console.error('[API Mutation Error]', error.message);
        toast({
          variant: "destructive",
          title: "Action failed",
          description: friendlyErrorMessage(error),
        });
      },
    },
  },
});

// Global query error handler — catches unhandled query failures and shows a toast.
// This runs in addition to any per-query onError callbacks.
queryClient.getQueryCache().config.onError = (error: Error) => {
  console.error('[API Query Error]', error.message);
  toast({
    variant: "destructive",
    title: "Failed to load data",
    description: friendlyErrorMessage(error),
  });
};
