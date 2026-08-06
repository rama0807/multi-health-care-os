'use client'

import type { AiFeature, AiGenerationResult, GenerateAiContentDto } from '@medicore/types'
import { AI_FEATURE_LABELS } from '@medicore/types'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, Copy, Loader2, Sparkles, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { getAiStatus, streamAiContent } from '@/lib/api/ai'

interface AiAssistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feature: AiFeature
  /** Everything except `feature` and `additionalContext` - the record refs. */
  contextRefs: Omit<GenerateAiContentDto, 'feature' | 'additionalContext'>
  /** Offered when the caller can do something with the draft (e.g. paste it into a form). */
  onAccept?: (content: string) => void
  acceptLabel?: string
}

/**
 * Streams one generation and shows it as an editable draft. Nothing here ever
 * writes to a patient record - `onAccept` hands the text back to the caller,
 * which is the only path by which AI output can reach the chart.
 */
export function AiAssistDialog({
  open,
  onOpenChange,
  feature,
  contextRefs,
  onAccept,
  acceptLabel = 'Use this draft',
}: AiAssistDialogProps) {
  const { toast } = useToast()
  const [content, setContent] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiGenerationResult | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['ai-status'],
    queryFn: getAiStatus,
    // Availability is deployment config, not per-request state.
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })

  const featureStatus = status?.features.find((entry) => entry.feature === feature)
  const unavailableReason = !status
    ? null
    : !featureStatus?.enabled
      ? (status.unavailableReason ?? `${AI_FEATURE_LABELS[feature]} is disabled for this deployment.`)
      : null

  const generate = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsStreaming(true)
    setError(null)
    setResult(null)
    setContent('')

    await streamAiContent(
      { feature, ...contextRefs, additionalContext: additionalContext || undefined } as GenerateAiContentDto,
      {
        onChunk: (delta) => setContent((previous) => previous + delta),
        onDone: (generation) => {
          setResult(generation)
          setIsStreaming(false)
        },
        onError: (message) => {
          setError(message)
          setIsStreaming(false)
        },
      },
      controller.signal,
    ).catch((streamError: unknown) => {
      if (controller.signal.aborted) return
      setError(streamError instanceof Error ? streamError.message : 'The AI request failed.')
      setIsStreaming(false)
    })
  }, [additionalContext, contextRefs, feature])

  // Cancel any in-flight stream when the dialog closes, and reset for next time.
  useEffect(() => {
    if (open) return
    abortRef.current?.abort()
    setContent('')
    setAdditionalContext('')
    setResult(null)
    setError(null)
    setIsStreaming(false)
    setCopied(false)
  }, [open])

  const copy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {AI_FEATURE_LABELS[feature]}
          </DialogTitle>
          <DialogDescription>
            Generated from this record’s existing documentation. Review and edit before use.
          </DialogDescription>
        </DialogHeader>

        {statusLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking AI availability…
          </div>
        ) : unavailableReason ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>AI is unavailable</AlertTitle>
            <AlertDescription>
              {unavailableReason} No content has been generated - this system does not produce placeholder clinical
              text.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="ai-additional-context">
                Additional instructions (optional)
              </label>
              <Textarea
                id="ai-additional-context"
                rows={2}
                value={additionalContext}
                onChange={(event) => setAdditionalContext(event.target.value)}
                placeholder="e.g. Emphasise the cardiac history; keep it under 200 words."
                disabled={isStreaming}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Generation failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {(content || isStreaming) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Draft</span>
                  {isStreaming && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Generating…
                    </span>
                  )}
                </div>
                <Textarea
                  rows={16}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            )}

            {result && (
              <>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Clinician review required</AlertTitle>
                  <AlertDescription>{result.disclaimer}</AlertDescription>
                </Alert>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{result.provider}</Badge>
                  <Badge variant="outline">{result.model}</Badge>
                  <span>
                    {result.usage.totalTokens} tokens
                    {result.usage.estimated ? ' (estimated)' : ''}
                  </span>
                  <span>{result.latencyMs} ms</span>
                  {result.attempts > 1 && <span>{result.attempts} attempts</span>}
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            {content && !isStreaming && (
              <Button variant="outline" size="sm" onClick={() => void copy()}>
                {copied ? <Check /> : <Copy />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {isStreaming ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  abortRef.current?.abort()
                  setIsStreaming(false)
                }}
              >
                <Square /> Stop
              </Button>
            ) : (
              <Button size="sm" onClick={() => void generate()} disabled={!!unavailableReason || statusLoading}>
                <Sparkles />
                {content ? 'Regenerate' : 'Generate'}
              </Button>
            )}
            {onAccept && content && !isStreaming && (
              <Button
                size="sm"
                onClick={() => {
                  onAccept(content)
                  toast({ title: 'Draft applied', description: 'Review it before saving.' })
                  onOpenChange(false)
                }}
              >
                {acceptLabel}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
