'use client'


export function WorkflowsSection() {
  return (
    <section id="workflows" className="py-24 bg-[#070B14] text-slate-100 border-t border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold uppercase tracking-wider">
            <span>Enterprise Healthcare Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Built around how healthcare actually works.
          </h2>
          <p className="text-base text-slate-400">
            Healthcare operations should not depend on disjointed spreadsheets or generic tools.
            Grovyn replaces operational friction with structured, role-governed workflows.
          </p>
        </div>

        {/* 4 Architectural Themes in an Editorial Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Theme 1: Connected Operations */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 space-y-4 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                01
              </div>
              <span className="text-xs font-mono text-slate-500">Architecture</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Connected Operations
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Eliminate disconnected departmental silos. In Hospital OS, an admission in Emergency
              immediately reserves a ward bed, alerts attending duty doctors, and opens a clinical MAR.
              In Dental OS, an appointment check-in queues the patient to the assigned operatory chair
              and pre-loads the patient&apos;s full dental history and active odontogram.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-2xs text-slate-400">
              <span className="px-2.5 py-1 rounded-md bg-slate-800/70 border border-slate-700/60">
                Single Source of Truth
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-800/70 border border-slate-700/60">
                Synchronized Department Handshakes
              </span>
            </div>
          </div>

          {/* Theme 2: Purpose-Built Workflows */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 space-y-4 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">
                02
              </div>
              <span className="text-xs font-mono text-slate-500">Specialization</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Purpose-Built Workflows
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Generic software fails healthcare because clinic workflows are inherently specialized.
              Grovyn enforces strict domain separation: dental surgeons navigate tooth surfaces and lab
              shades, while hospital physicians track vitals charts, nursing MARs, and lab panels.
              Neither system is compromised by the other&apos;s requirements.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-2xs text-slate-400">
              <span className="px-2.5 py-1 rounded-md bg-slate-800/70 border border-slate-700/60">
                Tooth-Level Precision
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-800/70 border border-slate-700/60">
                Multi-Ward Census & Triage
              </span>
            </div>
          </div>

          {/* Theme 3: Better Visibility */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 space-y-4 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                03
              </div>
              <span className="text-xs font-mono text-slate-500">Governance</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Clinical & Financial Visibility
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Authorized clinical directors, practice owners, and administrators gain immediate
              visibility into operational bottlenecks. Know which operatory chairs are running behind
              schedule, which inpatient beds are ready for housekeeping, and which invoices require
              collection without hunting across paper registers.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-2xs text-slate-400">
              <span className="px-2.5 py-1 rounded-md bg-slate-800/70 border border-slate-700/60">
                Real-Time Bed & Chair Telemetry
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-800/70 border border-slate-700/60">
                Live Billing Realization
              </span>
            </div>
          </div>

          {/* Theme 4: Room to Grow */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 space-y-4 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">
                04
              </div>
              <span className="text-xs font-mono text-slate-500">Scale</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Architected to Scale
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Start with a single clinic chair or an active hospital OPD and expand capacity as your
              facility grows. Built on a modular NestJS and PostgreSQL multi-tenant foundation,
              Grovyn ensures that your organizational records and clinical audit trails remain securely
              isolated, performant, and durable.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-2xs text-slate-400">
              <span className="px-2.5 py-1 rounded-md bg-slate-800/70 border border-slate-700/60">
                Role-Based Access Control
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-800/70 border border-slate-700/60">
                Tenant Data Isolation
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
