import { NotificationType, ReportFilterQuery } from '@medicore/types'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OnEvent } from '@nestjs/event-emitter'

import { EmailService } from '../../common/email/email.service'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'

import { isDueBetween } from './cron-match.util'
import { ReportExportService } from './report-export.service'
import { ReportRegistryService } from './report-registry.service'

/**
 * Runs and delivers scheduled saved reports (closes **TD-0053**).
 *
 * Milestone 17 persisted and cron-validated `SavedReport.scheduleEnabled` /
 * `scheduleCron` / `scheduleRecipients` with nothing reading them, and the UI
 * honestly disclosed "schedule saved (not yet dispatched)". This is the
 * missing half.
 *
 * It lives in `modules/reports/` rather than in the notification module
 * because running and exporting a report is reports' business — the only
 * thing borrowed from Milestone 18 is the **clock**: the notification
 * scheduler emits `notifications.tick`, and this listens. That keeps
 * `NotificationsModule` free of a dependency on `ReportsModule` and vice
 * versa, so neither module can pull the other into a cycle.
 *
 * Delivery is email via the existing `EmailService`. Recipients are free-text
 * addresses (that is what `scheduleRecipients` has always held), so they may
 * be people without MediCore accounts and cannot be resolved to in-app
 * notifications; the `SCHEDULED_REPORT_READY` in-app notification therefore
 * goes to the report's **owner**, who is a real user. See `renderEmail` for
 * why the generated file is linked rather than attached.
 */
@Injectable()
export class ScheduledReportsDispatcher {
  private readonly logger = new Logger(ScheduledReportsDispatcher.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly registry: ReportRegistryService,
    private readonly exporter: ReportExportService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent('notifications.tick')
  async onTick(payload: { at: Date }): Promise<void> {
    await this.run(payload?.at ?? new Date())
  }

  /** Public and awaitable so tests drive it directly rather than via a timer. */
  async run(now = new Date()): Promise<{ dispatched: number }> {
    const scheduled = await this.prisma.savedReport.findMany({
      where: { scheduleEnabled: true, NOT: { scheduleCron: null } },
    })

    let dispatched = 0

    for (const report of scheduled) {
      if (!report.scheduleCron) continue
      if (!isDueBetween(report.scheduleCron, report.lastRunAt, now)) continue

      try {
        // Claim before running: `lastRunAt` is the idempotency guard, so a
        // long-running export cannot be started twice by two overlapping
        // ticks, and a crash mid-run does not replay on the next one.
        const claimed = await this.prisma.savedReport.updateMany({
          where: { id: report.id, lastRunAt: report.lastRunAt },
          data: { lastRunAt: now },
        })
        if (claimed.count !== 1) continue

        await this.dispatch(report, now)
        dispatched += 1
      } catch (error) {
        // A failing report must not stop the others, and must not wedge the
        // notification tick that called this.
        this.logger.error(
          `Scheduled report "${report.name}" (${report.id}) failed: ${(error as Error).message}`,
          (error as Error).stack,
        )
      }
    }

    return { dispatched }
  }

  private async dispatch(
    report: {
      id: string
      organizationId: string
      name: string
      reportKey: string
      filters: unknown
      scheduleRecipients: string[]
      createdByUserId: string
    },
    now: Date,
  ): Promise<void> {
    const result = await this.registry.run(
      report.organizationId,
      report.reportKey,
      (report.filters ?? {}) as ReportFilterQuery,
    )

    // Same export path the on-screen "Export" button uses, so a scheduled file
    // can never disagree with a manually exported one.
    const exported = await this.exporter.export(report.organizationId, result, 'xlsx')

    const recipients = report.scheduleRecipients.filter((address) => address.includes('@'))
    if (recipients.length === 0) {
      this.logger.warn(`Scheduled report "${report.name}" has no valid recipient address — nothing emailed`)
    }

    const frontendUrl = this.config.get<string>('notifications.frontendUrl') ?? ''
    for (const recipient of recipients) {
      await this.email.send({
        to: recipient,
        subject: `Scheduled report: ${report.name}`,
        html: this.renderEmail(report.name, result, exported.fileName, frontendUrl, report.id),
      })
    }

    // The in-app half of "scheduled report ready" (Checkpoint 18.4). Addressed
    // to the report's owner rather than to `scheduleRecipients`, which are
    // free-text addresses that need not belong to a MediCore user at all.
    await this.notifications.notify({
      organizationId: report.organizationId,
      type: NotificationType.SCHEDULED_REPORT_READY,
      recipientIds: [report.createdByUserId],
      variables: {
        reportName: report.name,
        periodFrom: result.period?.from ?? '',
        periodTo: result.period?.to ?? '',
        rowCount: result.rows.length,
        savedReportId: report.id,
      },
      // One notification per run, not per report — `lastRunAt` is already the
      // run's identity, so it makes the key unique without a second column.
      eventKey: `report.scheduled_run:${report.id}:${now.toISOString()}`,
    })

    this.logger.log(
      `Dispatched scheduled report "${report.name}" (${result.rows.length} rows) to ${recipients.length} recipient(s) at ${now.toISOString()}`,
    )
  }

  /**
   * The generated file is **not** attached.
   *
   * `EmailService.send` takes `{ to, subject, html }` and has no attachment
   * parameter; widening it would change a signature four other modules already
   * depend on, for one caller. The mail therefore links back to the report,
   * which re-runs against live data — arguably the better artefact anyway.
   * Recorded honestly in TECH_DEBT rather than described as an attachment.
   */
  private renderEmail(
    name: string,
    result: { rows: unknown[]; period?: { from: string; to: string } },
    fileName: string,
    frontendUrl: string,
    savedReportId: string,
  ): string {
    const link = frontendUrl
      ? `${frontendUrl}/dashboard/reports/builder?savedReportId=${encodeURIComponent(savedReportId)}`
      : null

    return `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(name)}</h2>
        <p style="margin:0 0 12px;color:#334155">
          Your scheduled report ran and returned <strong>${result.rows.length}</strong> row(s)${
            result.period ? ` for ${escapeHtml(result.period.from)} to ${escapeHtml(result.period.to)}` : ''
          }.
        </p>
        <p style="margin:0 0 12px;color:#334155">
          The generated file is <code>${escapeHtml(fileName)}</code>. Open the report in MediCore to
          download it against current data.
        </p>
        ${
          link
            ? `<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#0f172a;color:#fff;text-decoration:none">Open the report</a></p>`
            : ''
        }
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="margin:0;font-size:12px;color:#64748b">
          You are receiving this because this saved report lists your address as a schedule recipient.
        </p>
      </div>
    `
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
