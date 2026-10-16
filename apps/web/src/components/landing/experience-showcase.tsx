'use client'

import {
  Bed,
  Package,
  Pill,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

import { DentalPreview } from './dental-preview'
import { HospitalPreview } from './hospital-preview'

type WorkflowTab = 'hospital-census' | 'dental-odontogram' | 'hospital-pharmacy' | 'dental-lab'

export function ExperienceShowcase() {
  const [activeTab, setActiveTab] = useState<WorkflowTab>('hospital-census')

  return (
    <section id="experience" className="py-24 bg-[#090E1A] text-slate-100 border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold uppercase tracking-wider">
            <span>Product Experience Showcase</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            See the work behind the workflows.
          </h2>
          <p className="text-base text-slate-400">
            Inspect the actual operational screens used by physicians, surgeons, nurses, and practice
            administrators every day.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-xl bg-slate-900/90 border border-slate-800 max-w-3xl mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('hospital-census')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'hospital-census'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
            )}
          >
            <Bed className="h-3.5 w-3.5 text-blue-300" />
            <span>Hospital Census & Triage</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dental-odontogram')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'dental-odontogram'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-teal-300" />
            <span>Dental Odontogram & Chair</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hospital-pharmacy')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'hospital-pharmacy'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
            )}
          >
            <Pill className="h-3.5 w-3.5 text-blue-300" />
            <span>Hospital Pharmacy & Labs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dental-lab')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'dental-lab'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
            )}
          >
            <Package className="h-3.5 w-3.5 text-teal-300" />
            <span>Dental Lab & Prosthetics</span>
          </button>
        </div>

        {/* Tab Content Display */}
        <div className="max-w-5xl mx-auto">
          {activeTab === 'hospital-census' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/40 p-4 rounded-xl border border-slate-800 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  <span className="font-semibold text-white">Hospital OS Inpatient & Triage Command</span>
                </div>
                <span>Orchestrates admission requests, bed turnover, and nurse duty stations in real time.</span>
              </div>
              <HospitalPreview />
            </div>
          )}

          {activeTab === 'dental-odontogram' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/40 p-4 rounded-xl border border-slate-800 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-teal-400" />
                  <span className="font-semibold text-white">Dental OS Tooth Charting & Chair Operations</span>
                </div>
                <span>Enables tooth-by-tooth diagnosis, restoration tracking, and chairside encounter notes.</span>
              </div>
              <DentalPreview />
            </div>
          )}

          {activeTab === 'hospital-pharmacy' && (
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/95 p-6 space-y-6 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Pill className="h-4 w-4 text-blue-400" />
                    Central Pharmacy Dispense & Batch Inventory
                  </h3>
                  <p className="text-xs text-slate-400">
                    Real-time stock deduction on prescription sign-off with FEFO expiry enforcement.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-blue-950/60 text-blue-300 border border-blue-800/40">
                    28 Orders Pending
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                    Auto-Deduction Active
                  </span>
                </div>
              </div>

              {/* Sample Batch Ledger Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="pb-3 font-semibold">Medicine / Formulation</th>
                      <th className="pb-3 font-semibold">Batch No.</th>
                      <th className="pb-3 font-semibold">Expiry Date</th>
                      <th className="pb-3 font-semibold">Available Units</th>
                      <th className="pb-3 font-semibold">Department Allocation</th>
                      <th className="pb-3 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr>
                      <td className="py-3 font-medium text-white">Amoxicillin 500mg (Cap)</td>
                      <td className="py-3 font-mono text-slate-400">AMX-2026-08</td>
                      <td className="py-3">12/2027</td>
                      <td className="py-3 font-semibold text-emerald-400">1,420 units</td>
                      <td className="py-3">OPD & IPD Ward A</td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                          Sufficient Stock
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 font-medium text-white">Ceftriaxone 1g (Vial)</td>
                      <td className="py-3 font-mono text-slate-400">CFT-2025-11</td>
                      <td className="py-3">08/2026</td>
                      <td className="py-3 font-semibold text-amber-400">45 units</td>
                      <td className="py-3">Emergency & ICU</td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950/60 text-amber-300 border border-amber-800/50">
                          Reorder Threshold
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 font-medium text-white">Paracetamol IV 100ml</td>
                      <td className="py-3 font-mono text-slate-400">PCM-2026-02</td>
                      <td className="py-3">04/2028</td>
                      <td className="py-3 font-semibold text-emerald-400">620 units</td>
                      <td className="py-3">Post-Op & General Wards</td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                          Sufficient Stock
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'dental-lab' && (
            <div className="rounded-2xl border border-teal-500/40 bg-slate-900/95 p-6 space-y-6 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Package className="h-4 w-4 text-teal-400" />
                    Dental Laboratory & Prosthetics Tracking
                  </h3>
                  <p className="text-xs text-slate-400">
                    Track custom crowns, bridges, dentures, and clear aligners from impression to seating.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-teal-950/60 text-teal-300 border border-teal-800/40">
                    4 Active Vendors
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300">
                    Digital STL Attached
                  </span>
                </div>
              </div>

              {/* Lab Order Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-teal-900/50 bg-slate-950/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Case #LAB-289 • Upper Left Molar</span>
                    <span className="rounded bg-teal-900/50 text-teal-300 text-[10px] font-semibold px-2 py-0.5 border border-teal-700/50">
                      Quality Passed
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Restoration:</span>
                      <span className="font-medium text-white">Multi-Layered Zirconia Crown</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tooth Number:</span>
                      <span className="font-mono text-teal-300 font-semibold">#26 (FDI)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Shade / Translucency:</span>
                      <span className="font-medium text-white">VITA Classical A2 (High Translucent)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">External Lab Partner:</span>
                      <span className="font-medium text-slate-200">Apex Precision Dental Lab</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Patient Seating:</span>
                    <span className="text-emerald-400 font-semibold">Tomorrow at 11:30 AM (Chair 2)</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Case #LAB-294 • Anterior Aesthetic</span>
                    <span className="rounded bg-amber-950/60 text-amber-300 text-[10px] font-semibold px-2 py-0.5 border border-amber-800/50">
                      Ceramic Firing
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Restoration:</span>
                      <span className="font-medium text-white">E-Max Porcelain Veneers (x4)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tooth Numbers:</span>
                      <span className="font-mono text-teal-300 font-semibold">#11, #12, #21, #22</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Shade / Character:</span>
                      <span className="font-medium text-white">BL3 Bleach Shade + Mamelon Staining</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">External Lab Partner:</span>
                      <span className="font-medium text-slate-200">CeramArt Dental Specialists</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Expected Delivery:</span>
                    <span className="text-amber-400 font-semibold">Friday, Oct 17</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
