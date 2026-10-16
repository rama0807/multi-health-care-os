'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileImage, ImageIcon, Receipt, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionHeader } from '@/components/ui/page-header'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  getOrganizationBranding,
  removeOrganizationLogo,
  updateOrganizationBranding,
  uploadOrganizationLogo,
} from '@/lib/api/organization'
import { useAuth } from '@/lib/auth/auth-context'

const COLOR_FIELDS = [
  { key: 'primaryColor', label: 'Primary' },
  { key: 'secondaryColor', label: 'Secondary' },
  { key: 'accentColor', label: 'Accent' },
] as const

type ColorKey = (typeof COLOR_FIELDS)[number]['key']

export function BrandSection() {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const canEdit = hasPermission('organizations.update')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const brandingQuery = useQuery({
    queryKey: ['organization', 'branding'],
    queryFn: getOrganizationBranding,
  })

  const [colors, setColors] = useState<Partial<Record<ColorKey, string>>>({})
  const [displayName, setDisplayName] = useState('')
  const [loginTagline, setLoginTagline] = useState('')
  const [emailFooterText, setEmailFooterText] = useState('')

  useEffect(() => {
    const branding = brandingQuery.data
    if (!branding) return
    setColors({
      primaryColor: branding.primaryColor ?? '#0f62fe',
      secondaryColor: branding.secondaryColor ?? '#525252',
      accentColor: branding.accentColor ?? '#0043ce',
    })
    setDisplayName(branding.displayName ?? '')
    setLoginTagline(branding.loginTagline ?? '')
    setEmailFooterText(branding.emailFooterText ?? '')
  }, [brandingQuery.data])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['organization'] })
  }

  const onError = (error: { response?: { data?: { message?: string } } }) =>
    toast({
      title: 'Could not save branding',
      description: error.response?.data?.message ?? 'Please try again.',
      variant: 'destructive',
    })

  const saveMutation = useMutation({
    mutationFn: updateOrganizationBranding,
    onSuccess: () => {
      invalidate()
      toast({ title: 'Branding updated' })
    },
    onError,
  })

  const uploadMutation = useMutation({
    mutationFn: uploadOrganizationLogo,
    onSuccess: () => {
      invalidate()
      toast({ title: 'Logo uploaded' })
    },
    onError: (error: { response?: { data?: { message?: string } } }) =>
      toast({
        title: 'Could not upload logo',
        description: error.response?.data?.message ?? 'PNG, JPEG, SVG or WebP up to 2 MB.',
        variant: 'destructive',
      }),
  })

  const removeMutation = useMutation({
    mutationFn: removeOrganizationLogo,
    onSuccess: () => {
      invalidate()
      toast({ title: 'Logo removed' })
    },
    onError,
  })

  function handleSave(event: React.FormEvent) {
    event.preventDefault()
    saveMutation.mutate({
      ...colors,
      displayName: displayName.trim() || undefined,
      loginTagline: loginTagline.trim() || undefined,
      emailFooterText: emailFooterText.trim() || undefined,
    })
  }

  const logo = brandingQuery.data?.logo ?? null

  return (
    <div className="space-y-4">
      <SectionHeader title="Brand" description="Logo, theme colours and the identity that reaches emails." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Logo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-24 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Organization logo" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            {canEdit && (
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadMutation.mutate(file)
                    e.target.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
                </Button>
                {logo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate()}
                  >
                    Remove
                  </Button>
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">PNG, JPEG, SVG or WebP, up to 2 MB.</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Theme</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave}>
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface-secondary/50 p-3">
                {COLOR_FIELDS.map((field) => (
                  <span
                    key={field.key}
                    className="h-8 flex-1 rounded"
                    style={{ backgroundColor: colors[field.key] ?? '#e5e5e5' }}
                    title={field.label}
                  />
                ))}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {COLOR_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label htmlFor={`brand-${field.key}`}>{field.label} colour</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label={`${field.label} picker`}
                        className="h-9 w-10 cursor-pointer rounded border bg-background"
                        value={colors[field.key] ?? '#000000'}
                        disabled={!canEdit}
                        onChange={(e) => setColors((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      />
                      <Input
                        id={`brand-${field.key}`}
                        value={colors[field.key] ?? ''}
                        disabled={!canEdit}
                        onChange={(e) => setColors((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {canEdit ? (
                <div className="mt-4 flex justify-end">
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving…' : 'Save theme'}
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">You have read-only access to branding.</p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email branding</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="brand-display-name">Display name</Label>
                <Input
                  id="brand-display-name"
                  value={displayName}
                  disabled={!canEdit}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Shown instead of the organization name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="brand-tagline">Login tagline</Label>
                <Input
                  id="brand-tagline"
                  value={loginTagline}
                  disabled={!canEdit}
                  onChange={(e) => setLoginTagline(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <Label htmlFor="brand-email-footer">Email footer text</Label>
              <Textarea
                id="brand-email-footer"
                rows={3}
                value={emailFooterText}
                disabled={!canEdit}
                onChange={(e) => setEmailFooterText(e.target.value)}
              />
            </div>

            {canEdit && (
              <div className="mt-4 flex justify-end">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving…' : 'Save email branding'}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card variant="inset" className="p-4">
          <div className="flex items-center gap-2">
            <FileImage className="size-4 text-subtle-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Favicon</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Not configurable per organization yet - every tenant uses MediCore&apos;s default browser icon.
          </p>
        </Card>
        <Card variant="inset" className="p-4">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-subtle-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Invoice &amp; PDF branding</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Invoices, receipts and reports already include your organization name, address and tax
            details. Logo and colour theming inside those documents isn&apos;t available yet.
          </p>
        </Card>
      </div>
    </div>
  )
}
