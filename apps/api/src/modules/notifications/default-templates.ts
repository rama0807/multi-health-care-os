import { NotificationCategory, NotificationPriority, NotificationType } from '@medicore/types'

/**
 * The bundled default template for every notification type (Checkpoint 18.1).
 *
 * These ship with the application rather than being seeded into the database,
 * for the same reason `common/ai/` bundles its prompt defaults: a new event
 * type must work on a deployment nobody has configured, and a template row
 * that has to exist before a notification can be sent is a silent outage
 * waiting to happen. An organization overrides any of these with an
 * append-only `NotificationTemplate` row (see `NotificationTemplateService`).
 *
 * Templates are channel-agnostic here. Email uses `subject` as its subject and
 * `body` as the message; push uses `subject` as the notification title; the
 * in-app centre shows both. An organization that wants genuinely different
 * wording per channel creates per-channel override rows.
 *
 * `deepLink` is where a click lands, and is the single place those routes are
 * defined — the push service worker, the in-app centre and the email button
 * all read the rendered value rather than each building a URL.
 */
export interface DefaultNotificationTemplate {
  key: NotificationType
  name: string
  category: NotificationCategory
  priority: NotificationPriority
  /** Lucide icon name; the notification centre falls back to a bell. */
  icon: string
  subject: string
  body: string
  deepLink: string | null
  /** Declared for the admin editor's help text; rendering does not depend on it. */
  variables: string[]
}

const T = (t: DefaultNotificationTemplate) => t

