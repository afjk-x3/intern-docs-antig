'use client';

import React, { useState, useMemo } from 'react';
import { humanizeCode } from '@/lib/utils';
import { Button } from './ui/button';

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  source_ip: string | null;
  created_at: string;
  users: {
    id: string;
    email: string;
  } | null;
}

interface AuditLogTableProps {
  initialLogs: AuditLogEntry[];
}

export function AuditLogTable({ initialLogs }: AuditLogTableProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Hardcoded for MVP, usually you'd query total count to hide "Load More"
  const [hasMore, setHasMore] = useState(initialLogs.length === 100);

  const fetchLogs = async (actor: string, limit: number) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const url = new URL('/api/admin/audit-log', window.location.origin);
      url.searchParams.set('limit', limit.toString());
      if (actor !== 'all') {
        url.searchParams.set('actor_id', actor);
      }
      
      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`Failed to fetch logs: ${res.statusText}`);
      }
      
      const data: AuditLogEntry[] = await res.json();
      setLogs(data);
      setHasMore(data.length >= limit);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch logs.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleActorFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newActor = e.target.value;
    setActorFilter(newActor);
    // When changing server-side filters, reset limit to 100
    fetchLogs(newActor, 100);
  };

  const handleLoadMore = () => {
    fetchLogs(actorFilter, logs.length + 100);
  };

  // Derive unique actors for the filter dropdown from the CURRENT loaded logs.
  // In a robust app this might be a separate API call, but for MVP this is fine since admins do most actions.
  const uniqueActors = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach(l => {
      if (l.users) map.set(l.users.id, l.users.email);
    });
    return Array.from(map.entries());
  }, [logs]);

  // Derive unique actions for client-side filtering
  const uniqueActions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => set.add(l.action));
    return Array.from(set).sort();
  }, [logs]);

  // Client-side filter for Action (since API doesn't support action filter currently based on the route.ts)
  const filteredLogs = useMemo(() => {
    if (actionFilter === 'all') return logs;
    return logs.filter(l => l.action === actionFilter);
  }, [logs, actionFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-surface-bg p-4 rounded-xl border border-border-default shadow-xs">
        <div className="w-full sm:w-auto">
          <label htmlFor="audit-actor-filter" className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Actor</label>
          <select
            id="audit-actor-filter"
            value={actorFilter}
            onChange={handleActorFilterChange}
            disabled={loading}
            className="w-full sm:w-64 border border-border-default rounded-lg p-2 text-xs text-text-primary focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
          >
            <option value="all">All Actors</option>
            {uniqueActors.map(([id, email]) => (
              <option key={id} value={id}>{email}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-auto">
          <label htmlFor="audit-action-filter" className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Action</label>
          <select
            id="audit-action-filter"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            disabled={loading}
            className="w-full sm:w-48 border border-border-default rounded-lg p-2 text-xs text-text-primary focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
          >
            <option value="all">All Actions</option>
            {uniqueActions.map(action => (
              <option key={action} value={action}>{humanizeCode(action)}</option>
            ))}
          </select>
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800 border border-rose-200 shadow-xs">
          {errorMsg}
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-bg border border-border-default rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Audit log entries">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-muted border-b border-border-default">
                <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider w-40">Timestamp</th>
                <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Actor</th>
                <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Target</th>
                <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider w-32">Source IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">
                    {loading ? 'Loading...' : 'No audit logs found matching the current filters.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-hover transition-colors align-top">
                    <td className="px-4 py-3 text-xs text-text-primary whitespace-nowrap align-top">
                      {new Intl.DateTimeFormat(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      }).format(new Date(log.created_at))}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-primary align-top">
                      {log.users ? (
                        <div className="flex flex-col">
                          <span className="font-semibold">{log.users.email}</span>
                          <span className="text-[10px] text-text-muted font-mono">{log.actor_id}</span>
                        </div>
                      ) : (
                        <span className="text-text-muted font-mono">{log.actor_id || 'System'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs align-top">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200"
                        title={log.action}
                      >
                        {humanizeCode(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-primary align-top">
                      <div className="flex flex-col">
                        <span className="font-medium">{humanizeCode(log.target_type)}</span>
                        {log.target_id && <span className="text-[10px] text-text-muted font-mono truncate max-w-[200px]" title={log.target_id}>{log.target_id}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted font-mono align-top">
                      {log.source_ip || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {hasMore && actionFilter === 'all' && (
          <div className="px-4 py-3 border-t border-border-default bg-surface-muted flex justify-center">
            <Button onClick={handleLoadMore} disabled={loading} variant="outline" size="sm">
              {loading ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
