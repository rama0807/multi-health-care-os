'use client'

import type { AiFeature } from '@medicore/types'
import { AI_FEATURES, AI_FEATURE_LABELS } from '@medicore/types'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { AiAssistDialog } from '@/components/ai/ai-assist-dialog'
import { PageLayout } from '@/components/layout/page-layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAiStatus, getAiUsageSummary, listAiConversations, listAiUsage } from '@/lib/api/ai'
import { useAuth } from '@/lib/auth/auth-context'

/** Which record identifier each feature needs, and what to call it in the UI. */
const FEATURE_INPUT: Record<AiFeature, { key: string; label: string }> = {
  SOAP_NOTE: { key: 'encounterId', label: 'Encounter ID' },
  CLINICAL_NOTE_SUMMARY: { key: 'encounterId', label: 'Encounter ID' },
  LAB_RESULT_SUMMARY: { key: 'labTestId', label: 'Lab order ID' },
  RADIOLOGY_REPORT_SUMMARY: { key: 'radiologyOrderId', label: 'Radiology order ID' },
  PRESCRIPTION_EXPLANATION: { key: 'prescriptionId', label: 'Prescription ID' },
  DISCHARGE_SUMMARY: { key: 'admissionId', label: 'Admission ID' },
  REFERRAL_LETTER: { key: 'encounterId', label: 'Encounter ID' },
}

