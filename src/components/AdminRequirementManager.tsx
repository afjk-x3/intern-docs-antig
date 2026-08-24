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
  steps: Array<{ step: number; role: 'approver' | 'admin' | 'system_admin'; name: string }>;
  sla_days: number;
}

export interface RoutingTemplate {
  id: string;
  name: string;
  steps: Array<{ step: number; role?: string; user_id?: string; name?: string }>;
  sla_days: number;
}

export interface Requirement {
  id: string;
  name: string;
  description: string;
  accepted_types: string[];
  max_size_mb: number;
  due_date_type: string;
  due_date_value: string;
  version_number: number;
  routing_templates?: RoutingTemplate | null;
}

interface AdminRequirementManagerProps {
  requirements: Requirement[];
  routingTemplates: RoutingTemplate[];
  onCreateRequirement: (data: CreateRequirementInput) => Promise<{ success?: boolean; error?: string }>;
  onCreateTemplate: (data: CreateRoutingTemplateInput) => Promise<{ success?: boolean; error?: string }>;
}

export function AdminRequirementManager({
  requirements,
  routingTemplates,
  onCreateRequirement,
  onCreateTemplate,
}: AdminRequirementManagerProps) {
  const [showReqModal, setShowReqModal] = useState(false);
  const [showTplModal, setShowTplModal] = useState(false);

  // Requirement form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [acceptedTypes, setAcceptedTypes] = useState<string[]>(['application/pdf', 'image/png', 'image/jpeg']);
  const [maxSizeMb, setMaxSizeMb] = useState(20);
  const [dueDateType, setDueDateType] = useState<'fixed' | 'relative'>('relative');
  const [dueDateValue, setDueDateValue] = useState('30');
  const [routingTemplateId, setRoutingTemplateId] = useState(routingTemplates[0]?.id || '');

  // Template form state
  const [tplName, setTplName] = useState('');
  const [tplSlaDays, setTplSlaDays] = useState(2);
  const [tplStepCount, setTplStepCount] = useState<1 | 2>(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowReqModal(false);
        setShowTplModal(false);
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

  const handleTplSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const steps: Array<{ step: number; role: 'approver' | 'admin'; name: string }> = [
        { step: 1, role: 'approver', name: 'Supervisor Review' },
      ];
      if (tplStepCount === 2) {
        steps.push({ step: 2, role: 'admin', name: 'Admin Final Review' });
      }

      const res = await onCreateTemplate({
        name: tplName,
        steps,
        sla_days: Number(tplSlaDays),
      });
      if (res.error) throw new Error(res.error);
      setShowTplModal(false);
      window.location.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create template';
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
          <p className="text-xs text-text-muted">Configure document requirements and approval routing templates.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTplModal(true)}
            className="px-3 py-1.5 rounded-lg border border-border-default bg-surface-bg text-xs font-semibold text-text-primary hover:bg-slate-50 transition-colors"
          >
            + New Routing Template
          </button>
          <button
            onClick={() => setShowReqModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover transition-colors"
          >
            + New Requirement
          </button>
        </div>
      </div>

      {/* Requirements List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {requirements.map((req) => (
          <div
            key={req.id}
            className="bg-surface-bg border border-border-default rounded-xl p-5 shadow-xs space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-sm text-text-primary">{req.name}</h3>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  Version {req.version_number}
                </span>
              </div>
              <span className="text-xs font-medium text-brand-primary bg-blue-50 px-2 py-0.5 rounded-full">
                {req.due_date_type === 'relative' ? `${req.due_date_value} days relative` : `Fixed: ${req.due_date_value}`}
              </span>
            </div>

            <p className="text-xs text-text-muted line-clamp-2">{req.description || 'No description'}</p>

            <div className="text-[11px] text-text-muted bg-surface-muted p-2.5 rounded-lg flex justify-between items-center">
              <span>Types: {req.accepted_types.map((t) => t.split('/')[1]?.toUpperCase()).join(', ')}</span>
              <span>Max: {req.max_size_mb} MB</span>
              <span>Routing: {req.routing_templates?.name || 'Default'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Requirement Modal */}
      {showReqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-surface-bg p-6 shadow-xl border border-border-default">
            <div className="flex justify-between items-center pb-3 border-b border-border-default">
              <h3 className="text-base font-bold text-text-primary">Create Requirement Definition</h3>
              <button onClick={() => setShowReqModal(false)} className="text-text-muted hover:text-text-primary font-bold">✕</button>
            </div>

            {errorMsg && (
              <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800 border border-rose-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleReqSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-text-primary mb-1">Requirement Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mid-term Evaluation Form"
                  className="w-full rounded border border-border-default p-2 text-text-primary focus:border-brand-primary outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-text-primary mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Instructions for the intern..."
                  className="w-full rounded border border-border-default p-2 text-text-primary focus:border-brand-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-primary mb-1">Due Date Rule</label>
                  <select
                    value={dueDateType}
                    onChange={(e) => setDueDateType(e.target.value as 'fixed' | 'relative')}
                    className="w-full rounded border border-border-default p-2 text-text-primary focus:border-brand-primary outline-none"
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
                    className="w-full rounded border border-border-default p-2 text-text-primary focus:border-brand-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-primary mb-1">Routing Template</label>
                  <select
                    value={routingTemplateId}
                    onChange={(e) => setRoutingTemplateId(e.target.value)}
                    className="w-full rounded border border-border-default p-2 text-text-primary focus:border-brand-primary outline-none"
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
                    className="w-full rounded border border-border-default p-2 text-text-primary focus:border-brand-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-text-primary mb-1">Accepted File Types</label>
                <div className="flex gap-4">
                  {[
                    { label: 'PDF', val: 'application/pdf' },
                    { label: 'PNG', val: 'image/png' },
                    { label: 'JPEG', val: 'image/jpeg' },
                  ].map((t) => (
                    <label key={t.val} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptedTypes.includes(t.val)}
                        onChange={() => handleTypeToggle(t.val)}
                      />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setShowReqModal(false)}
                  className="px-3 py-1.5 rounded text-text-muted hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded bg-brand-primary text-white font-semibold hover:bg-brand-primary-hover disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Requirement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Routing Template Modal */}
      {showTplModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface-bg p-6 shadow-xl border border-border-default">
            <div className="flex justify-between items-center pb-3 border-b border-border-default">
              <h3 className="text-base font-bold text-text-primary">Create Routing Template</h3>
              <button onClick={() => setShowTplModal(false)} className="text-text-muted hover:text-text-primary font-bold">✕</button>
            </div>

            <form onSubmit={handleTplSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-text-primary mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="e.g. Two-Tier Department Review"
                  className="w-full rounded border border-border-default p-2 text-text-primary focus:border-brand-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-primary mb-1">Number of Steps</label>
                  <select
                    value={tplStepCount}
                    onChange={(e) => setTplStepCount(Number(e.target.value) as 1 | 2)}
                    className="w-full rounded border border-border-default p-2 text-text-primary focus:border-brand-primary outline-none"
                  >
                    <option value={1}>1 Step (Approver)</option>
                    <option value={2}>2 Steps (Approver + Admin)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-text-primary mb-1">SLA Target (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={tplSlaDays}
                    onChange={(e) => setTplSlaDays(Number(e.target.value))}
                    className="w-full rounded border border-border-default p-2 text-text-primary focus:border-brand-primary outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setShowTplModal(false)}
                  className="px-3 py-1.5 rounded text-text-muted hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded bg-brand-primary text-white font-semibold hover:bg-brand-primary-hover disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
