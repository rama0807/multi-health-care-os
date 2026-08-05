'use client'

import type { AiFeature, GenerateAiContentDto } from '@medicore/types'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/auth-context'

import { AiAssistDialog } from './ai-assist-dialog'

interface AiAssistButtonProps {
  feature: AiFeature
  contextRefs: Omit<GenerateAiContentDto, 'feature' | 'additionalContext'>
  label?: string
  size?: 'sm' | 'default'
  variant?: 'default' | 'outline' | 'ghost'
  onAccept?: (content: string) => void
  acceptLabel?: string
}

/**
 * Renders nothing for a user without `ai.generate` — the same permission the
 * API enforces, so the button never appears where the call would 403.
 */
export function AiAssistButton({
  feature,
  contextRefs,
  label = 'AI Assist',
  size = 'sm',
  variant = 'outline',
  onAccept,
  acceptLabel,
}: AiAssistButtonProps) {
  const { hasPermission } = useAuth()
  const [open, setOpen] = useState(false)

  if (!hasPermission('ai.generate')) return null

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Sparkles />
        {label}
      </Button>
      <AiAssistDialog
        open={open}
        onOpenChange={setOpen}
        feature={feature}
        contextRefs={contextRefs}
        onAccept={onAccept}
        acceptLabel={acceptLabel}
      />
    </>
  )
}
