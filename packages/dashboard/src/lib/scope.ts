import { useSyncExternalStore } from 'react';

/**
 * Active org/workspace scope — persisted to localStorage, broadcast to
 * subscribers via a tiny pub/sub. Used by admin pages and OrgSwitcher.
 *
 *   null orgId  = "All organizations"  (admin-only)
 *   null wsId   = "All workspaces"     (admin-only, within the selected org)
 */

export type OrgId = string | null;
export type WorkspaceId = string | null;

interface Scope {
  orgId: OrgId;
  workspaceId: WorkspaceId;
}

const STORAGE_ORG = 'cuh_active_org';
const STORAGE_WS = 'cuh_active_workspace';

function readFromStorage(): Scope {
  if (typeof window === 'undefined') return { orgId: null, workspaceId: null };
  const orgId = localStorage.getItem(STORAGE_ORG);
  const workspaceId = localStorage.getItem(STORAGE_WS);
  return {
    orgId: orgId && orgId !== 'null' ? orgId : null,
    workspaceId: workspaceId && workspaceId !== 'null' ? workspaceId : null,
  };
}

let current: Scope = readFromStorage();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getScope(): Scope {
  return current;
}

export function setScope(next: Partial<Scope>): void {
  const updated: Scope = { ...current, ...next };
  // Changing the org clears the workspace if not explicitly set.
  if ('orgId' in next && !('workspaceId' in next) && next.orgId !== current.orgId) {
    updated.workspaceId = null;
  }
  current = updated;
  if (typeof window !== 'undefined') {
    if (updated.orgId) localStorage.setItem(STORAGE_ORG, updated.orgId);
    else localStorage.removeItem(STORAGE_ORG);
    if (updated.workspaceId) localStorage.setItem(STORAGE_WS, updated.workspaceId);
    else localStorage.removeItem(STORAGE_WS);
  }
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React hook: returns the current scope and re-renders on change. */
export function useScope(): Scope {
  return useSyncExternalStore(subscribe, getScope, getScope);
}

/** Convert scope to URL query params for apiGet helpers. */
export function scopeToParams(scope: Scope): Record<string, string> {
  const out: Record<string, string> = {};
  if (scope.orgId) out['orgId'] = scope.orgId;
  if (scope.workspaceId) out['workspaceId'] = scope.workspaceId;
  return out;
}
