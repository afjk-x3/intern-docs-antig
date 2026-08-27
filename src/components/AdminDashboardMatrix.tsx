'use client';

import React, { useState, useMemo } from 'react';
import { AdminDashboardData } from '@lib/data/dashboard';
import { StatusBadge } from './StatusBadge';

const NEEDS_ACTION_STATES = new Set(['IN_REVIEW', 'RETURNED']);

export function AdminDashboardMatrix({ data }: { data: AdminDashboardData }) {
  const [filterReq, setFilterReq] = useState<string>('ALL');
  const [filterState, setFilterState] = useState<string>('ALL');
  const [filterApprover, setFilterApprover] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'needs-action' | 'full'>('needs-action');

  // Derive unique approvers for filter dropdown
  const approvers = useMemo(() => {
    const set = new Set<string>();
    data.submissions.forEach(s => {
      if (s.current_holder_email) set.add(s.current_holder_email);
    });
    return Array.from(set).sort();
  }, [data.submissions]);

  // Summary counts across the whole cohort, independent of the current filters -- these
  // drive the chip row above the grid.
  const summaryCounts = useMemo(() => {
    let complete = 0, inReview = 0, overdue = 0, returned = 0;
    for (const sub of data.submissions) {
      if (sub.state === 'APPROVED') complete++;
      if (sub.state === 'IN_REVIEW') inReview++;
      if (sub.state === 'RETURNED') returned++;
      if (sub.isOverdue) overdue++;
    }
    return { complete, inReview, overdue, returned };
  }, [data.submissions]);

  const dropdownFilteredInterns = useMemo(() => {
    return data.interns.filter(intern => {
      if (filterReq === 'ALL' && filterState === 'ALL' && filterApprover === 'ALL') return true;

      const internSubs = data.submissions.filter(s => s.intern_id === intern.id);

      let matches = false;
      if (internSubs.length === 0) {
        if (filterState === 'NOT_STARTED' && filterApprover === 'ALL') {
          matches = true;
        }
      } else {
        matches = internSubs.some(sub => {
          const matchReq = filterReq === 'ALL' || sub.requirement_id === filterReq;
          const matchState = filterState === 'ALL' || (filterState === 'OVERDUE' ? sub.isOverdue : sub.state === filterState);
          const matchAppr = filterApprover === 'ALL' || sub.current_holder_email === filterApprover;
          return matchReq && matchState && matchAppr;
        });

        if (!matches && filterState === 'NOT_STARTED') {
          const hasSubForReq = internSubs.some(s => filterReq === 'ALL' ? false : s.requirement_id === filterReq);
          if (!hasSubForReq && filterApprover === 'ALL') matches = true;
        }
      }
      return matches;
    });
  }, [data, filterReq, filterState, filterApprover]);

  const dropdownFilteredRequirements = useMemo(() => {
    if (filterReq === 'ALL') return data.requirements;
    return data.requirements.filter(r => r.id === filterReq);
  }, [data.requirements, filterReq]);

  // "Needs Action" (default): rows/columns are kept only if they contain at least one
  // In Review, Returned, or Overdue cell -- cells stay in their real row/column position,
  // never flattened into a separate list. This intersects with the dropdown filters above.
  const { filteredInterns, requirementsToRender } = useMemo(() => {
    if (viewMode === 'full') {
      return { filteredInterns: dropdownFilteredInterns, requirementsToRender: dropdownFilteredRequirements };
    }

    const needsActionInternIds = new Set<string>();
    const needsActionReqIds = new Set<string>();
    for (const sub of data.submissions) {
      if (NEEDS_ACTION_STATES.has(sub.state) || sub.isOverdue) {
        needsActionInternIds.add(sub.intern_id);
        needsActionReqIds.add(sub.requirement_id);
      }
    }

    return {
      filteredInterns: dropdownFilteredInterns.filter(i => needsActionInternIds.has(i.id)),
      requirementsToRender: dropdownFilteredRequirements.filter(r => needsActionReqIds.has(r.id)),
    };
  }, [viewMode, dropdownFilteredInterns, dropdownFilteredRequirements, data.submissions]);

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

  const chipFilter = (state: string) => setFilterState(prev => (prev === state ? 'ALL' : state));

  return (
    <div className="space-y-6">
      {/* Summary Count Chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'APPROVED', label: 'Complete', count: summaryCounts.complete, active: 'bg-emerald-600 text-white', idle: 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100' },
          { key: 'IN_REVIEW', label: 'In Review', count: summaryCounts.inReview, active: 'bg-amber-600 text-white', idle: 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100' },
          { key: 'OVERDUE', label: 'Overdue', count: summaryCounts.overdue, active: 'bg-red-600 text-white', idle: 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100' },
          { key: 'RETURNED', label: 'Returned', count: summaryCounts.returned, active: 'bg-rose-600 text-white', idle: 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100' },
        ].map(chip => (
          <button
            key={chip.key}
            type="button"
            onClick={() => chipFilter(chip.key)}
            aria-pressed={filterState === chip.key}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterState === chip.key ? chip.active : chip.idle}`}
          >
            {chip.label}: {chip.count}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between bg-surface-bg p-4 rounded-xl border border-border-default shadow-xs">
        <div className="flex flex-wrap gap-4 items-center">
          {/* View mode toggle */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">View</label>
            <div role="tablist" aria-label="Matrix view mode" className="flex bg-surface-muted rounded-lg p-1 border border-border-default text-xs">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'needs-action'}
                onClick={() => setViewMode('needs-action')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${viewMode === 'needs-action' ? 'bg-surface-bg text-brand-primary shadow-xs' : 'text-text-muted hover:text-text-primary'}`}
              >
                Needs Action
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'full'}
                onClick={() => setViewMode('full')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${viewMode === 'full' ? 'bg-surface-bg text-brand-primary shadow-xs' : 'text-text-muted hover:text-text-primary'}`}
              >
                Full Grid
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="filter-requirement" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Requirement</label>
            <select id="filter-requirement" className="text-xs p-1.5 rounded border border-border-default bg-surface-muted" value={filterReq} onChange={e => setFilterReq(e.target.value)}>
              <option value="ALL">All Requirements</option>
              {data.requirements.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filter-state" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">State</label>
            <select id="filter-state" className="text-xs p-1.5 rounded border border-border-default bg-surface-muted" value={filterState} onChange={e => setFilterState(e.target.value)}>
              <option value="ALL">All States</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="RETURNED">Returned</option>
              <option value="APPROVED">Approved</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-approver" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Approver</label>
            <select id="filter-approver" className="text-xs p-1.5 rounded border border-border-default bg-surface-muted" value={filterApprover} onChange={e => setFilterApprover(e.target.value)}>
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
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Intern requirement completion matrix">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-border-default text-xs text-text-muted sticky top-0 z-20 shadow-xs">
              <tr>
                <th className="px-4 py-3 font-semibold whitespace-nowrap min-w-[200px] border-r border-border-default sticky left-0 z-20 bg-slate-50">
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
                  <td className="px-4 py-3 border-r border-border-default bg-white sticky left-0 z-10">
                    <div className="font-medium text-text-primary truncate" title={intern.email}>{intern.email}</div>
                  </td>
                  {requirementsToRender.map(req => {
                    const sub = data.submissions.find(s => s.intern_id === intern.id && s.requirement_id === req.id);
                    const state = sub ? sub.state : 'NOT_STARTED';
                    return (
                      <td key={req.id} className="px-4 py-3 text-center border-r border-border-default last:border-0">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <StatusBadge state={state} isOverdue={sub?.isOverdue ?? false} />
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
                    {viewMode === 'needs-action'
                      ? 'Nothing needs action right now -- switch to Full Grid to see everything.'
                      : 'No interns match the current filters.'}
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
