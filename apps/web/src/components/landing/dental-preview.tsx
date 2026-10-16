'use client'

import {
  Clock,
  Package,
  Sparkles,
  Users,
} from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

export function DentalPreview({ className = '' }: { className?: string }) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(36)

  // Real dental teeth representation (Universal / FDI mix common in modern dental apps)
  const upperTeeth = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
  const lowerTeeth = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

  const getToothStatus = (tooth: number) => {
    if (tooth === 16) return { color: 'bg-blue-500/20 text-blue-300 border-blue-500/40', label: 'Composite' }
    if (tooth === 24) return { color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', label: 'RCT' }
    if (tooth === 36) return { color: 'bg-teal-500/30 text-teal-200 border-teal-400 font-bold ring-1 ring-teal-400', label: 'Crown Due' }
    if (tooth === 46) return { color: 'bg-purple-500/20 text-purple-300 border-purple-500/40', label: 'Bridge' }
    return { color: 'bg-slate-800/60 text-slate-400 border-slate-700/60', label: 'Sound' }
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-teal-500/40 bg-slate-900/98 text-slate-100 shadow-2xl shadow-teal-950/40 overflow-hidden font-sans',
        className,
      )}
    >
      {/* OS Window Chrome */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 py-2.5 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-teal-400/80" />
          </div>
          <span className="ml-2 font-mono text-[11px] text-teal-300 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-teal-400" />
            Grovyn Dental OS • Tooth Charting & Practice Suite
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[11px] text-teal-300 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
            4 Operatory Chairs Online
          </span>
        </div>
      </div>

      {/* Dental Clinic Context Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-900/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 font-bold text-xs">
            GDS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-white tracking-tight">
                Grovyn Dental Studio
              </h4>
              <span className="rounded bg-teal-950/60 border border-teal-800/50 px-1.5 py-0.2 text-[10px] text-teal-300 font-medium">
                Clinic Mode
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Dr. Ananya Sen, BDS, MDS • Operatory Operative View
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-md bg-slate-800/90 px-2.5 py-1 text-slate-200 border border-slate-700/60">
            <Users className="h-3.5 w-3.5 text-teal-400" />
            <span>18 Appointments Today</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-teal-950/60 px-2.5 py-1 text-teal-200 border border-teal-700/60">
            <Package className="h-3.5 w-3.5 text-teal-400" />
            <span>3 Lab Cases In Transit</span>
          </div>
        </div>
      </div>

      {/* Main Dental UI Preview */}
      <div className="p-4 space-y-4 text-xs">
        {/* Odontogram Visualizer Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <span className="h-2 w-2 rounded-full bg-teal-400" />
              <span>Interactive Odontogram (Adult 32-Tooth FDI Chart)</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500/60 inline-block" /> Restored</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500/60 inline-block" /> RCT</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-teal-400 inline-block" /> Crown</span>
            </div>
          </div>

          {/* Tooth Arch Grid */}
          <div className="space-y-1.5 py-1">
            <div className="flex justify-between items-center gap-1 overflow-x-auto pb-1">
              <span className="text-[9px] font-mono text-slate-500 uppercase mr-1">Maxilla</span>
              {upperTeeth.map((tooth) => {
                const status = getToothStatus(tooth)
                const isSelected = selectedTooth === tooth
                return (
                  <button
                    key={tooth}
                    type="button"
                    onClick={() => setSelectedTooth(tooth)}
                    className={cn(
                      'flex flex-col items-center justify-center h-8 w-6 sm:w-7 rounded border text-[10px] font-mono transition-all',
                      status.color,
                      isSelected && 'scale-110 ring-2 ring-teal-400 z-10',
                    )}
                    title={`Tooth ${tooth} - ${status.label}`}
                  >
                    <span>{tooth}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex justify-between items-center gap-1 overflow-x-auto pt-1 border-t border-slate-800/60">
              <span className="text-[9px] font-mono text-slate-500 uppercase mr-1">Mandible</span>
              {lowerTeeth.map((tooth) => {
                const status = getToothStatus(tooth)
                const isSelected = selectedTooth === tooth
                return (
                  <button
                    key={tooth}
                    type="button"
                    onClick={() => setSelectedTooth(tooth)}
                    className={cn(
                      'flex flex-col items-center justify-center h-8 w-6 sm:w-7 rounded border text-[10px] font-mono transition-all',
                      status.color,
                      isSelected && 'scale-110 ring-2 ring-teal-400 z-10',
                    )}
                    title={`Tooth ${tooth} - ${status.label}`}
                  >
                    <span>{tooth}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Tooth Quick Inspector */}
          {selectedTooth && (
            <div className="rounded-lg bg-teal-950/40 border border-teal-800/40 p-2 text-[11px] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-teal-500/20 text-teal-300 font-mono px-1.5 py-0.5 text-xs font-semibold">
                  Tooth #{selectedTooth}
                </span>
                <span className="text-slate-300">
                  {selectedTooth === 36
                    ? 'Lower Left First Molar • Full Ceramic Zirconia Crown planned'
                    : selectedTooth === 16
                      ? 'Upper Right First Molar • Class II MO Composite Restoration completed'
                      : selectedTooth === 24
                        ? 'Upper Left First Premolar • Root Canal Therapy (Obturation scheduled)'
                        : 'Permanent Dentition • Healthy gingival margin'}
                </span>
              </div>
              <span className="text-[10px] text-teal-400 font-medium">Active Treatment</span>
            </div>
          )}
        </div>

        {/* Chair Queue & Lab Tracking */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Active Chair Queue */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Clock className="h-3.5 w-3.5 text-teal-400" />
                <span>Operatory Chairs Queue</span>
              </div>
              <span className="text-[10px] text-slate-400">Live</span>
            </div>

            <div className="space-y-1.5">
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Chair 1</span>
                    <span className="text-slate-300 text-[11px]">Pooja Roy</span>
                    <span className="rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 px-1 text-[9px]">
                      In Chair
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Scaling & Ultrasonic Polishing • Dr. Sen</p>
                </div>
                <span className="text-[10px] font-mono text-teal-300">24m elapsed</span>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Chair 2</span>
                    <span className="text-slate-300 text-[11px]">Vikram Mehta</span>
                    <span className="rounded bg-blue-950/60 text-blue-300 border border-blue-800/50 px-1 text-[9px]">
                      Seated
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Crown Trial (#36) • Dr. Nair</p>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Ready</span>
              </div>
            </div>
          </div>

          {/* Dental Lab & Prosthetics Tracking */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Package className="h-3.5 w-3.5 text-teal-400" />
                <span>Dental Lab Prosthetics</span>
              </div>
              <span className="text-[10px] text-teal-400 font-medium">3 Cases</span>
            </div>

            <div className="space-y-1.5">
              <div className="rounded-lg border border-teal-900/50 bg-teal-950/20 p-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium text-white text-[11px]">Case #LAB-289 — Zirconia Crown</span>
                    <p className="text-[10px] text-slate-300">Tooth 36 • Shade A2 VITA • Apex Dental Lab</p>
                  </div>
                  <span className="rounded bg-teal-900/50 text-teal-300 px-1.5 py-0.5 text-[9px] border border-teal-700/50 font-semibold">
                    Received
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Fitting: Tomorrow 11:30 AM</span>
                  <span className="text-emerald-400">Ready for Patient</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium text-white text-[11px]">Case #LAB-291 — Aligners Upper/Lower</span>
                    <p className="text-[10px] text-slate-300">Tray 1-6 • ClearSmile Labs</p>
                  </div>
                  <span className="rounded bg-amber-950/60 text-amber-300 px-1.5 py-0.5 text-[9px] border border-amber-800/50 font-semibold">
                    In Fabric
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Due: Oct 18</span>
                  <span>Scanning complete</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
