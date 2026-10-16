'use client'

import type { Patient } from '@medicore/types'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'

import { LedgerTab } from '@/components/dental/ledger-tab'
import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listPatients } from '@/lib/api/patients'

function PatientPicker({ selected, onSelect }: { selected: Patient | null; onSelect: (patient: Patient | null) => void }) {
  const [query, setQuery] = useState('')

  const searchQuery = useQuery({
    queryKey: ['patients', 'search', query],
    queryFn: () => listPatients({ q: query, limit: 8 }),
    enabled: query.trim().length >= 2,
  })

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border p-4 bg-muted/20">
        <div>
          <p className="font-medium text-lg">{selected.fullName}</p>
          <p className="font-mono text-sm text-muted-foreground">
            {selected.uhid} · {selected.phone}
          </p>
        </div>
        <Button variant="outline" onClick={() => onSelect(null)}>
          Change Patient
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-w-xl">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 py-6 text-base"
          placeholder="Search by name, phone, or UHID to view ledger..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {query.trim().length >= 2 && (
        <div className="max-h-64 overflow-y-auto rounded-md border shadow-sm">
          {searchQuery.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Searching...</p>
          ) : searchQuery.data?.data.length ? (
            searchQuery.data.data.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => onSelect(p)}
                className="flex w-full flex-col items-start p-3 text-left hover:bg-muted"
              >
                <span className="font-medium">{p.fullName}</span>
                <span className="font-mono text-sm text-muted-foreground">
                  {p.uhid} · {p.phone}
                </span>
              </button>
            ))
          ) : (
            <p className="p-4 text-sm text-muted-foreground">No patients found.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function DentalLedgerPage() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Billing', href: '/dental/billing' },
        { label: 'Patient Ledger' },
      ]}
      title="Patient Ledger"
    >
      <div className="flex flex-col gap-8 max-w-5xl mx-auto py-4">
        <div className="space-y-4">
          {!selectedPatient && (
            <div className="text-muted-foreground mb-4">
              Search and select a patient to view their complete financial overview and billing history.
            </div>
          )}
          <PatientPicker selected={selectedPatient} onSelect={setSelectedPatient} />
        </div>

        {selectedPatient && (
          <div className="mt-4 pt-6 border-t border-border">
            <LedgerTab patientId={selectedPatient.id} />
          </div>
        )}
      </div>
    </PageLayout>
  )
}
