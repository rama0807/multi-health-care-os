import type { Metadata } from 'next'

import { AudienceSection } from '@/components/landing/audience-section'
import { CtaSection } from '@/components/landing/cta-section'
import { ExperienceShowcase } from '@/components/landing/experience-showcase'
import { HeroSection } from '@/components/landing/hero-section'
import { LandingFooter } from '@/components/landing/landing-footer'
import { LandingNav } from '@/components/landing/landing-nav'
import { PlatformsSection } from '@/components/landing/platforms-section'
import { WorkflowsSection } from '@/components/landing/workflows-section'

export const metadata: Metadata = {
  title: 'Grovyn — Two Specialized Systems. One Connected Healthcare Platform',
  description:
    'Run hospital operations or manage a modern dental practice with software built around the workflows, teams, and decisions that matter to your organization. Featuring Grovyn Hospital OS and Grovyn Dental OS.',
  keywords: [
    'Hospital Management System',
    'Dental Practice Management',
    'Hospital OS',
    'Dental OS',
    'Odontogram Charting',
    'Inpatient Ward Management',
    'Grovyn Healthcare',
  ],
  openGraph: {
    title: 'Grovyn — Two Specialized Systems. One Connected Healthcare Platform',
    description:
      'Grovyn delivers two dedicated operating systems: Grovyn Hospital OS for hospital facilities and Grovyn Dental OS for modern dental practices.',
    type: 'website',
  },
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Fixed/Sticky Navigation */}
      <LandingNav />

      {/* Main Landing Sections */}
      <main className="flex-1">
        {/* Section 2: Hero with Layered Product Showcase */}
        <HeroSection />

        {/* Section 3: Dual Platform In-Depth Showcases */}
        <PlatformsSection />

        {/* Section 4: The Connected Healthcare Architecture Story */}
        <WorkflowsSection />

        {/* Section 5: Real Clinical Experience & UI Showcase */}
        <ExperienceShowcase />

        {/* Section 6: Organizational Fit & Guidance */}
        <AudienceSection />

        {/* Section 7: Final Conversion Section */}
        <CtaSection />
      </main>

      {/* Section 8: Enterprise Footer */}
      <LandingFooter />
    </div>
  )
}
