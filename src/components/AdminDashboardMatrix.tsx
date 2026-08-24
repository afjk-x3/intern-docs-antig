'use client';

import React, { useState, useMemo } from 'react';
import { AdminDashboardData } from '@lib/data/dashboard';
import { StatusBadge } from './StatusBadge';

export function AdminDashboardMatrix({ data }: { data: AdminDashboardData }) {
  const [filterReq, setFilterReq] = useState<string>('ALL');
  const [filterState, setFilterState] = useState<string>('ALL');
  const [filterApprover, setFilterApprover] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState(false);

  // Derive unique approvers for filter dropdown
  const approvers = useMemo(() => {
    const set = new Set<string>();
    data.submissions.forEach(s => {
      if (s.current_holder_email) set.add(s.current_holder_email);
    });
    return Array.from(set).sort();
  }, [data.submissions]);

  const filteredInterns = useMemo(() => {
    return data.interns.filter(intern => {
      // If we are filtering by requirement, state, or approver, we must check if the intern has a submission matching it
      if (filterReq === 'ALL' && filterState === 'ALL' && filterApprover === 'ALL') return true;

      const internSubs = data.submissions.filter(s => s.intern_id === intern.id);
      
      let matches = false;
      if (internSubs.length === 0) {
        // Intern has no submissions. 
        if (filterState === 'NOT_STARTED' && filterApprover === 'ALL') {
          // If we filtered by a specific req, intern matches if they have no sub for that req (meaning it's NOT_STARTED)
          matches = true;
        }
      } else {
        matches = internSubs.some(sub => {
          const matchReq = filterReq === 'ALL' || sub.requirement_id === filterReq;
          const matchState = filterState === 'ALL' || sub.state === filterState;
          const matchAppr = filterApprover === 'ALL' || sub.current_holder_email === filterApprover;
          return matchReq && matchState && matchAppr;
        });
        
        // Handle NOT_STARTED filtering for requirements that have no submission record
        if (!matches && filterState === 'NOT_STARTED') {
           const hasSubForReq = internSubs.some(s => filterReq === 'ALL' ? false : s.requirement_id === filterReq);
           if (!hasSubForReq && filterApprover === 'ALL') matches = true;
        }
      }
      return matches;
    });
  }, [data, filterReq, filterState, filterApprover]);

  const requirementsToRender = useMemo(() => {
    if (filterReq === 'ALL') return data.requirements;
    return data.requirements.filter(r => r.id === filterReq);
  }, [data.requirements, filterReq]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // In a real app we'd call a server action here to audit log and get the CSV.
      // For now we'll do a client-side export and assume the server route is used for the real FR-6.
      const res = await fetch(`/api/admin/export?req=${filterReq}&state=${filterState}&appr=${filterApprover}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `intern_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      alert('Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between bg-surface-bg p-4 rounded-xl border border-border-default shadow-xs">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Requirement</label>
            <select className="text-xs p-1.5 rounded border border-border-default bg-surface-muted" value={filterReq} onChange={e => setFilterReq(e.target.value)}>
              <option value="ALL">All Requirements</option>
              {data.requirements.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">State</label>
            <select className="text-xs p-1.5 rounded border border-border-default bg-surface-muted" value={filterState} onChange={e => setFilterState(e.target.value)}>
              <option value="ALL">All States</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="RETURNED">Returned</option>
              <option value="APPROVED">Approved</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Approver</label>
            <select className="text-xs p-1.5 rounded border border-border-default bg-surface-muted" value={filterApprover} onChange={e => setFilterApprover(e.target.value)}>
              <option value="ALL">All Approvers</option>
              {approvers.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-end">
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="bg-surface-bg border border-border-default rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-border-default text-xs text-text-muted sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="px-4 py-3 font-semibold whitespace-nowrap min-w-[200px] border-r border-border-default">
                  Intern ({filteredInterns.length})
                </th>
                {requirementsToRender.map(req => (
                  <th key={req.id} className="px-4 py-3 font-semibold whitespace-nowrap min-w-[140px] text-center border-r border-border-default last:border-0">
                    <div className="truncate w-full" title={req.name}>{req.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {filteredInterns.map(intern => (
                <tr key={intern.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 border-r border-border-default bg-white sticky left-0 z-0">
                    <div className="font-medium text-text-primary truncate" title={intern.email}>{intern.email}</div>
                  </td>
                  {requirementsToRender.map(req => {
                    const sub = data.submissions.find(s => s.intern_id === intern.id && s.requirement_id === req.id);
                    const state = sub ? sub.state : 'NOT_STARTED';
                    return (
                      <td key={req.id} className="px-4 py-3 text-center border-r border-border-default last:border-0">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <StatusBadge state={state} isOverdue={false} />
                          {sub?.current_holder_email && (
                            <span className="text-[10px] text-text-muted max-w-full truncate block" title={sub.current_holder_email}>
                              {sub.current_holder_email.split('@')[0]}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredInterns.length === 0 && (
                <tr>
                  <td colSpan={requirementsToRender.length + 1} className="px-4 py-8 text-center text-text-muted text-sm">
                    No interns match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
