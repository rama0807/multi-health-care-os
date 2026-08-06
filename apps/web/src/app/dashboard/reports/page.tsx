'use client'

import type { ExecutiveDashboardKey, ReportFilterQuery } from '@medicore/types'
import {
  Activity,
  BedDouble,
  Boxes,
  FlaskConical,
  Landmark,
  LayoutDashboard,
  Pill,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { SegmentedNav } from '@/components/ui/segmented-nav'

import { ModuleSection } from './_components/module-section'
import type { ModuleView } from './_components/module-section'
import { OverviewSection } from './_components/overview-section'
import { ReportFilters, defaultFilters } from './_components/report-filters'
import {
  loadBedOccupancy,
  loadDoctors,
  loadInsurance,
  loadInventory,
  loadLaboratory,
  loadOpdIpdTrends,
  loadPatients,
  loadPharmacy,
  loadRevenue,
} from './_components/report-sections'
import { SectionExportMenu } from './_components/section-export-menu'

const SECTIONS = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'revenue', label: 'Revenue', icon: Landmark },
  { value: 'patients', label: 'Patients', icon: Users },
  { value: 'doctors', label: 'Doctors', icon: Stethoscope },
  { value: 'opd-ipd', label: 'OPD / IPD', icon: Activity },
  { value: 'bed-occupancy', label: 'Bed Occupancy', icon: BedDouble },
  { value: 'laboratory', label: 'Laboratory', icon: FlaskConical },
  { value: 'pharmacy', label: 'Pharmacy', icon: Pill },
  { value: 'insurance', label: 'Insurance', icon: ShieldCheck },
  { value: 'inventory', label: 'Inventory', icon: Boxes },
] as const

type SectionKey = (typeof SECTIONS)[number]['value']

interface ModuleConfig {
  description: string
  exportModule: string | string[]
  filterControls: Array<'groupBy' | 'doctorId' | 'departmentId'>
  load: (filters: ReportFilterQuery) => Promise<ModuleView>
}

const MODULE_CONFIG: Record<Exclude<SectionKey, 'overview'>, ModuleConfig> = {
  revenue: {
    description: 'Invoiced revenue, collections, outstanding balances and GST - straight from the billing ledger.',
    exportModule: 'Billing',
    filterControls: ['groupBy'],
    load: loadRevenue,
  },
  patients: {
    description: 'Registrations, demographics and how many of them were active in the period.',
    exportModule: 'Patients',
    filterControls: ['groupBy'],
    load: loadPatients,
  },
  doctors: {
    description: 'Consultation load, OPD/IPD split and appointment utilisation, doctor by doctor.',
    exportModule: ['Doctors', 'Appointments'],
    filterControls: ['groupBy', 'doctorId'],
    load: loadDoctors,
  },
  'opd-ipd': {
    description: 'Outpatient appointment volume alongside inpatient admissions - two flows, one period.',
    exportModule: ['Appointments', 'IPD'],
    filterControls: ['groupBy', 'doctorId'],
    load: loadOpdIpdTrends,
  },
  'bed-occupancy': {
    description: 'Live bed occupancy and ward-by-ward utilisation across the inpatient estate.',
    exportModule: 'IPD',
    filterControls: ['groupBy'],
    load: loadBedOccupancy,
  },
  laboratory: {
    description: 'Order volume, turnaround time and revenue by test category.',
    exportModule: 'Laboratory',
    filterControls: ['groupBy', 'doctorId'],
    load: loadLaboratory,
  },
  pharmacy: {
    description: 'Dispensing volume, top medicines and current stock alerts.',
    exportModule: 'Pharmacy',
    filterControls: ['groupBy'],
    load: loadPharmacy,
  },
  insurance: {
    description: 'Claims filed, settlement performance and how each payer compares.',
    exportModule: 'Insurance',
    filterControls: ['groupBy'],
    load: loadInsurance,
  },
  inventory: {
    description: 'Consumption value, purchasing activity and vendor performance.',
    exportModule: 'Inventory',
    filterControls: ['groupBy'],
    load: loadInventory,
  },
}

/**
 * Reports & Analytics hub (Milestone 17 redesign).
 *
 * One page, one shared date range, ten sections - the same information
 * architecture pattern the Organization workspace uses (header + segmented
 * nav + section body). Every section renders only what the API returned;
 * nothing here invents a metric the backend doesn't already compute. The
 * former `/operational` route is retired - its module-by-module reports now
 * live here as first-class sections instead of a second page to discover.
 */
export default function ReportsPage() {
  const [section, setSection] = useState<SectionKey>('overview')
  const [perspective, setPerspective] = useState<ExecutiveDashboardKey>('ceo')
  const [filters, setFilters] = useState<ReportFilterQuery>(defaultFilters())

  const moduleConfig = section === 'overview' ? null : MODULE_CONFIG[section]

  return (
    <PageLayout
      title="Reports & Analytics"
      description="Executive dashboards and module analytics, built entirely from live operational data."
      actions={
        <Button asChild variant="outline">
          <Link href="/dashboard/reports/builder">Custom reports</Link>
        </Button>
      }
    >
      <SegmentedNav items={SECTIONS} value={section} onChange={setSection} />

      <ReportFilters value={filters} onChange={setFilters} show={moduleConfig?.filterControls ?? ['groupBy']}>
        {moduleConfig && <SectionExportMenu module={moduleConfig.exportModule} filters={filters} />}
      </ReportFilters>

      {section === 'overview' ? (
        <OverviewSection
          perspective={perspective}
          onPerspectiveChange={setPerspective}
          filters={filters}
          onFiltersChange={setFilters}
        />
      ) : moduleConfig ? (
        <ModuleSection key={section} sectionKey={section} description={moduleConfig.description} filters={filters} load={moduleConfig.load} />
      ) : null}
    </PageLayout>
  )
}
