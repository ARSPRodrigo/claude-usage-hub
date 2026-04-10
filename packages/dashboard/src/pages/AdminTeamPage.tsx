import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/api/client';
import { Mail, Link, Trash2, CheckCircle, Clock, XCircle } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  status: 'pending' | 'accepted' | 'expired';
}

interface Member {
  id: string;
  email: string;
  displayName: string;
  role: string;
  developerId: string;
  createdAt: string;
}

function StatusBadge({ status }: { status: Invitation['status'] }) {
  const map = {
    pending: { label: 'Pending', icon: Clock, cls: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' },
    accepted: { label: 'Accepted', icon: CheckCircle, cls: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' },
    expired: { label: 'Expired', icon: XCircle, cls: 'text-slate-500 bg-slate-100 dark:bg-dark-800' },
  };
  const { label, icon: Icon, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

export function AdminTeamPage() {
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: invitations = [] } = useQuery({
    queryKey: ['admin-invitations'],
    queryFn: () => apiGet<Invitation[]>('/api/v1/admin/invitations'),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['admin-members'],
    queryFn: () => apiGet<Member[]>('/api/v1/admin/developers'),
  });

  const createInvite = useMutation({
    mutationFn: (email: string) =>
      apiPost<{ id: string; inviteUrl: string; email: string; expiresAt: string }>(
        '/api/v1/admin/invitations',
        { email },
      ),
    onSuccess: (data) => {
      setInviteUrl(data.inviteUrl);
      setInviteEmail('');
      void qc.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
  });

  const revokeInvite = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/api/v1/admin/invitations/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-invitations'] }),
  });

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Team Management</h1>

      {/* Invite form */}
      <div className="bg-white dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-800 p-5">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4" /> Invite a team member
        </h2>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => { setInviteEmail(e.target.value); setInviteUrl(null); }}
            placeholder="name@codegen.net"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-dark-700 bg-white dark:bg-dark-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => { if (e.key === 'Enter' && inviteEmail.trim()) createInvite.mutate(inviteEmail.trim()); }}
          />
          <button
            onClick={() => { if (inviteEmail.trim()) createInvite.mutate(inviteEmail.trim()); }}
            disabled={!inviteEmail.trim() || createInvite.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
          >
            Generate invite link
          </button>
        </div>

        {createInvite.isError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {createInvite.error instanceof Error ? createInvite.error.message : 'Failed to create invitation'}
          </p>
        )}

        {inviteUrl && (
          <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
              <Link className="h-3 w-3" /> Share this link via Slack/chat — expires in 7 days
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs text-blue-800 dark:text-blue-300 flex-1 break-all font-mono">{inviteUrl}</code>
              <button
                onClick={() => copyLink(inviteUrl)}
                className="shrink-0 px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invitations list */}
      {invitations.length > 0 && (
        <div className="bg-white dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-800">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Invitations</h2>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-dark-800">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <StatusBadge status={inv.status} />
                  <div>
                    <p className="text-sm text-slate-800 dark:text-slate-200">{inv.email}</p>
                    <p className="text-xs text-slate-400">
                      {inv.status === 'accepted'
                        ? `Accepted ${new Date(inv.acceptedAt!).toLocaleDateString()}`
                        : `Expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                {inv.status === 'pending' && (
                  <button
                    onClick={() => revokeInvite.mutate(inv.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                    title="Revoke invitation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Active members */}
      <div className="bg-white dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-800">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Members ({members.filter((m) => m.role === 'developer').length})
          </h2>
        </div>
        {members.filter((m) => m.role === 'developer').length === 0 ? (
          <p className="p-4 text-sm text-slate-400">No developers yet. Invite someone above.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-dark-800">
            {members
              .filter((m) => m.role === 'developer')
              .map((m) => (
                <li key={m.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{m.displayName}</p>
                    <p className="text-xs text-slate-400">{m.email}</p>
                  </div>
                  <p className="text-xs text-slate-400">Joined {new Date(m.createdAt).toLocaleDateString()}</p>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