export const DEFAULT_NOTIFICATION_TEMPLATES: Record<NotificationType, DefaultNotificationTemplate> = {
  // ─── Appointments ─────────────────────────────────────────────────────────
  [NotificationType.APPOINTMENT_BOOKED]: T({
    key: NotificationType.APPOINTMENT_BOOKED,
    name: 'Appointment booked',
    category: NotificationCategory.APPOINTMENT,
    priority: NotificationPriority.NORMAL,
    icon: 'CalendarPlus',
    subject: 'Appointment booked for {{patientName}}',
    body: '{{patientName}} is booked with {{doctorName}} on {{appointmentDate}} at {{appointmentTime}}.',
    deepLink: '/dashboard/appointments/{{appointmentId}}',
    variables: ['patientName', 'doctorName', 'appointmentDate', 'appointmentTime', 'appointmentId'],
  }),
  [NotificationType.APPOINTMENT_CONFIRMED]: T({
    key: NotificationType.APPOINTMENT_CONFIRMED,
    name: 'Appointment confirmed',
    category: NotificationCategory.APPOINTMENT,
    priority: NotificationPriority.NORMAL,
    icon: 'CalendarCheck',
    subject: 'Appointment confirmed for {{patientName}}',
    body: "{{patientName}}'s appointment with {{doctorName}} on {{appointmentDate}} at {{appointmentTime}} is confirmed.",
    deepLink: '/dashboard/appointments/{{appointmentId}}',
    variables: ['patientName', 'doctorName', 'appointmentDate', 'appointmentTime', 'appointmentId'],
  }),
  [NotificationType.APPOINTMENT_CANCELLED]: T({
    key: NotificationType.APPOINTMENT_CANCELLED,
    name: 'Appointment cancelled',
    category: NotificationCategory.APPOINTMENT,
    priority: NotificationPriority.HIGH,
    icon: 'CalendarX',
    subject: 'Appointment cancelled for {{patientName}}',
    body: "{{patientName}}'s appointment with {{doctorName}} on {{appointmentDate}} at {{appointmentTime}} has been cancelled.",
    deepLink: '/dashboard/appointments/{{appointmentId}}',
    variables: ['patientName', 'doctorName', 'appointmentDate', 'appointmentTime', 'appointmentId'],
  }),
  [NotificationType.APPOINTMENT_REMINDER]: T({
    key: NotificationType.APPOINTMENT_REMINDER,
    name: 'Appointment reminder',
    category: NotificationCategory.APPOINTMENT,
    priority: NotificationPriority.HIGH,
    icon: 'AlarmClock',
    subject: 'Reminder: appointment on {{appointmentDate}}',
    body: '{{patientName}} has an appointment with {{doctorName}} on {{appointmentDate}} at {{appointmentTime}}.',
    deepLink: '/dashboard/appointments/{{appointmentId}}',
    variables: ['patientName', 'doctorName', 'appointmentDate', 'appointmentTime', 'appointmentId'],
  }),

  // ─── EMR ──────────────────────────────────────────────────────────────────
  [NotificationType.ENCOUNTER_CREATED]: T({
    key: NotificationType.ENCOUNTER_CREATED,
    name: 'Encounter created',
    category: NotificationCategory.CLINICAL,
    priority: NotificationPriority.LOW,
    icon: 'ClipboardPlus',
    subject: 'New encounter for {{patientName}}',
    body: 'A {{encounterType}} encounter was opened for {{patientName}}.',
    deepLink: '/dashboard/medical-records/{{encounterId}}',
    variables: ['patientName', 'encounterType', 'encounterId'],
  }),
  [NotificationType.ENCOUNTER_UPDATED]: T({
    key: NotificationType.ENCOUNTER_UPDATED,
    name: 'Encounter updated',
    category: NotificationCategory.CLINICAL,
    priority: NotificationPriority.LOW,
    icon: 'ClipboardList',
    subject: 'Encounter updated for {{patientName}}',
    body: "{{patientName}}'s encounter is now {{encounterStatus}}.",
    deepLink: '/dashboard/medical-records/{{encounterId}}',
    variables: ['patientName', 'encounterStatus', 'encounterId'],
  }),

  // ─── Laboratory ───────────────────────────────────────────────────────────
  [NotificationType.LAB_SAMPLE_COLLECTED]: T({
    key: NotificationType.LAB_SAMPLE_COLLECTED,
    name: 'Lab sample collected',
    category: NotificationCategory.LABORATORY,
    priority: NotificationPriority.LOW,
    icon: 'TestTube',
    subject: 'Sample collected — {{testName}}',
    body: 'The sample for {{testName}} ({{patientName}}) has been collected.',
    deepLink: '/dashboard/laboratory/orders/{{labTestId}}',
    variables: ['testName', 'patientName', 'labTestId'],
  }),
  [NotificationType.LAB_RESULT_READY]: T({
    key: NotificationType.LAB_RESULT_READY,
    name: 'Lab report ready',
    category: NotificationCategory.LABORATORY,
    priority: NotificationPriority.HIGH,
    icon: 'FlaskConical',
    subject: 'Lab report ready — {{testName}}',
    body: 'The {{testName}} report for {{patientName}} is ready.{{abnormalNote}}',
    deepLink: '/dashboard/laboratory/orders/{{labTestId}}',
    variables: ['testName', 'patientName', 'labTestId', 'abnormalNote'],
  }),

  // ─── Radiology ────────────────────────────────────────────────────────────
  [NotificationType.RADIOLOGY_REPORT_RELEASED]: T({
    key: NotificationType.RADIOLOGY_REPORT_RELEASED,
    name: 'Radiology report released',
    category: NotificationCategory.RADIOLOGY,
    priority: NotificationPriority.HIGH,
    icon: 'Scan',
    subject: 'Radiology report released — {{studyName}}',
    body: 'The {{studyName}} report for {{patientName}} has been released.',
    deepLink: '/dashboard/radiology/{{radiologyOrderId}}',
    variables: ['studyName', 'patientName', 'radiologyOrderId'],
  }),

  // ─── Billing ──────────────────────────────────────────────────────────────
  [NotificationType.INVOICE_GENERATED]: T({
    key: NotificationType.INVOICE_GENERATED,
    name: 'Invoice created',
    category: NotificationCategory.BILLING,
    priority: NotificationPriority.NORMAL,
    icon: 'ReceiptText',
    subject: 'Invoice {{invoiceNumber}} created',
    body: 'Invoice {{invoiceNumber}} for {{patientName}} totalling {{amount}} has been created.',
    deepLink: '/dashboard/billing/invoices/{{invoiceId}}',
    variables: ['invoiceNumber', 'patientName', 'amount', 'invoiceId'],
  }),
  [NotificationType.PAYMENT_RECEIVED]: T({
    key: NotificationType.PAYMENT_RECEIVED,
    name: 'Payment received',
    category: NotificationCategory.BILLING,
    priority: NotificationPriority.NORMAL,
    icon: 'BadgeIndianRupee',
    subject: 'Payment received for invoice {{invoiceNumber}}',
    body: '{{amount}} was received against invoice {{invoiceNumber}} ({{paymentMode}}).',
    deepLink: '/dashboard/billing/invoices/{{invoiceId}}',
    variables: ['invoiceNumber', 'amount', 'paymentMode', 'invoiceId'],
  }),

  // ─── Insurance ────────────────────────────────────────────────────────────
  [NotificationType.PREAUTH_APPROVED]: T({
    key: NotificationType.PREAUTH_APPROVED,
    name: 'Pre-authorization approved',
    category: NotificationCategory.INSURANCE,
    priority: NotificationPriority.HIGH,
    icon: 'ShieldCheck',
    subject: 'Pre-authorization approved for {{patientName}}',
    body: 'Pre-authorization {{preAuthNumber}} for {{patientName}} was {{decision}} for {{amount}}.',
    deepLink: '/dashboard/insurance/preauth',
    variables: ['patientName', 'preAuthNumber', 'decision', 'amount'],
  }),
  [NotificationType.CLAIM_APPROVED]: T({
    key: NotificationType.CLAIM_APPROVED,
    name: 'Claim approved',
    category: NotificationCategory.INSURANCE,
    priority: NotificationPriority.HIGH,
    icon: 'ShieldCheck',
    subject: 'Claim {{claimNumber}} approved',
    body: 'Claim {{claimNumber}} for {{patientName}} was {{decision}} for {{amount}}.',
    deepLink: '/dashboard/insurance/{{claimId}}',
    variables: ['claimNumber', 'patientName', 'decision', 'amount', 'claimId'],
  }),
  [NotificationType.CLAIM_REJECTED]: T({
    key: NotificationType.CLAIM_REJECTED,
    name: 'Claim rejected',
    category: NotificationCategory.INSURANCE,
    priority: NotificationPriority.HIGH,
    icon: 'ShieldX',
    subject: 'Claim {{claimNumber}} rejected',
    body: 'Claim {{claimNumber}} for {{patientName}} was rejected. {{reason}}',
    deepLink: '/dashboard/insurance/{{claimId}}',
    variables: ['claimNumber', 'patientName', 'reason', 'claimId'],
  }),

  // ─── Pharmacy ─────────────────────────────────────────────────────────────
  [NotificationType.PRESCRIPTION_READY]: T({
    key: NotificationType.PRESCRIPTION_READY,
    name: 'Prescription ready',
    category: NotificationCategory.PHARMACY,
    priority: NotificationPriority.NORMAL,
    icon: 'Pill',
    subject: 'Prescription ready for {{patientName}}',
    body: 'Dispense order {{dispenseNumber}} for {{patientName}} is ready for collection.',
    deepLink: '/dashboard/pharmacy/{{dispenseOrderId}}',
    variables: ['patientName', 'dispenseNumber', 'dispenseOrderId'],
  }),
  [NotificationType.MEDICINE_DISPENSED]: T({
    key: NotificationType.MEDICINE_DISPENSED,
    name: 'Medicine dispensed',
    category: NotificationCategory.PHARMACY,
    priority: NotificationPriority.LOW,
    icon: 'PillBottle',
    subject: 'Medicine dispensed for {{patientName}}',
    body: 'Dispense order {{dispenseNumber}} for {{patientName}} has been dispensed.',
    deepLink: '/dashboard/pharmacy/{{dispenseOrderId}}',
    variables: ['patientName', 'dispenseNumber', 'dispenseOrderId'],
  }),

  // ─── Inventory ────────────────────────────────────────────────────────────
  [NotificationType.INVENTORY_LOW_STOCK]: T({
    key: NotificationType.INVENTORY_LOW_STOCK,
    name: 'Low stock',
    category: NotificationCategory.INVENTORY,
    priority: NotificationPriority.HIGH,
    icon: 'PackageMinus',
    subject: 'Low stock: {{itemName}}',
    body: '{{itemName}} at {{storeName}} is down to {{quantity}} {{unit}} (minimum {{minimumStock}}).',
    deepLink: '/dashboard/inventory/stock',
    variables: ['itemName', 'storeName', 'quantity', 'unit', 'minimumStock'],
  }),
  [NotificationType.INVENTORY_REORDER_LEVEL]: T({
    key: NotificationType.INVENTORY_REORDER_LEVEL,
    name: 'Reorder level reached',
    category: NotificationCategory.INVENTORY,
    priority: NotificationPriority.NORMAL,
    icon: 'PackagePlus',
    subject: 'Reorder level reached: {{itemName}}',
    body: '{{itemName}} at {{storeName}} has reached its reorder level ({{quantity}} {{unit}} remaining).',
    deepLink: '/dashboard/inventory/stock',
    variables: ['itemName', 'storeName', 'quantity', 'unit'],
  }),

  // ─── IPD ──────────────────────────────────────────────────────────────────
  [NotificationType.IPD_ADMITTED]: T({
    key: NotificationType.IPD_ADMITTED,
    name: 'Patient admitted',
    category: NotificationCategory.IPD,
    priority: NotificationPriority.HIGH,
    icon: 'BedDouble',
    subject: '{{patientName}} admitted',
    body: '{{patientName}} was admitted as {{admissionNumber}} under {{doctorName}}.',
    deepLink: '/dashboard/ipd/{{admissionId}}',
    variables: ['patientName', 'admissionNumber', 'doctorName', 'admissionId'],
  }),
  [NotificationType.IPD_TRANSFERRED]: T({
    key: NotificationType.IPD_TRANSFERRED,
    name: 'Patient transferred',
    category: NotificationCategory.IPD,
    priority: NotificationPriority.NORMAL,
    icon: 'ArrowLeftRight',
    subject: '{{patientName}} transferred',
    body: '{{patientName}} ({{admissionNumber}}) moved to bed {{toBed}}.',
    deepLink: '/dashboard/ipd/{{admissionId}}',
    variables: ['patientName', 'admissionNumber', 'toBed', 'admissionId'],
  }),
  [NotificationType.IPD_DISCHARGED]: T({
    key: NotificationType.IPD_DISCHARGED,
    name: 'Patient discharged',
    category: NotificationCategory.IPD,
    priority: NotificationPriority.NORMAL,
    icon: 'DoorOpen',
    subject: '{{patientName}} discharged',
    body: '{{patientName}} ({{admissionNumber}}) has been discharged.',
    deepLink: '/dashboard/ipd/{{admissionId}}',
    variables: ['patientName', 'admissionNumber', 'admissionId'],
  }),
  [NotificationType.DISCHARGE_SUMMARY]: T({
    key: NotificationType.DISCHARGE_SUMMARY,
    name: 'Discharge summary ready',
    category: NotificationCategory.IPD,
    priority: NotificationPriority.NORMAL,
    icon: 'FileText',
    subject: 'Discharge summary ready for {{patientName}}',
    body: 'The discharge summary for {{patientName}} ({{admissionNumber}}) is ready.',
    deepLink: '/dashboard/ipd/{{admissionId}}',
    variables: ['patientName', 'admissionNumber', 'admissionId'],
  }),

  // ─── Staff ────────────────────────────────────────────────────────────────
  [NotificationType.STAFF_LEAVE_APPROVED]: T({
    key: NotificationType.STAFF_LEAVE_APPROVED,
    name: 'Leave approved',
    category: NotificationCategory.STAFF,
    priority: NotificationPriority.NORMAL,
    icon: 'CalendarCheck2',
    subject: 'Your leave request was approved',
    body: 'Your {{leaveType}} leave from {{fromDate}} to {{toDate}} has been approved.',
    deepLink: '/dashboard/staff/leave',
    variables: ['leaveType', 'fromDate', 'toDate'],
  }),
  [NotificationType.STAFF_SHIFT_ASSIGNED]: T({
    key: NotificationType.STAFF_SHIFT_ASSIGNED,
    name: 'Shift assigned',
    category: NotificationCategory.STAFF,
    priority: NotificationPriority.NORMAL,
    icon: 'CalendarClock',
    subject: 'Shift assigned for {{shiftDate}}',
    body: 'You are rostered on the {{shiftName}} shift ({{shiftStart}}–{{shiftEnd}}) on {{shiftDate}}.',
    deepLink: '/dashboard/staff/roster',
    variables: ['shiftName', 'shiftStart', 'shiftEnd', 'shiftDate'],
  }),

  // ─── Reports ──────────────────────────────────────────────────────────────
  [NotificationType.SCHEDULED_REPORT_READY]: T({
    key: NotificationType.SCHEDULED_REPORT_READY,
    name: 'Scheduled report ready',
    category: NotificationCategory.REPORTS,
    priority: NotificationPriority.LOW,
    icon: 'FileSpreadsheet',
    subject: 'Scheduled report ready: {{reportName}}',
    body: '{{reportName}} ran for {{periodFrom}} to {{periodTo}} and returned {{rowCount}} rows.',
    deepLink: '/dashboard/reports/builder?savedReportId={{savedReportId}}',
    variables: ['reportName', 'periodFrom', 'periodTo', 'rowCount', 'savedReportId'],
  }),

  // ─── Platform ─────────────────────────────────────────────────────────────
  [NotificationType.ORGANIZATION_ONBOARDED]: T({
    key: NotificationType.ORGANIZATION_ONBOARDED,
    name: 'Organization onboarded',
    category: NotificationCategory.PLATFORM,
    priority: NotificationPriority.NORMAL,
    icon: 'Building2',
    subject: 'New organization: {{organizationName}}',
    body: '{{organizationName}} ({{organizationSlug}}) was onboarded onto the platform.',
    deepLink: '/platform/organizations',
    variables: ['organizationName', 'organizationSlug'],
  }),
  [NotificationType.HOSPITAL_CREATED]: T({
    key: NotificationType.HOSPITAL_CREATED,
    name: 'Hospital created',
    category: NotificationCategory.PLATFORM,
    priority: NotificationPriority.LOW,
    icon: 'Hospital',
    subject: 'New hospital: {{hospitalName}}',
    body: '{{hospitalName}} ({{hospitalCode}}) was added to {{organizationName}}.',
    deepLink: '/dashboard/organization',
    variables: ['hospitalName', 'hospitalCode', 'organizationName'],
  }),

  // ─── Custom ───────────────────────────────────────────────────────────────
  [NotificationType.CUSTOM]: T({
    key: NotificationType.CUSTOM,
    name: 'Custom message',
    category: NotificationCategory.SYSTEM,
    priority: NotificationPriority.NORMAL,
    icon: 'Bell',
    subject: '{{title}}',
    body: '{{body}}',
    deepLink: null,
    variables: ['title', 'body'],
  }),
}
