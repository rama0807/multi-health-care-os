import { ReportExportFormat } from '@medicore/types'
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { FastifyReply } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateSavedReportDto, UpdateSavedReportDto } from './dto/saved-report.dto'
import { ReportExportService } from './report-export.service'
import { ReportRegistryService } from './report-registry.service'
import { toFilter } from './reports.controller'
import { SavedReportsService } from './saved-reports.service'

const EXPORT_FORMATS: readonly string[] = ['csv', 'xlsx', 'pdf']

/**
 * The report builder (Milestone 17 Checkpoint 17.3).
 *
 * `reports.read` runs and views; `reports.export` is required to download a
 * file. They are separate because an export leaves the system - it can be
 * mailed on - and it is the action worth being able to withhold. Both actions
 * already existed in the seed permission catalog before this milestone.
 */
@ApiTags('reports-builder')
@ApiBearerAuth()
@Controller({ path: 'reports/builder', version: '1' })
export class ReportBuilderController {
  constructor(
    private readonly registry: ReportRegistryService,
    private readonly exportService: ReportExportService,
    private readonly savedReports: SavedReportsService,
  ) {}

  @Get('definitions')
  @RequirePermissions('reports.read')
  listDefinitions() {
    return this.registry.listDefinitions()
  }

  // ─── Saved reports ────────────────────────────────────────────────────────
  //
  // Declared before `run/:key` so the literal segment is matched first - a
  // route named "saved" must never be resolved as a report key.

  @Get('saved')
  @RequirePermissions('reports.read')
  listSaved(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('reportKey') reportKey?: string,
    @Query('search') search?: string,
  ) {
    return this.savedReports.list(orgId, userId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      reportKey,
      search,
    })
  }

  @Post('saved')
  @RequirePermissions('reports.read')
  createSaved(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSavedReportDto,
  ) {
    return this.savedReports.create(orgId, userId, dto)
  }

  @Get('saved/:id')
  @RequirePermissions('reports.read')
  getSaved(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.savedReports.getById(orgId, userId, id)
  }

  @Patch('saved/:id')
  @RequirePermissions('reports.read')
  updateSaved(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSavedReportDto,
  ) {
    return this.savedReports.update(orgId, userId, id, dto)
  }

  @Delete('saved/:id')
  @RequirePermissions('reports.read')
  removeSaved(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.savedReports.remove(orgId, userId, id)
  }

  /** Runs a saved report with its stored filters, stamping `lastRunAt`. */
  @Get('saved/:id/run')
  @RequirePermissions('reports.read')
  async runSaved(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const saved = await this.savedReports.getById(orgId, userId, id)
    const result = await this.registry.run(orgId, saved.reportKey, saved.filters)
    await this.savedReports.markRun(id)
    return result
  }

  // ─── Ad-hoc run & export ──────────────────────────────────────────────────

  @Get('run/:key')
  @RequirePermissions('reports.read')
  run(
    @CurrentUser('orgId') orgId: string,
    @Param('key') key: string,
    @Query() query: Record<string, string>,
  ) {
    return this.registry.run(orgId, key, toFilter(query))
  }

  @Get('export/:key')
  @RequirePermissions('reports.export')
  async export(
    @CurrentUser('orgId') orgId: string,
    @Param('key') key: string,
    @Query() query: Record<string, string>,
    @Res() reply: FastifyReply,
  ) {
    const format = (query.format ?? 'csv').toLowerCase()
    if (!EXPORT_FORMATS.includes(format)) {
      throw new BadRequestException(`"format" must be one of: ${EXPORT_FORMATS.join(', ')}`)
    }

    const result = await this.registry.run(orgId, key, toFilter(query))
    const file = await this.exportService.export(orgId, result, format as ReportExportFormat)

    void reply
      .header('Content-Type', file.contentType)
      .header('Content-Disposition', `attachment; filename="${file.fileName}"`)
      .send(file.buffer)
  }
}
