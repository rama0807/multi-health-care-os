import { NextResponse } from 'next/server'

// Liveness only, matching the API's own /api/health/live (ADR-0029) - the
// Dockerfile's HEALTHCHECK hits this path directly against the standalone
// server, so it must respond without depending on the backend API or DB.
export function GET() {
  return NextResponse.json({ status: 'ok' })
}