export default function AiPage() {
  const { hasPermission } = useAuth()
  const [feature, setFeature] = useState<AiFeature>('SOAP_NOTE')
  const [recordId, setRecordId] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [reason, setReason] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: status, isLoading: statusLoading } = useQuery({ queryKey: ['ai-status'], queryFn: getAiStatus })

  const canManage = hasPermission('ai.manage')
  const input = FEATURE_INPUT[feature]
  const isReferral = feature === 'REFERRAL_LETTER'
  const canGenerate = recordId.trim().length > 0 && (!isReferral || (specialty.trim() && reason.trim()))

  return (
    <PageLayout
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> AI Clinical Assistant
        </span>
      }
      description="Drafts clinical documents from records already in the system. Every output is a draft for clinician review."
    >
      {statusLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking AI availability…
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Provider status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={status?.enabled ? 'success' : 'neutral'}>
                {status?.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Badge variant={status?.configured ? 'success' : 'danger'}>
                {status?.configured ? 'Configured' : 'Not configured'}
              </Badge>
              <Badge variant="outline">{status?.provider}</Badge>
              <Badge variant="outline">{status?.model}</Badge>
              {status?.streamingSupported && <Badge variant="outline">Streaming</Badge>}
            </div>
            {status?.unavailableReason && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>AI cannot serve requests</AlertTitle>
                <AlertDescription>
                  {status.unavailableReason}. Generation endpoints return an error rather than placeholder clinical
                  text.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-1">
              {status?.features.map((entry) => (
                <Badge key={entry.feature} variant={entry.enabled ? 'outline' : 'neutral'}>
                  {entry.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="assistant">
        <TabsList>
          <TabsTrigger value="assistant">Assistant</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          {canManage && <TabsTrigger value="usage">Usage</TabsTrigger>}
        </TabsList>

        <TabsContent value="assistant">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generate a draft</CardTitle>
              <CardDescription>
                Pick a generator and the record it should read. Every generator uses only what is already documented.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Generator</label>
                  <Select value={feature} onValueChange={(value) => setFeature(value as AiFeature)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_FEATURES.map((entry) => (
                        <SelectItem key={entry} value={entry}>
                          {AI_FEATURE_LABELS[entry]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{input.label}</label>
                  <Input
                    value={recordId}
                    onChange={(event) => setRecordId(event.target.value)}
                    placeholder={`Paste the ${input.label.toLowerCase()}`}
                  />
                </div>
              </div>

              {isReferral && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Referred to specialty</label>
                    <Input
                      value={specialty}
                      onChange={(event) => setSpecialty(event.target.value)}
                      placeholder="e.g. Cardiology"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Reason for referral</label>
                    <Input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="e.g. Persistent exertional chest pain"
                    />
                  </div>
                </div>
              )}

              <Button disabled={!canGenerate} onClick={() => setDialogOpen(true)}>
                <Sparkles /> Open assistant
              </Button>
            </CardContent>
          </Card>

          {canGenerate && (
            <AiAssistDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              feature={feature}
              contextRefs={
                {
                  [input.key]: recordId.trim(),
                  ...(isReferral ? { referredToSpecialty: specialty.trim(), reason: reason.trim() } : {}),
                } as never
              }
            />
          )}
        </TabsContent>

        <TabsContent value="conversations">
          <ConversationsTab />
        </TabsContent>

        {canManage && (
          <TabsContent value="usage">
            <UsageTab />
          </TabsContent>
        )}
      </Tabs>
    </PageLayout>
  )
}

function ConversationsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['ai-conversations'], queryFn: () => listAiConversations() })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading conversations…
      </div>
    )
  }

  if (!data?.data.length) {
    return <EmptyState compact title="No AI generations yet" />
  }

  return (
    <Card>
      <TableContainer className="rounded-none border-0">
        <Table density="compact" container={false}>
          <TableHeader>
            <TableRow>
              <TableHead>Generated</TableHead>
              <TableHead>Feature</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead align="right">Tokens</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((conversation) => (
              <TableRow key={conversation.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {new Date(conversation.createdAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{conversation.featureLabel}</Badge>
                </TableCell>
                <TableCell className="text-sm">{conversation.title}</TableCell>
                <TableCell className="text-sm">{conversation.patientName ?? '—'}</TableCell>
                <TableCell align="right" className="font-mono text-sm">{conversation.totalTokens}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  )
}

function UsageTab() {
  const { data: summary, isLoading } = useQuery({ queryKey: ['ai-usage-summary'], queryFn: () => getAiUsageSummary() })
  const { data: entries } = useQuery({ queryKey: ['ai-usage'], queryFn: () => listAiUsage({ limit: 20 }) })

  if (isLoading || !summary) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading usage…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <StatCardGrid columns={4}>
        <StatCard label="Requests" value={summary.totalRequests} hint={`${summary.failedRequests} failed`} />
        <StatCard
          label="Total tokens"
          value={summary.totalTokens.toLocaleString('en-IN')}
          hint={summary.containsEstimatedTokens ? 'Includes estimated counts' : 'All metered'}
        />
        <StatCard
          label="Estimated cost (USD)"
          value={summary.estimatedCostUsd.toFixed(4)}
          hint={summary.estimatedCostUsd === 0 ? 'No per-token price configured' : `${summary.from} → ${summary.to}`}
        />
        <StatCard label="Avg latency" value={`${summary.averageLatencyMs} ms`} hint={`${summary.from} → ${summary.to}`} />
      </StatCardGrid>

      {summary.byFeature.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>By feature</CardTitle>
          </CardHeader>
          <TableContainer className="rounded-none border-0 border-y">
            <Table density="compact" container={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead align="right">Requests</TableHead>
                  <TableHead align="right">Tokens</TableHead>
                  <TableHead align="right">Cost (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.byFeature.map((row) => (
                  <TableRow key={row.feature}>
                    <TableCell>{row.featureLabel}</TableCell>
                    <TableCell align="right" className="font-mono">{row.requests}</TableCell>
                    <TableCell align="right" className="font-mono">{row.totalTokens.toLocaleString('en-IN')}</TableCell>
                    <TableCell align="right" className="font-mono">{row.estimatedCostUsd.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {entries && entries.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent requests</CardTitle>
          </CardHeader>
          <TableContainer className="rounded-none border-0 border-y">
            <Table density="compact" container={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Feature</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead align="right">Tokens</TableHead>
                  <TableHead align="right">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.data.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(entry.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell className="text-sm">{entry.featureLabel}</TableCell>
                    <TableCell className="font-mono text-xs">{entry.model}</TableCell>
                    <TableCell>
                      <StatusBadge status={entry.status} />
                      {entry.errorCode && (
                        <span className="ml-2 text-xs text-muted-foreground">{entry.errorCode}</span>
                      )}
                    </TableCell>
                    <TableCell align="right" className="font-mono text-sm">
                      {entry.totalTokens}
                      {entry.tokensEstimated ? '*' : ''}
                    </TableCell>
                    <TableCell align="right" className="font-mono text-sm">{entry.latencyMs} ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">* Token count estimated, not reported by the provider.</p>
    </div>
  )
}
