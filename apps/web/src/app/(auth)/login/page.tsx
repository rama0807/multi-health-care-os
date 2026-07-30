import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to MediCore</h1>
          <p className="text-sm text-muted-foreground">Enter your credentials to continue</p>
        </div>
        {/* LoginForm component will be implemented in M2 */}
        <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
          Login form — implemented in Milestone 2
        </div>
      </div>
    </div>
  )
}
