'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Loader2, Mail, Send } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionHeader } from '@/components/ui/page-header'
import { useToast } from '@/hooks/use-toast'
import {
  getOrganizationEmailConfig,
  sendTestEmail,
  updateOrganizationEmailConfig,
} from '@/lib/api/organization'
import { useAuth } from '@/lib/auth/auth-context'

type MutationError = { response?: { data?: { message?: string } } }

/**
 * A tenant's own Resend credential (TD-0064) - without one, every
 * organization on this deployment shares the single platform
 * `RESEND_API_KEY`. Wired into password-reset and verification email today;
 * other send sites (appointments, staff onboarding, scheduled reports)
 * still use the platform default - a scoped, disclosed follow-up, not an
 * oversight.
 *
 * The key is never round-tripped: `apiKeyMasked` is the only trace of it
 * this page ever receives, and saving a new one replaces it without ever
 * reading the old value back.
 */
export function EmailSection() {
  const { toast } = useToast()
  const { hasPermission, user } = useAuth()
  const queryClient = useQueryClient()
  const canEdit = hasPermission('organizations.update')

  const configQuery = useQuery({
    queryKey: ['organization', 'email-config'],
    queryFn: getOrganizationEmailConfig,
  })

  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [replyToEmail, setReplyToEmail] = useState('')
  const [testRecipient, setTestRecipient] = useState('')

  useEffect(() => {
    const config = configQuery.data
    if (!config) return
    setFromName(config.fromName ?? '')
    setFromEmail(config.fromEmail ?? '')
    setReplyToEmail(config.replyToEmail ?? '')
  }, [configQuery.data])

  useEffect(() => {
    if (user?.email) setTestRecipient(user.email)
  }, [user?.email])

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['organization', 'email-config'] })

  const onError = (error: MutationError) =>
    toast({
      title: 'Could not save email settings',
      description: error.response?.data?.message ?? 'Please try again.',
      variant: 'destructive',
    })

  const saveMutation = useMutation({
    mutationFn: updateOrganizationEmailConfig,
    onSuccess: () => {
      invalidate()
      setApiKeyDraft('')
      toast({ title: 'Email settings saved' })
    },
    onError,
  })

  const removeKeyMutation = useMutation({
    mutationFn: () => updateOrganizationEmailConfig({ apiKey: null }),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Custom Resend key removed - back to the platform default' })
    },
    onError,
  })

  const testMutation = useMutation({
    mutationFn: () => sendTestEmail(testRecipient),
    onSuccess: (result) => {
      toast({
        title: result.sent ? 'Test email sent' : 'Test email not delivered',
        description: result.sent
          ? `Sent to ${result.to} using ${result.usedOrganizationKey ? "this organization's" : 'the platform default'} Resend key.`
          : 'No Resend key is configured anywhere on this server, so the email was only logged, not delivered.',
        variant: result.sent ? 'default' : 'destructive',
      })
    },
    onError: (error: MutationError) =>
      toast({
        title: 'Test email failed',
        description: error.response?.data?.message ?? 'The configured Resend key rejected the request.',
        variant: 'destructive',
      }),
  })

  function handleSave(event: React.FormEvent) {
    event.preventDefault()
    saveMutation.mutate({
      apiKey: apiKeyDraft.trim() || undefined,
      fromName: fromName.trim() || null,
      fromEmail: fromEmail.trim() || null,
      replyToEmail: replyToEmail.trim() || null,
    })
  }

  const config = configQuery.data

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Email"
        description="Bring your own Resend account instead of sharing MediCore's shared sender. The footer text on branded emails is set in Brand → Email branding."
      />

      <form onSubmit={handleSave} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <KeyRound className="size-4" aria-hidden="true" />
              Resend API key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={config?.hasApiKey ? 'success' : 'neutral'} size="sm">
                {config?.hasApiKey ? 'Configured' : 'Using platform default'}
              </Badge>
              {config?.hasApiKey && (
                <span className="font-mono text-xs text-muted-foreground">{config.apiKeyMasked}</span>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="email-api-key">
                {config?.hasApiKey ? 'Replace key' : 'API key'}
              </Label>
              <Input
                id="email-api-key"
                type="password"
                placeholder={config?.hasApiKey ? 'Leave blank to keep the current key' : 're_xxxxxxxxxxxx'}
                value={apiKeyDraft}
                disabled={!canEdit}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                From{' '}
                <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="underline">
                  resend.com/api-keys
                </a>
                . Stored encrypted (AES-256-GCM) - never shown again after saving.
              </p>
            </div>

            {canEdit && config?.hasApiKey && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removeKeyMutation.isPending}
                onClick={() => removeKeyMutation.mutate()}
              >
                {removeKeyMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Remove key - revert to platform default
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sender identity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="email-from-name">From name</Label>
                <Input
                  id="email-from-name"
                  value={fromName}
                  disabled={!canEdit}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="MediCore Demo Hospital"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email-from-address">From address</Label>
                <Input
                  id="email-from-address"
                  type="email"
                  value={fromEmail}
                  disabled={!canEdit}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="no-reply@yourdomain.com"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="email-reply-to">Reply-to address</Label>
                <Input
                  id="email-reply-to"
                  type="email"
                  value={replyToEmail}
                  disabled={!canEdit}
                  onChange={(e) => setReplyToEmail(e.target.value)}
                  placeholder="support@yourdomain.com"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The from address must be on a domain verified in your Resend account, or delivery will fail.
            </p>
          </CardContent>
        </Card>

        {canEdit ? (
          <div className="flex justify-end">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Save email settings
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">You have read-only access to email settings.</p>
        )}
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Mail className="size-4" aria-hidden="true" />
            Send a test email
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div className="min-w-[16rem] flex-1 space-y-1">
            <Label htmlFor="email-test-recipient">Send to</Label>
            <Input
              id="email-test-recipient"
              type="email"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit || !testRecipient || testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            {testMutation.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 size-3.5" />
            )}
            Send test email
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
