'use client'

import {
  ArrowRight,
  Bed,
  Building2,
  Clock,
  Coins,
  FileText,
  FlaskConical,
  Package,
  Pill,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

import { DentalPreview } from './dental-preview'
import { HospitalPreview } from './hospital-preview'

export function PlatformsSection() {
  return (
    <section id="platforms" className="py-24 bg-[#090E1A] text-slate-100 border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-28">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold uppercase tracking-wider">
            <span>Specialized Operating Systems</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Engineered for distinct clinical environments.
          </h2>
          <p className="text-base text-slate-400">
            A hospital requires multi-department coordination, bed censuses, and centralized pharmacy
            dispensing. A dental practice requires tooth-specific charting, chair turnover tracking,
            and prosthetics lab coordination. Grovyn provides dedicated operating systems for each.
          </p>
        </div>

        {/* Product A: Grovyn Hospital OS */}
        <div id="hospital-os" className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Copy & Capabilities */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold">
                <Building2 className="h-3.5 w-3.5" />
                <span>Enterprise Hospital Management</span>
              </div>
              <h3 className="text-3xl font-bold text-white tracking-tight">
                Grovyn Hospital OS
              </h3>
              <p className="text-lg text-blue-200/90 font-medium">
                One operational workspace for the hospital.
              </p>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed">
              Designed for multi-specialty hospitals, healthcare centers, and multi-ward facilities.
              Hospital OS connects registration desks, triage nurses, attending consultants,
              pharmacy counters, diagnostic laboratories, and billing departments into one audited,
              synchronized workflow.
            </p>

            {/* Feature Categories */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-0.5">
                  <Bed className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Inpatient & Emergency Care</h4>
                  <p className="text-xs text-slate-400">
                    Real-time bed management, ward census, ESI emergency triage, and MAR clinical notes.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-0.5">
                  <Pill className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Pharmacy & Inventory Control</h4>
                  <p className="text-xs text-slate-400">
                    Batch-level tracking, expiry warnings, automated e-prescriptions, and dispensing logs.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-0.5">
                  <FlaskConical className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Diagnostics, Lab & Radiology</h4>
                  <p className="text-xs text-slate-400">
                    Integrated sample collection, barcode tracking, reference range validation, and DICOM imaging.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-0.5">
                  <Coins className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Multi-Department Billing & GST</h4>
                  <p className="text-xs text-slate-400">
                    Automated charge capture from consultations, medicines, labs, and surgical procedures.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <Button asChild className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                <Link href="/register?type=HOSPITAL" className="flex items-center gap-2">
                  <span>Get Started with Hospital OS</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800">
                <a href="#experience">Inspect Hospital Workflows</a>
              </Button>
            </div>
          </div>

          {/* Right: Hospital Product Preview */}
          <div className="lg:col-span-7">
            <div className="relative rounded-2xl p-1 bg-gradient-to-br from-blue-500/20 via-slate-800/40 to-slate-900 border border-blue-500/20 shadow-xl">
              <HospitalPreview />
            </div>
          </div>
        </div>

        {/* Product B: Grovyn Dental OS */}
        <div id="dental-os" className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Dental Product Preview (Reversed Editorial Layout) */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div className="relative rounded-2xl p-1 bg-gradient-to-br from-teal-500/20 via-slate-800/40 to-slate-900 border border-teal-500/30 shadow-xl">
              <DentalPreview />
            </div>
          </div>

          {/* Right: Copy & Capabilities */}
          <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Dental Practice Specialization</span>
              </div>
              <h3 className="text-3xl font-bold text-white tracking-tight">
                Grovyn Dental OS
              </h3>
              <p className="text-lg text-teal-200/90 font-medium">
                Purpose-built for the modern dental clinic.
              </p>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed">
              Standard hospital software is unsuited for dental clinics. Grovyn Dental OS delivers
              interactive tooth-level charting, chair operatory queue optimization, external laboratory
              prosthetic tracking, and treatment acceptance workflows tailored for dental surgeons.
            </p>

            {/* Feature Categories */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 mt-0.5">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Interactive Odontogram Charting</h4>
                  <p className="text-xs text-slate-400">
                    Adult and pediatric tooth charts with surface-level restoration, endodontic, and crown mapping.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 mt-0.5">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Chair Queue & Operatory Encounters</h4>
                  <p className="text-xs text-slate-400">
                    Live operatory chair status, turnover time tracking, walk-in tokens, and chairside clinical notes.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 mt-0.5">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Dental Lab & Prosthetics Tracking</h4>
                  <p className="text-xs text-slate-400">
                    Manage external dental labs, shade matching (VITA/3D), try-in dates, and crown delivery status.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 mt-0.5">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Treatment Plans & Patient Ledger</h4>
                  <p className="text-xs text-slate-400">
                    Multi-phase treatment estimates, patient acceptance signoffs, procedure packaging, and recall schedules.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <Button asChild className="bg-teal-600 hover:bg-teal-500 text-white font-semibold">
                <Link href="/register?type=DENTAL" className="flex items-center gap-2">
                  <span>Get Started with Dental OS</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800">
                <a href="#experience">Inspect Dental Workflows</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
