import { modules } from './registry'

/**
 * URL routing for the module shell. Each AI system is reachable at its own path
 * (e.g. /coding-ai, /eligibility-ai). The canonical slug is the module id;
 * friendlier aliases resolve to the same module.
 */
const ALIASES: Record<string, string> = {
  eligibility: 'eligibility-ai',
  'prior-auth': 'prior-authorization-ai',
  'prior-auth-ai': 'prior-authorization-ai',
  'prior-authorization': 'prior-authorization-ai',
  coding: 'coding-ai',
  ar: 'ar-denial-management',
  'ar-denial': 'ar-denial-management',
  denial: 'ar-denial-management',
  appeals: 'appeals-ai',
}

/** Resolve a URL pathname to a module id, or null if it maps to nothing. */
export function moduleIdFromPath(pathname: string): string | null {
  const seg = pathname.replace(/^\/+|\/+$/g, '').split('/')[0].toLowerCase()
  if (!seg) return null
  if (modules.some((m) => m.id === seg)) return seg
  return ALIASES[seg] ?? null
}

/** The canonical path for a module id (root for none). */
export function pathForModule(id: string | null): string {
  return id ? `/${id}` : '/'
}
