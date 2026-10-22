import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Building2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiGet, getUser, isPlatformAdmin, isWorkspaceAdmin } from '@/api/client';
import { useOrgList, useWorkspaceList, type WorkspaceRow } from '@/api/hooks';
import { useScope, setScope, getScope } from '@/lib/scope';

// The built-in default workspace uses slug 'default'; orgs created later use 'default-ws'.
const isDefaultWs = (w: WorkspaceRow) => w.slug === 'default' || w.slug === 'default-ws';

/** Default workspace first, then the rest alphabetically (case-insensitive). */
function sortWorkspaces(ws: WorkspaceRow[]): WorkspaceRow[] {
  return [...ws].sort((a, b) =>
    Number(isDefaultWs(b)) - Number(isDefaultWs(a)) ||
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/**
 * Two dropdowns shown in the top bar: Organization + Workspace.
 *
 * Visible to anyone who can manage at least one org or workspace —
 * platform admins, platform owner, or org/workspace owners. Plain
 * developers don't see it (they're scoped to their own usage).
 */
export function OrgSwitcher() {
  const user = getUser();
  const scope = useScope();
  const qc = useQueryClient();

  const isPlatform = isPlatformAdmin(user?.role);
  const isWsAdmin = isWorkspaceAdmin(user?.role);
  const isOrgOwner = (user?.ownedOrgIds?.length ?? 0) > 0 || (user?.ownedWorkspaceIds?.length ?? 0) > 0;

  const { data: orgs = [] } = useOrgList();
  const { data: workspaces = [] } = useWorkspaceList(scope.orgId ?? null);

  // workspace_admin is locked to their single workspace — no switcher needed.
  if (isWsAdmin) return null;
  // Hide entirely for plain developers. Platform admins always see it; org
  // owners see it once they have at least one accessible org.
  if (!isPlatform && !isOrgOwner) return null;
  if (!isPlatform && orgs.length === 0) return null;

  // Switching org lands on that org's default workspace when it has one.
  const pickOrg = async (id: string | null) => {
    setScope({ orgId: id, workspaceId: null });
    if (!id) return;
    const list = await qc.fetchQuery({
      queryKey: ['workspaces', id],
      queryFn: () => apiGet<WorkspaceRow[]>('/api/v1/dashboard/workspaces', { orgId: id }),
      staleTime: 60_000,
    });
    const def = list.find(isDefaultWs);
    const now = getScope();
    if (def && now.orgId === id && now.workspaceId === null) setScope({ workspaceId: def.id });
  };

  const activeOrg = orgs.find((o) => o.id === scope.orgId);
  const activeWs = workspaces.find((w) => w.id === scope.workspaceId);

  const orgLabel = scope.orgId ? (activeOrg?.name ?? '…') : 'All organizations';
  const wsLabel = scope.workspaceId ? (activeWs?.name ?? '…') : 'All workspaces';

  return (
    <div className="flex items-center gap-2">
      <Dropdown
        icon={Building2}
        label={orgLabel}
        items={[
          ...(isPlatform ? [{ id: null, label: 'All organizations' }] : []),
          ...orgs.map((o) => ({ id: o.id, label: o.name })),
        ]}
        onPick={(id) => { void pickOrg(id); }}
        activeId={scope.orgId}
      />
      <Dropdown
        icon={Layers}
        label={wsLabel}
        items={[
          { id: null, label: 'All workspaces' },
          ...sortWorkspaces(workspaces).map((w) => ({ id: w.id, label: w.name })),
        ]}
        onPick={(id) => setScope({ workspaceId: id })}
        activeId={scope.workspaceId}
        disabled={!scope.orgId}
      />
    </div>
  );
}

interface DropdownProps {
  icon: typeof Building2;
  label: string;
  items: Array<{ id: string | null; label: string }>;
  activeId: string | null;
  onPick: (id: string | null) => void;
  disabled?: boolean;
}

function Dropdown({ icon: Icon, label, items, activeId, onPick, disabled }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the active item visible when the list is longer than the menu.
  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-[6px] border border-line bg-surface rounded-btn cursor-pointer transition-colors',
          'text-[12px] font-medium text-ink hover:bg-canvas-alt',
          disabled && 'opacity-50 cursor-not-allowed hover:bg-surface',
        )}
      >
        <Icon className="h-3.5 w-3.5 text-ink-3" />
        <span className="truncate max-w-[140px]">{label}</span>
        <ChevronDown className={cn('h-3 w-3 text-ink-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 min-w-[200px] bg-surface border border-line rounded-card shadow-popover max-h-[320px] overflow-y-auto z-50"
        >
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id ?? '__all__'}
                ref={active ? activeRef : undefined}
                onClick={() => { onPick(item.id); setOpen(false); }}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-left transition-colors',
                  active ? 'bg-canvas-alt font-medium text-ink' : 'text-ink-2 hover:bg-canvas-alt',
                )}
              >
                <span className="truncate">{item.label}</span>
                {active && <span className="mono text-[10px] text-ink-3">ACTIVE</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
