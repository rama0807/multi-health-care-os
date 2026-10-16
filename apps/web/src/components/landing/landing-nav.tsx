'use client'

import { ArrowRight, Building2, Menu, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils'

export function GrovynLogo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <div className={cn('relative flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-teal-500 p-1.5 shadow-sm shadow-blue-500/20 text-white', className)}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-full w-full"
      >
        <path d="M12 2v20M2 12h20" opacity="0.35" strokeDasharray="2 2" />
        <rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor" fillOpacity="0.2" />
        <rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor" fillOpacity="0.85" />
        <circle cx="16.5" cy="7.5" r="3.5" fill="currentColor" fillOpacity="0.9" />
        <path d="M7.5 13v7M4 16.5h7" stroke="currentColor" strokeWidth="2.5" />
      </svg>
    </div>
  )
}

export function LandingNav() {
  const { isAuthenticated, user, isLoading } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const workspaceHref = String(user?.organizationType) === 'DENTAL' ? '/dental' : '/dashboard'

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-200',
        scrolled
          ? 'bg-[#090E1A]/90 backdrop-blur-md border-b border-slate-800/80 shadow-md shadow-black/20 py-3.5'
          : 'bg-transparent py-5',
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg">
            <GrovynLogo className="h-8 w-8 transition-transform group-hover:scale-105" />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white group-hover:text-blue-200 transition-colors">
                  Grovyn
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Healthcare OS
                </span>
              </div>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-full border border-slate-800/60 text-sm">
            <a
              href="#platforms"
              className="px-3.5 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              Platforms
            </a>
            <a
              href="#hospital-os"
              className="px-3.5 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
            >
              <Building2 className="h-3.5 w-3.5 text-blue-400" />
              Hospital OS
            </a>
            <a
              href="#dental-os"
              className="px-3.5 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-teal-400" />
              Dental OS
            </a>
            <a
              href="#workflows"
              className="px-3.5 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              Workflows
            </a>
            <a
              href="#experience"
              className="px-3.5 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              Experience
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {!isLoading && isAuthenticated ? (
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm">
                <Link href={workspaceHref} className="flex items-center gap-1.5">
                  <span>Go to Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-slate-300 hover:text-white hover:bg-slate-800/70 text-sm font-medium"
                >
                  <Link href="/login">Log In</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-medium shadow-sm shadow-blue-500/20 border border-blue-400/20"
                >
                  <Link href="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu hamburger */}
          <div className="md:hidden flex items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3 shadow-xl">
            <div className="flex flex-col space-y-2 text-sm">
              <a
                href="#platforms"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Platforms
              </a>
              <a
                href="#hospital-os"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <Building2 className="h-4 w-4 text-blue-400" />
                Grovyn Hospital OS
              </a>
              <a
                href="#dental-os"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4 text-teal-400" />
                Grovyn Dental OS
              </a>
              <a
                href="#workflows"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Workflows
              </a>
              <a
                href="#experience"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Product Experience
              </a>
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
              {!isLoading && isAuthenticated ? (
                <Button asChild className="w-full bg-blue-600 hover:bg-blue-500 text-white">
                  <Link href={workspaceHref}>Open Workspace</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" className="w-full border-slate-700 text-slate-200 hover:bg-slate-800">
                    <Link href="/login">Log In</Link>
                  </Button>
                  <Button asChild className="w-full bg-blue-600 hover:bg-blue-500 text-white">
                    <Link href="/register">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
