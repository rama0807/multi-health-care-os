'use client'

import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export function CtaSection() {
  return (
    <section className="py-24 bg-[#090E1A] text-slate-100 border-t border-slate-800/80 relative overflow-hidden">
      {/* Subtle depth lighting */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-12">
        <div className="space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold uppercase tracking-wider">
            <span>Direct Organization Onboarding</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Choose the system built for your organization.
          </h2>
          <p className="text-base sm:text-lg text-slate-300">
            Start with the workflows your team needs and build from there. Immediate access upon registration.
          </p>
        </div>

        {/* Dual Conversion Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto text-left">
          {/* Option 1: Hospital OS */}
          <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-b from-blue-950/20 to-slate-900/90 p-8 space-y-6 shadow-xl relative group hover:border-blue-500/60 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Building2 className="h-6 w-6" />
                </div>
                <span className="text-xs font-mono text-blue-400 font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                  Enterprise Suite
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">Grovyn Hospital OS</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Complete operational operating system for inpatient, outpatient, emergency triage,
                pharmacy inventory, and diagnostic laboratories.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                <span>Multi-specialty patient records & ESI triage</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                <span>Centralized bed management & ward census</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                <span>Pharmacy batch tracking & department billing</span>
              </div>
            </div>

            <Button asChild size="lg" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/20">
              <Link href="/register?type=HOSPITAL" className="flex items-center justify-center gap-2">
                <span>Get Started with Hospital OS</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Option 2: Dental OS */}
          <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-b from-teal-950/20 to-slate-900/90 p-8 space-y-6 shadow-xl relative group hover:border-teal-500/60 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  <Sparkles className="h-6 w-6" />
                </div>
                <span className="text-xs font-mono text-teal-400 font-semibold px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20">
                  Precision Suite
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">Grovyn Dental OS</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Dedicated management operating system for dental practices featuring interactive
                odontogram charting, operatory chair queues, and prosthetics lab tracking.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
                <span>Interactive 32-tooth odontogram charting</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
                <span>Operatory chair turnover & waiting times</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
                <span>Dental lab order tracking & shade matching</span>
              </div>
            </div>

            <Button asChild size="lg" className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-lg shadow-teal-600/20">
              <Link href="/register?type=DENTAL" className="flex items-center justify-center gap-2">
                <span>Get Started with Dental OS</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Security / Self-Service Note */}
        <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5 pt-4">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Self-service organization setup. No fake trials, instant tenant database provisioning.</span>
        </p>
      </div>
    </section>
  )
}
