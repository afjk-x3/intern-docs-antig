'use client';

import React, { useState } from 'react';

export interface CreateRequirementInput {
  name: string;
  description?: string;
  accepted_types: string[];
  max_size_mb: number;
  due_date_type: 'fixed' | 'relative';
  due_date_value: string;
  routing_template_id?: string | null;
}

export interface CreateRoutingTemplateInput {
  name: string;
  steps: Array<{ step: number; role: 'approver' | 'admin'; name: string }>;
  sla_days: number;
}

interface Requirement {
  id: string;
  name: string;
  description?: string | null;
  accepted_types: string[];
  max_size_mb: number;
  due_date_type: 'fixed' | 'relative';
  due_date_value: string;
  routing_template_id?: string | null;
  version_number: number;
  routing_templates?: {
    id: string;
    name: string;
    sla_days?: number | null;
    steps?: Array<{ step: number; role?: string; user_id?: string; name: string }>;
  } | null;
}

interface RoutingTemplate {
  id: string;
  name: string;
  steps: Array<{ step: number; role?: string; user_id?: string; name: string }>;
  sla_days?: number | null;
}

interface AdminRequirementManagerProps {
  requirements: Requirement[];
  routingTemplates: RoutingTemplate[];
  onCreateRequirement: (data: CreateRequirementInput) => Promise<{ success?: boolean; error?: string }>;
}

export function AdminRequirementManager({
  requirements,
  routingTemplates,
  onCreateRequirement,
}: AdminRequirementManagerProps) {
  const [showReqModal, setShowReqModal] = useState(false);

  // Requirement form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [acceptedTypes, setAcceptedTypes] = useState<string[]>(['application/pdf', 'image/png', 'image/jpeg']);
  const [maxSizeMb, setMaxSizeMb] = useState(20);
  const [dueDateType, setDueDateType] = useState<'fixed' | 'relative'>('relative');
  const [dueDateValue, setDueDateValue] = useState('30');
  const [routingTemplateId, setRoutingTemplateId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowReqModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTypeToggle = (type: string) => {
    if (acceptedTypes.includes(type)) {
      if (acceptedTypes.length > 1) {
        setAcceptedTypes(acceptedTypes.filter((t) => t !== type));
      }
    } else {
      setAcceptedTypes([...acceptedTypes, type]);
    }
  };

  const handleReqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await onCreateRequirement({
        name,
        description,
        accepted_types: acceptedTypes,
        max_size_mb: Number(maxSizeMb),
        due_date_type: dueDateType,
        due_date_value: dueDateValue,
        routing_template_id: routingTemplateId || null,
      });
      if (res.error) throw new Error(res.error);
      setShowReqModal(false);
      window.location.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create requirement';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Requirement Definitions</h2>
          <p className="text-xs text-text-muted">Configure document requirements and linked approval workflows.</p>
        </div>
        <button
          onClick={() => setShowReqModal(true)}
          className="px-3.5 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover transition-colors shadow-xs"
        >
          + New Requirement
        </button>
      </div>

      {/* Requirements List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {requirements.map((req) => (
          <div
            key={req.id}
            className="bg-surface-bg border border-border-default rounded-2xl p-5 shadow-xs space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-text-primary">{req.name}</h3>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  Version {req.version_number}
                </span>
              </div>
              <span className="text-xs font-semibold text-brand-primary bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                {req.due_date_type === 'relative' ? `${req.due_date_value} days relative` : `Fixed: ${req.due_date_value}`}
              </span>
            </div>

            <p className="text-xs text-text-muted line-clamp-2">{req.description || 'No description'}</p>

            <div className="text-[11px] text-text-muted bg-surface-muted p-3 rounded-xl space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span>Types: {req.accepted_types.map((t) => t.split('/')[1]?.toUpperCase()).join(', ')}</span>
                <span>Max: {req.max_size_mb} MB</span>
              </div>
              <div className="pt-2 border-t border-border-default/60 flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-semibold text-text-primary">
                  Workflow: {req.routing_templates?.name || 'Default (1-Step)'}
                </span>
                <span className="text-[10px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-border-default">
                  Signatories: {req.routing_templates?.steps && req.routing_templates.steps.length > 0
                    ? req.routing_templates.steps.map((s) => (s.role === 'admin' ? 'Admin' : 'Supervisor')).join(' → ')
                    : 'Supervisor'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Requirement Modal */}
      {showReqModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-surface-bg p-6 shadow-xl border border-border-default space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-border-default">
              <h3 className="text-base font-bold text-text-primary">Create Requirement Definition</h3>
              <button
                onClick={() => setShowReqModal(false)}
                aria-label="Close dialog"
                className="text-text-muted hover:text-text-primary font-bold p-1"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleReqSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-text-primary mb-1">Requirement Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mid-term Evaluation Form"
                  className="w-full rounded-xl border border-border-default p-2.5 text-text-primary focus:border-brand-primary outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-text-primary mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Instructions for the intern..."
                  className="w-full rounded-xl border border-border-default p-2.5 text-text-primary focus:border-brand-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-primary mb-1">Due Date Rule</label>
                  <select
                    value={dueDateType}
                    onChange={(e) => {
                      const nextType = e.target.value as 'fixed' | 'relative';
                      setDueDateType(nextType);
                      setDueDateValue(nextType === 'relative' ? '30' : new Date().toISOString().split('T')[0]);
                    }}
                    className="w-full rounded-xl border border-border-default p-2.5 text-text-primary focus:border-brand-primary outline-none"
                  >
                    <option value="relative">Relative to Internship Start</option>
                    <option value="fixed">Fixed Calendar Date</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-text-primary mb-1">
                    {dueDateType === 'relative' ? 'Days from Start' : 'Date (YYYY-MM-DD)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={dueDateValue}
                    onChange={(e) => setDueDateValue(e.target.value)}
                    placeholder={dueDateType === 'relative' ? '30' : '2026-12-31'}
                    className="w-full rounded-xl border border-border-default p-2.5 text-text-primary focus:border-brand-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-primary mb-1">Routing Template</label>
                  <select
                    value={routingTemplateId}
                    onChange={(e) => setRoutingTemplateId(e.target.value)}
                    className="w-full rounded-xl border border-border-default p-2.5 text-text-primary focus:border-brand-primary outline-none"
                  >
                    <option value="">Default (Single Supervisor Review)</option>
                    {routingTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} (SLA: {t.sla_days}d)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-text-primary mb-1">Max Size (MB)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxSizeMb}
                    onChange={(e) => setMaxSizeMb(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-default p-2.5 text-text-primary focus:border-brand-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-text-primary mb-1.5">Accepted File Types</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptedTypes.includes('application/pdf')}
                      onChange={() => handleTypeToggle('application/pdf')}
                      className="rounded border-border-default text-brand-primary focus:ring-brand-primary cursor-pointer"
                    />
                    PDF
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptedTypes.includes('image/png')}
                      onChange={() => handleTypeToggle('image/png')}
                      className="rounded border-border-default text-brand-primary focus:ring-brand-primary cursor-pointer"
                    />
                    PNG
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptedTypes.includes('image/jpeg')}
                      onChange={() => handleTypeToggle('image/jpeg')}
                      className="rounded border-border-default text-brand-primary focus:ring-brand-primary cursor-pointer"
                    />
                    JPEG
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setShowReqModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Requirement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
