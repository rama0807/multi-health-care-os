'use client'

import { Building2, MapPinned, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'


import { SegmentedNav } from '@/components/ui/segmented-nav'

import { DepartmentsPanel } from './departments-panel'
import { HospitalsPanel } from './hospitals-panel'
import { SettingsPanel } from './settings-panel'

const WORKSPACE_TABS = [
  { value: 'hospitals', label: 'Clinics / Branches', icon: Building2 },
  { value: 'departments', label: 'Specialties', icon: MapPinned },
  { value: 'settings', label: 'Settings', icon: SlidersHorizontal },
] as const

type WorkspaceTab = (typeof WORKSPACE_TABS)[number]['value']

export function WorkspaceSection() {
  const [tab, setTab] = useState<WorkspaceTab>('hospitals')

  return (
    <div className="space-y-4">
      <SegmentedNav items={WORKSPACE_TABS} value={tab} onChange={setTab} size="sm" className="w-fit" />

      {tab === 'hospitals' && <HospitalsPanel />}
      {tab === 'departments' && <DepartmentsPanel />}
      {tab === 'settings' && <SettingsPanel />}
    </div>
  )
}
