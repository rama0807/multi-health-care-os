'use client'

import {
  ArrowRight,
  Building2,
  FileCheck2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { DentalPreview } from './dental-preview'
import { HospitalPreview } from './hospital-preview'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'


export function HeroSection() {
  const [activeLayer, setActiveLayer] = useState<'both' | 'hospital' | 'dental'>('both')

  return (
    <section className="relative pt-32 pb-20 lg:pt-36 lg:pb-32 overflow-hidden bg-[#070B14]">
      {/* Background architectural grid & subtle glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[450px] h-[450px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Positioning & Copy */}
          <div className="lg:col-span-5 space-y-6 text-center lg:text-left">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs font-semibold uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Healthcare Operations, Connected
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
              Two specialized systems.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-teal-300">
                One connected healthcare platform.
              </span>
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Run hospital operations or manage a modern dental practice with software built
              around the workflows, teams, and decisions that matter to your organization.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 shadow-lg shadow-blue-600/25 border border-blue-400/30"
              >
                <a href="#platforms" className="flex items-center justify-center gap-2">
                  <span>Explore Our Platforms</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white font-medium px-6"
              >
                <Link href="/register">Get Started</Link>
              </Button>

              <Button
                asChild
                variant="ghost"
                size="lg"
                className="w-full sm:w-auto text-slate-400 hover:text-white hover:bg-slate-800/50 text-sm font-medium"
              >
                <Link href="/login">Sign In</Link>
              </Button>
            </div>

            {/* Operating System Pill Badges */}
            <div className="pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-0.5">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Grovyn Hospital OS</h4>
                  <p className="text-[11px] text-slate-400">Multi-department clinical, ward census, & OPD/IPD</p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 mt-0.5">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Grovyn Dental OS</h4>
                  <p className="text-[11px] text-slate-400">Odontogram, operatory chair queue, & dental lab cases</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Mediox-Inspired Layered Product Presentation */}
          <div className="lg:col-span-7 relative">
            {/* Layer Control Pills */}
            <div className="flex items-center justify-center lg:justify-end gap-2 mb-3">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mr-1 hidden sm:inline">
                Interactive Showcase:
              </span>
              <button
                type="button"
                onClick={() => setActiveLayer('both')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                  activeLayer === 'both'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white',
                )}
              >
                Layered View
              </button>
              <button
                type="button"
                onClick={() => setActiveLayer('hospital')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5',
                  activeLayer === 'hospital'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white',
                )}
              >
                <Building2 className="h-3 w-3" />
                Hospital OS
              </button>
              <button
                type="button"
                onClick={() => setActiveLayer('dental')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5',
                  activeLayer === 'dental'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white',
                )}
              >
                <Sparkles className="h-3 w-3" />
                Dental OS
              </button>
            </div>

            {/* The Layered Container */}
            <div className="relative min-h-[460px] sm:min-h-[580px] w-full">
              {/* Rear Layer: Hospital OS Preview */}
              <div
                className={cn(
                  'transition-all duration-300 transform',
                  activeLayer === 'both' &&
                  'relative sm:absolute sm:top-0 sm:right-0 sm:w-[92%] sm:scale-[0.96] opacity-90 sm:hover:opacity-100 z-10',
                  activeLayer === 'hospital' && 'relative w-full z-30 scale-100 opacity-100',
                  activeLayer === 'dental' && 'hidden sm:block sm:absolute sm:top-0 sm:right-0 sm:w-[90%] sm:scale-[0.92] opacity-40 z-0 pointer-events-none',
                )}
              >
                <div className="relative group">
                  <HospitalPreview className="transition-all duration-200 hover:border-blue-500/50" />
                  {activeLayer === 'both' && (
                    <div className="hidden sm:block absolute -top-3 -left-3 bg-blue-600 text-white font-semibold text-[10px] px-2.5 py-1 rounded-full shadow-md border border-blue-400/40 z-20">
                      Grovyn Hospital OS (Enterprise Multi-Dept)
                    </div>
                  )}
                </div>
              </div>

              {/* Front Layer: Dental OS Preview */}
              <div
                className={cn(
                  'transition-all duration-300 transform mt-4 sm:mt-0',
                  activeLayer === 'both' &&
                  'relative sm:absolute sm:top-28 sm:left-0 sm:w-[94%] z-20 shadow-2xl sm:hover:scale-[1.01]',
                  activeLayer === 'dental' && 'relative w-full z-30 scale-100 opacity-100',
                  activeLayer === 'hospital' && 'hidden sm:block sm:absolute sm:bottom-0 sm:left-0 sm:w-[90%] sm:scale-[0.92] opacity-40 z-0 pointer-events-none',
                )}
              >
                <div className="relative group">
                  <DentalPreview className="transition-all duration-200 hover:border-teal-400" />
                  {activeLayer === 'both' && (
                    <div className="hidden sm:block absolute -top-3 -left-3 bg-teal-600 text-white font-semibold text-[10px] px-2.5 py-1 rounded-full shadow-md border border-teal-300/40 z-30">
                      Grovyn Dental OS (Precision Practice Suite)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Enterprise Multi-Tenant Guarantee Footnote */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-2 text-slate-400 text-xs">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Isolated multi-tenant PostgreSQL schema isolation
              </span>
              <span className="text-slate-500 hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5">
                <FileCheck2 className="h-4 w-4 text-blue-400" />
                Role-based access control (RBAC) audited end-to-end
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
