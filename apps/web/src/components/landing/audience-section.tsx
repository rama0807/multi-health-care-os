'use client'

import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export function AudienceSection() {
  return (
    <section className="py-20 bg-[#070B14] text-slate-100 border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold uppercase tracking-wider">
            <span>Organizational Fit</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Who is each system built for?
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            Select the platform engineered for your facility&apos;s exact clinical architecture and staff roles.
          </p>
        </div>

        {/* Two Audience Guidance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Card 1: Hospital OS */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 space-y-6 flex flex-col justify-between hover:border-blue-500/40 transition-colors">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold">
                <Building2 className="h-4 w-4" />
                <span>Grovyn Hospital OS</span>
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">
                For Hospitals & Multi-Specialty Facilities
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Built specifically for hospital administrators, medical superintendents, nursing
                directors, and clinic managers who oversee multi-department healthcare institutions.
              </p>

              <div className="space-y-2.5 pt-2 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>General hospitals, surgical centers, and diagnostic institutes</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>Facilities operating Inpatient beds, ICUs, or Emergency departments</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>Organizations requiring integrated central pharmacy & lab tracking</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>Multi-department insurance billing, corporate empanelment, and GST</span>
                </div>
              </div>
            </div>

            <Button asChild className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold">
              <Link href="/register?type=HOSPITAL" className="flex items-center justify-center gap-2">
                <span>Configure Hospital OS</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Card 2: Dental OS */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 space-y-6 flex flex-col justify-between hover:border-teal-500/40 transition-colors">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-semibold">
                <Sparkles className="h-4 w-4" />
                <span>Grovyn Dental OS</span>
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">
                For Dental Clinics & Practice Owners
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Built specifically for dental clinic owners, orthodontists, oral surgeons, and dental
                support teams who manage chairside clinical treatments and external lab prosthetics.
              </p>

              <div className="space-y-2.5 pt-2 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>Single-chair and multi-operatory dental practices</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>Clinics requiring tooth-level FDI / Universal odontogram charting</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>Practices coordinating custom crowns, bridges, and clear aligners with labs</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>Phased treatment plan acceptance, chair turnover tracking, and recalls</span>
                </div>
              </div>
            </div>

            <Button asChild className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold">
              <Link href="/register?type=DENTAL" className="flex items-center justify-center gap-2">
                <span>Configure Dental OS</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
