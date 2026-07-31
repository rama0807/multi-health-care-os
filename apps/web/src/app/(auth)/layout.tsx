import { Activity } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-slate-900 p-10 text-primary-foreground lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_45%)]" />
        <div className="relative flex items-center gap-2 text-lg font-semibold">
          <Activity className="h-6 w-6" />
          MediCore
        </div>
        <div className="relative space-y-3">
          <p className="text-2xl font-medium leading-snug">
            Hospital operations, unified — patients, staff, and billing in one system.
          </p>
          <p className="text-sm text-primary-foreground/70">
            Multi-tenant, role-based access built for hospitals, clinics, and diagnostic centers.
          </p>
        </div>
      </div>

      <div className="flex min-h-screen items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
