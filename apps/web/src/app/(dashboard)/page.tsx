import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome to MediCore Hospital Management System
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label, "Today's OPD", value: '—', delta: '—' },
          { label: "Admitted", value: '—', delta: '—' },
          { label: "Pending Bills", value: '—', delta: '—' },
          { label: "Lab Orders", value: '—', delta: '—' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border bg-card p-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.delta}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Dashboard widgets — implemented in Milestone 1 completion
      </div>
    </div>
  )
}
