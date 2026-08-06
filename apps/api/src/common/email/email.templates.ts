interface EmailContent {
  subject: string
  html: string
}

function wrapper(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h1 style="font-size: 20px; color: #111827; margin-bottom: 16px;">${title}</h1>
      <div style="font-size: 14px; color: #374151; line-height: 1.6;">${bodyHtml}</div>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 32px;">MediCore Hospital Management System</p>
    </div>
  `
}

export function verifyEmailTemplate(firstName: string, verifyUrl: string): EmailContent {
  return {
    subject: 'Verify your MediCore email address',
    html: wrapper(
      'Verify your email',
      `<p>Hi ${firstName},</p>
       <p>Please confirm your email address to activate your MediCore account.</p>
       <p><a href="${verifyUrl}" style="color:#2563eb;">Verify email address</a></p>
       <p>This link expires in 24 hours.</p>`,
    ),
  }
}

export function passwordResetTemplate(firstName: string, resetUrl: string): EmailContent {
  return {
    subject: 'Reset your MediCore password',
    html: wrapper(
      'Reset your password',
      `<p>Hi ${firstName},</p>
       <p>We received a request to reset your password. This link expires in 1 hour.</p>
       <p><a href="${resetUrl}" style="color:#2563eb;">Reset password</a></p>
       <p>If you didn't request this, you can safely ignore this email.</p>`,
    ),
  }
}

export function roleGrantedTemplate(firstName: string, roleName: string, loginUrl: string): EmailContent {
  return {
    subject: `You've been granted ${roleName} access on MediCore`,
    html: wrapper(
      'New role granted',
      `<p>Hi ${firstName},</p>
       <p>Your existing MediCore account has been granted the <strong>${roleName}</strong> role.</p>
       <p><a href="${loginUrl}" style="color:#2563eb;">Sign in</a> to access it - your existing password still works.</p>`,
    ),
  }
}

export function appointmentConfirmedTemplate(
  patientFirstName: string,
  doctorFullName: string,
  scheduledAt: Date,
  appointmentNumber: string,
): EmailContent {
  const when = scheduledAt.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  })
  return {
    subject: `Appointment confirmed - ${appointmentNumber}`,
    html: wrapper(
      'Appointment confirmed',
      `<p>Hi ${patientFirstName},</p>
       <p>Your appointment with <strong>Dr. ${doctorFullName}</strong> is confirmed for:</p>
       <p style="font-size:16px;font-weight:600;">${when}</p>
       <p>Appointment reference: <strong>${appointmentNumber}</strong></p>
       <p>Please arrive 10 minutes early. Contact the hospital if you need to reschedule.</p>`,
    ),
  }
}

export function accountCreatedTemplate(
  firstName: string,
  email: string,
  temporaryPassword: string,
  loginUrl: string,
): EmailContent {
  return {
    subject: 'Your MediCore account has been created',
    html: wrapper(
      'Welcome to MediCore',
      `<p>Hi ${firstName},</p>
       <p>An account has been created for you.</p>
       <p><strong>Email:</strong> ${email}<br/><strong>Temporary password:</strong> ${temporaryPassword}</p>
       <p><a href="${loginUrl}" style="color:#2563eb;">Sign in</a> and change your password.</p>`,
    ),
  }
}
