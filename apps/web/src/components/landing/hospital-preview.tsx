'use client'

import {
  Activity,
  Bed,
  Building2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { cn } from '@/lib/utils'

export function HospitalPreview({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-700/60 bg-slate-900/95 text-slate-100 shadow-2xl shadow-blue-950/40 overflow-hidden font-sans',
        className,
      )}
    >
      {/* OS Window Chrome */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-2.5 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="ml-2 font-mono text-[11px] text-slate-300 flex items-center gap-1.5">
            <Building2 className="h-3 w-3 text-blue-400" />
            Grovyn Hospital OS • Enterprise Clinical Suite
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Ward Census Synced
          </span>
          <span className="text-slate-500 text-[10px] hidden sm:inline">v2.4.0-prod</span>
        </div>
      </div>

      {/* Hospital Workspace Sub-Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-900/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-semibold text-xs">
            AMH
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-white tracking-tight">
                Apex Memorial Hospital
              </h4>
              <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300">
                Main Campus
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Multi-Specialty Facility • Inpatient & Emergency Care
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-md bg-slate-800/80 px-2.5 py-1 text-slate-300 border border-slate-700/50">
            <Bed className="h-3.5 w-3.5 text-blue-400" />
            <span>142/160 Beds (88%)</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-emerald-950/40 px-2.5 py-1 text-emerald-300 border border-emerald-800/50">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            <span>OT 1-4 Active</span>
          </div>
        </div>
      </div>

      {/* Main Preview Body */}
      <div className="p-4 space-y-4 text-xs">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2.5">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Emergency Triage
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-base font-bold text-white">14 Active</span>
              <span className="text-[10px] text-amber-400">ESI Level 2: 3</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2.5">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              OPD Appointments
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-base font-bold text-white">128 Checked-In</span>
              <span className="text-[10px] text-blue-400">4 Specialities</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2.5">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              ICU & Critical Care
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-base font-bold text-white">18/20 Beds</span>
              <span className="text-[10px] text-emerald-400">90% Capacity</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2.5">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Daily Pharmacy Dispense
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-base font-bold text-white">214 Prescriptions</span>
              <span className="text-[10px] text-slate-400">98% In-Stock</span>
            </div>
          </div>
        </div>

        {/* Patient Flow & Clinical Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Active Inpatients & OPD Triage */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Users className="h-3.5 w-3.5 text-blue-400" />
                <span>Patient Flow & Department Triage</span>
              </div>
              <span className="text-[10px] text-slate-400">Updated 2m ago</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/60 p-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-blue-600/20 text-blue-300 font-semibold flex items-center justify-center text-[10px]">
                    RS
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-white">Ramesh Sharma</span>
                      <span className="font-mono text-[10px] text-slate-400">UHID-4091</span>
                      <span className="rounded bg-rose-950/60 text-rose-300 border border-rose-800/50 px-1 py-0.2 text-[9px] font-semibold">
                        ESI 2
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Cardiology • Dr. Verma • Bed C-104 (Telemetry)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 rounded bg-blue-950/40 text-blue-300 px-1.5 py-0.5 text-[10px] border border-blue-800/40">
                    <Clock className="h-2.5 w-2.5" /> ECG Done
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/60 p-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-teal-600/20 text-teal-300 font-semibold flex items-center justify-center text-[10px]">
                    AP
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-white">Anita Patel</span>
                      <span className="font-mono text-[10px] text-slate-400">UHID-4088</span>
                      <span className="rounded bg-amber-950/60 text-amber-300 border border-amber-800/50 px-1 py-0.2 text-[9px] font-semibold">
                        ESI 3
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Orthopedics • Dr. Sundaram • Post-Op Ward A-12
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-950/40 text-emerald-300 px-1.5 py-0.5 text-[10px] border border-emerald-800/40">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Stable
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/60 p-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-purple-600/20 text-purple-300 font-semibold flex items-center justify-center text-[10px]">
                    MK
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-white">Mukesh Khanna</span>
                      <span className="font-mono text-[10px] text-slate-400">UHID-4102</span>
                      <span className="rounded bg-blue-950/60 text-blue-300 border border-blue-800/50 px-1 py-0.2 text-[9px] font-semibold">
                        OPD
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      General Medicine • Scheduled 14:15 • Token #28
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400">Room 102</span>
                </div>
              </div>
            </div>
          </div>

          {/* Department Utilization Rail */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-200">Department Status</span>
                <span className="text-[10px] text-slate-400">Live Telemetry</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-300 mb-0.5">
                    <span>Emergency Care</span>
                    <span className="font-medium text-amber-400">85% load</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '85%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-300 mb-0.5">
                    <span>General Wards</span>
                    <span className="font-medium text-blue-400">91% occupied</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '91%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-300 mb-0.5">
                    <span>Laboratory Orders</span>
                    <span className="font-medium text-emerald-400">42 in progress</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '68%' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-blue-950/30 border border-blue-900/40 p-2 text-[10px] text-blue-300 flex items-start gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
              <span>NABH & HIPAA compliant audit logging enabled across all clinical encounters.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
