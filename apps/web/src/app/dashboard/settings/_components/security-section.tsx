'use client'

import { useMutation } from '@tanstack/react-query'
import { Activity, KeyRound, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionHeader } from '@/components/ui/page-header'
import { useToast } from '@/hooks/use-toast'
import { changePassword } from '@/lib/api/account'

import { NotAvailableCard } from './not-available-card'

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

/**
 * The one real, self-service security action MediCore has today -
 * `POST /auth/change-password`. It revokes every other session on success
 * (the API's own behaviour, not something this form fakes), so the toast
 * says so.
 */
function ChangePasswordDialog() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () => changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      toast({ title: 'Password changed', description: 'You were signed out of every other session.' })
      setOpen(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (error: { response?: { data?: { message?: string } } }) =>
      toast({
        title: 'Could not change password',
        description: error.response?.data?.message ?? 'Check your current password and try again.',
        variant: 'destructive',
      }),
  })

  const newPasswordValid = PASSWORD_POLICY.test(newPassword)
  const canSubmit = currentPassword.length >= 8 && newPasswordValid && newPassword === confirmPassword

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Change password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Every other session will be signed out once this succeeds.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              aria-invalid={newPassword.length > 0 && !newPasswordValid}
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters, with an uppercase letter, a lowercase letter and a number.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={confirmPassword.length > 0 && confirmPassword !== newPassword}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Change password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SecuritySection() {
  return (
    <div className="space-y-4">
      <SectionHeader title="Security" description="Password and access controls for your own account." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Lock className="size-4" aria-hidden="true" />
            Password
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Change the password used to sign in to MediCore.</p>
          <ChangePasswordDialog />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NotAvailableCard
          icon={ShieldCheck}
          title="Two-factor authentication"
          description="No second factor (TOTP, SMS or email code) is enforced at sign-in yet."
        />
        <NotAvailableCard
          icon={KeyRound}
          title="API support"
          description="Every request authenticates as a signed-in user - there is no personal API key to issue."
        />
        <NotAvailableCard
          icon={Mail}
          title="Recovery email"
          description="A secondary recovery email address isn't a field on a user record yet."
        />
        <NotAvailableCard
          icon={Activity}
          title="Security score & recent activity"
          description="There's no self-service view of your own sign-in activity yet - only an org-wide audit log gated to admins."
        />
      </div>
    </div>
  )
}
