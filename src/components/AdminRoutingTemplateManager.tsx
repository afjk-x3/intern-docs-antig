'use client';

import React, { useState } from 'react';
import type { CreateRoutingTemplateInput } from './AdminRequirementManager';

interface RoutingTemplate {
  id: string;
  name: string;
  steps: Array<{ step: number; role?: string; user_id?: string; name: string }>;
  sla_days?: number | null;
  created_at: string;
}

interface AdminRoutingTemplateManagerProps {
  routingTemplates: RoutingTemplate[];
  onCreateTemplate: (data: CreateRoutingTemplateInput) => Promise<{ success?: boolean; error?: string }>;
}

export function AdminRoutingTemplateManager({
  routingTemplates,
  onCreateTemplate,
}: AdminRoutingTemplateManagerProps) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [slaDays, setSlaDays] = useState(2);
  const [stepCount, setStepCount] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const steps: Array<{ step: number; role: 'approver' | 'admin'; name: string }> = [
        { step: 1, role: 'approver', name: 'Supervisor Review' },
      ];
      if (stepCount === 2) {
        steps.push({ step: 2, role: 'admin', name: 'Admin Final Sign-Off' });
      }

      const res = await onCreateTemplate({
        name,
        steps,
        sla_days: Number(slaDays),
      });

      if (res.error) throw new Error(res.error);
      setShowModal(false);
      setName('');
      setSlaDays(2);
      setStepCount(1);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Configured Routing Templates</h2>
          <p className="text-xs text-text-muted">
            Define sequential 1-step or 2-step approval chains and SLA turnaround targets.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3.5 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover transition-colors shadow-xs"
        >
          + New Routing Template
        </button>
      </div>

      {/* Grid of Routing Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {routingTemplates.map((tpl) => (
          <div
            key={tpl.id}
            className="bg-surface-bg border border-border-default rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-sm text-text-primary">{tpl.name}</h3>
                <span className="text-[11px] font-semibold text-brand-primary bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                  {tpl.sla_days ? `SLA: ${tpl.sla_days}d` : 'No SLA'}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1">
                {(tpl.steps || []).length} Sequential {(tpl.steps || []).length === 1 ? 'Step' : 'Steps'}
              </p>
            </div>

            {/* Step visualization */}
            <div className="space-y-2 border-t border-border-default pt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Approval Chain
              </span>
              <div className="space-y-1.5">
                {(tpl.steps || []).map((s, idx) => (
                  <div
                    key={s.step || idx}
                    className="flex items-center justify-between bg-surface-muted p-2 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center justify-center">
                        {s.step || idx + 1}
                      </span>
                      <span className="font-semibold text-text-primary text-xs">{s.name || `Step ${idx + 1}`}</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">
                      {s.role || 'approver'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {routingTemplates.length === 0 && (
          <div className="col-span-full p-8 text-center bg-surface-bg border border-border-default rounded-2xl text-xs text-text-muted">
            No custom routing templates configured yet. Click "+ New Routing Template" above to create one.
          </div>
        )}
      </div>

      {/* Create Template Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface-bg p-6 shadow-xl border border-border-default space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-border-default">
              <h3 className="text-base font-bold text-text-primary">Create Routing Template</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-text-muted hover:text-text-primary font-bold p-1"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-text-primary mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 2-Step Executive Approval"
                  className="w-full rounded-xl border border-border-default p-2.5 text-text-primary focus:border-brand-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-text-primary mb-1">Approval Steps</label>
                  <select
                    value={stepCount}
                    onChange={(e) => setStepCount(Number(e.target.value) as 1 | 2)}
                    className="w-full rounded-xl border border-border-default p-2.5 text-text-primary focus:border-brand-primary outline-none"
                  >
                    <option value={1}>1 Step (Supervisor)</option>
                    <option value={2}>2 Steps (Supervisor → Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-text-primary mb-1">SLA Target (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    required
                    value={slaDays}
                    onChange={(e) => setSlaDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-default p-2.5 text-text-primary focus:border-brand-primary outline-none"
                  />
                </div>
              </div>

              {/* Steps Preview */}
              <div className="bg-surface-muted p-3.5 rounded-xl border border-border-default space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Workflow Preview</span>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Step 1: Supervisor Review</span>
                    <span className="text-[10px] font-mono text-slate-500">role: approver</span>
                  </div>
                  {stepCount === 2 && (
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Step 2: Admin Final Sign-Off</span>
                      <span className="text-[10px] font-mono text-slate-500">role: admin</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover disabled:opacity-50"
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
