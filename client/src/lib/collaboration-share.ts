/**
 * BL-0549: Collaboration share link generation and parsing utilities.
 *
 * Generates shareable URLs that encode projectId and an optional role hint.
 * Role is encoded as a query parameter so the collaboration server can
 * assign the correct permissions when the invitee connects.
 */

import type { CollabRole } from '@shared/collaboration';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Valid roles for share links. Owner cannot be shared — only editor/viewer. */
export const SHAREABLE_ROLES: readonly CollabRole[] = ['editor', 'viewer'] as const;

/** Maximum number of collaborator avatars to display before showing "+N". */
export const MAX_VISIBLE_AVATARS = 4;

/* ------------------------------------------------------------------ */
/*  Share URL generation                                               */
/* ------------------------------------------------------------------ */

export interface ShareLinkOptions {
  projectId: number;
  role: CollabRole;
  /** Override origin for testing or custom deployments. */
  origin?: string;
}

/**
 * Generates a shareable project URL with an embedded role hint.
 *
 * Format: `{origin}/projects/{projectId}?role={role}`
 *
 * @throws {Error} If projectId is not a positive finite integer.
 * @throws {Error} If role is not a shareable role (owner is not allowed).
 */
export function generateShareUrl(options: ShareLinkOptions): string {
  const { projectId, role, origin } = options;

  if (!Number.isFinite(projectId) || projectId <= 0 || !Number.isInteger(projectId)) {
    throw new Error('projectId must be a positive integer');
  }

  if (!SHAREABLE_ROLES.includes(role)) {
    throw new Error(`Role "${role}" is not shareable. Use "editor" or "viewer".`);
  }

  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');
  const url = new URL(`/projects/${String(projectId)}`, base);
  url.searchParams.set('role', role);
  return url.toString();
}

/* ------------------------------------------------------------------ */
/*  Share URL parsing                                                  */
/* ------------------------------------------------------------------ */

export interface ParsedShareLink {
  projectId: number;
  role: CollabRole;
}

/**
 * Parses a share URL and extracts projectId and role.
 *
 * Returns `null` if the URL is malformed or missing required parts.
 */
export function parseShareUrl(url: string): ParsedShareLink | null {
  try {
    const parsed = new URL(url);
    const pathSegments = parsed.pathname.split('/').filter(Boolean);

    // Expected path: /projects/:projectId
    if (pathSegments.length < 2 || pathSegments[0] !== 'projects') {
      return null;
    }

    const projectId = Number(pathSegments[1]);
    if (!Number.isFinite(projectId) || projectId <= 0 || !Number.isInteger(projectId)) {
      return null;
    }

    const role = parsed.searchParams.get('role');
    if (!role || !SHAREABLE_ROLES.includes(role as CollabRole)) {
      return null;
    }

    return { projectId, role: role as CollabRole };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Avatar helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Returns initials for a username (first letter of first two words).
 * Falls back to first two characters if only one word.
 */
export function getInitials(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) {
    return '?';
  }

  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/**
 * Computes how many avatars to show and how many overflow.
 *
 * @returns `{ visible, overflowCount }` — visible is capped at MAX_VISIBLE_AVATARS.
 */
export function computeAvatarOverflow(totalUsers: number): { visible: number; overflowCount: number } {
  if (totalUsers <= 0) {
    return { visible: 0, overflowCount: 0 };
  }
  if (totalUsers <= MAX_VISIBLE_AVATARS) {
    return { visible: totalUsers, overflowCount: 0 };
  }
  return { visible: MAX_VISIBLE_AVATARS, overflowCount: totalUsers - MAX_VISIBLE_AVATARS };
}
