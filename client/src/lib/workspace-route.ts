export function normalizeWorkspacePath(path: string): string {
  const raw = path.trim();
  if (!raw) {
    return '/';
  }

  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.hash.startsWith('#/')) {
      return parsed.hash.slice(1).split('?')[0] ?? '/';
    }
    return parsed.pathname || '/';
  } catch {
    // Fall through to conservative parsing.
  }

  if (raw.startsWith('/#/')) {
    return raw.slice(2).split('?')[0] ?? '/';
  }

  const normalized = raw.split('?')[0]?.split('#')[0] ?? raw;
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export function parseWorkspaceProjectRoute(path: string): { projectId: number; viewName?: string; canonicalPath: string } | undefined {
  const normalized = normalizeWorkspacePath(path);

  // Resilient extraction:
  // if a malformed URL contains repeated project segments, extract the LAST
  // valid one and immediately canonicalize back to /projects/:id/:view.
  const parts = normalized.split('/projects/').slice(1);
  if (parts.length === 0) {
    return undefined;
  }

  let parsedProjectId: number | undefined;
  let viewName: string | undefined;
  for (const part of parts) {
    const [idCandidate, viewCandidate] = part.split('/');
    const id = Number(idCandidate);
    if (!Number.isInteger(id) || id <= 0) {
      continue;
    }
    parsedProjectId = id;
    viewName = viewCandidate && viewCandidate.length > 0 ? viewCandidate : undefined;
  }

  if (parsedProjectId === undefined) {
    return undefined;
  }

  if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
    return undefined;
  }

  const canonicalPath = viewName
    ? `/projects/${String(parsedProjectId)}/${viewName}`
    : `/projects/${String(parsedProjectId)}`;

  return {
    projectId: parsedProjectId,
    viewName,
    canonicalPath,
  };
}

export function getUrlWorkspaceView(path: string): string | undefined {
  return parseWorkspaceProjectRoute(path)?.viewName;
}
