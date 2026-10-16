'use client'

import { Building2, Sparkles } from 'lucide-react'
import Link from 'next/link'

import { GrovynLogo } from './landing-nav'

export function LandingFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-[#050810] text-slate-400 text-xs border-t border-slate-800/80 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand info */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <GrovynLogo className="h-7 w-7" />
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white tracking-tight">Grovyn</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Healthcare OS
                </span>
              </div>
            </Link>
            <p className="text-slate-400 max-w-sm leading-relaxed text-xs">
              One connected technology platform with two specialized operating systems:
              Grovyn Hospital OS for hospital facilities and Grovyn Dental OS for modern dental practices.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
              <span>Multi-Tenant Architecture • Role-Governed Clinical RBAC</span>
            </div>
          </div>

          {/* Platform Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Operating Systems
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="#hospital-os"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Building2 className="h-3.5 w-3.5 text-blue-400" />
                  <span>Grovyn Hospital OS</span>
                </a>
              </li>
              <li>
                <a
                  href="#dental-os"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                  <span>Grovyn Dental OS</span>
                </a>
              </li>
              <li>
                <a href="#workflows" className="hover:text-white transition-colors">
                  Clinical Workflows
                </a>
              </li>
              <li>
                <a href="#experience" className="hover:text-white transition-colors">
                  Product Experience
                </a>
              </li>
            </ul>
          </div>

          {/* Access & Account Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Organization Access
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Sign In to Workspace
                </Link>
              </li>
              <li>
                <Link
                  href="/register?type=HOSPITAL"
                  className="hover:text-white transition-colors"
                >
                  Register Hospital Account
                </Link>
              </li>
              <li>
                <Link
                  href="/register?type=DENTAL"
                  className="hover:text-white transition-colors"
                >
                  Register Dental Clinic
                </Link>
              </li>
              <li>
                <Link href="/forgot-password" className="hover:text-white transition-colors">
                  Password Assistance
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            &copy; {currentYear} Grovyn Healthcare Systems. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-slate-400 transition-colors">
              Privacy Notice
            </a>
            <a href="#terms" className="hover:text-slate-400 transition-colors">
              Terms of Service
            </a>
            <a href="#security" className="hover:text-slate-400 transition-colors">
              Platform Security
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
