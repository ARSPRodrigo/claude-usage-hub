import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Building2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUser, isPlatformAdmin } from '@/api/client';
import { useOrgList, useWorkspaceList } from '@/api/hooks';
import { useScope, setScope } from '@/lib/scope';

/**
 * Two dropdowns shown in the top bar: Organization + Workspace.
 *
 * Visible only if the user can see more than one org (platform admin / owner,
 * or any user who owns at least one org). Hidden for plain developers — they
 * are scoped to their single workspace anyway.
 */
export function OrgSwitcher() {
  const user = getUser();
  const scope = useScope();

  const isPlatform = isPlatformAdmin(user?.role);

  const { data: orgs = [] } = useOrgList();
  const { data: workspaces = [] } = useWorkspaceList(scope.orgId ?? null);

  // Show the switcher if the caller can see >1 org, OR if they're a platform
  // admin (they should always have the switcher even if there's only one org).
  if (!isPlatform && orgs.length < 2) return null;

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
        onPick={(id) => setScope({ orgId: id, workspaceId: null })}
        activeId={scope.orgId}
      />
      <Dropdown
        icon={Layers}
        label={wsLabel}
        items={[
          { id: null, label: 'All workspaces' },
          ...workspaces.map((w) => ({ id: w.id, label: w.name })),
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
          className="absolute right-0 top-full mt-1 min-w-[200px] bg-surface border border-line rounded-card shadow-popover overflow-hidden z-50"
        >
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id ?? '__all__'}
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
