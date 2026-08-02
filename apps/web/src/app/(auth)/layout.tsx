import { Activity, ClipboardList, ShieldCheck, Users } from 'lucide-react'

const FEATURES = [
  { icon: Users, text: 'Unified patient records across every department' },
  { icon: ClipboardList, text: 'Clinical workflows for OPD, IPD, and emergency care' },
  { icon: ShieldCheck, text: 'Role-based access control, audited end to end' },
]

function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${className}`}>
      <Activity className="h-5 w-5" />
    </div>
  )
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-slate-900 p-10 text-white lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_45%)]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-white/5 blur-3xl" />

        <div className="relative flex items-center gap-2.5 text-lg font-semibold">
          <Logo className="bg-white/15" />
          MediCore
        </div>

        <div className="relative space-y-8">
          <div className="space-y-3">
            <p className="text-3xl font-semibold leading-tight text-balance">
              Hospital operations, unified.
            </p>
            <p className="max-w-sm text-base text-white/75">
              Patients, staff, and billing in one system built for hospitals, clinics, and
              diagnostic centers.
            </p>
          </div>
          <ul className="space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature.text} className="flex items-start gap-3 text-sm text-white/90">
                <feature.icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{feature.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          Multi-tenant, role-based access built for healthcare teams.
        </p>
      </div>

      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 text-lg font-semibold text-foreground lg:hidden">
            <Logo className="bg-primary text-primary-foreground" />
            MediCore
          </div>
          <div className="rounded-xl border bg-card p-8 shadow-lg shadow-black/5">{children}</div>
        </div>
      </div>
    </div>
  )
}
