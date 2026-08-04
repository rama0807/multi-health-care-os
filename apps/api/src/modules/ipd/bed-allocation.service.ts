import {
  AllocateBedDto,
  BedAllocation,
  BedAllocationAction,
  BedTransfer,
  BedTransferWithDetails,
  ReserveBedDto,
  TransferBedDto,
  VacateBedDto,
} from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Admission as PrismaAdmission, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { BedsService } from './beds.service'

/**
 * Allocate/reserve/vacate/transfer workflow against a bed already tied to an
 * admission — separate from `BedsService`'s CRUD of the bed record itself
 * (ADR-0018, RBAC resource `ipd.transfer`). A vacated/transferred-from bed
 * lands in `CLEANING`, not directly back in `AVAILABLE` — a real ward
 * workflow, and `BedsService.update` already lets staff move it on to
 * `AVAILABLE` once actually cleaned.
 */
@Injectable()
export class BedAllocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bedsService: BedsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async allocate(
    organizationId: string,
    admissionId: string,
    dto: AllocateBedDto,
    actorUserId?: string,
  ): Promise<BedAllocation> {
    const admission = await this.requireActiveAdmission(organizationId, admissionId)
    const bed = await this.bedsService.requireBed(organizationId, dto.bedId)

    if (admission.bedId && admission.bedId !== bed.id) {
      throw new ConflictException('This admission already holds a bed — use transfer to move it')
    }
    if (bed.status !== 'AVAILABLE' && bed.status !== 'RESERVED') {
      throw new ConflictException(`Bed is currently ${bed.status.toLowerCase()} and cannot be allocated`)
    }
    if (bed.status === 'RESERVED' && admission.bedId !== bed.id) {
      throw new ConflictException('This bed is reserved for a different admission')
    }

    const [, , allocation] = await this.prisma.$transaction([
      this.prisma.bed.update({ where: { id: bed.id }, data: { status: 'OCCUPIED' } }),
      this.prisma.admission.update({
        where: { id: admissionId },
        data: { bedId: bed.id, roomId: bed.roomId, wardId: bed.wardId },
      }),
      this.prisma.bedAllocation.create({
        data: {
          admissionId,
          bedId: bed.id,
          organizationId,
          action: 'ALLOCATED',
          performedByUserId: actorUserId,
          reason: dto.reason,
        },
      }),
    ])

    this.eventEmitter.emit('ipd.bed_allocated', {
      admissionId,
      bedId: bed.id,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.toAllocationResponse(allocation)
  }

  async reserve(
    organizationId: string,
    admissionId: string,
    dto: ReserveBedDto,
    actorUserId?: string,
  ): Promise<BedAllocation> {
    const admission = await this.requireActiveAdmission(organizationId, admissionId)
    const bed = await this.bedsService.requireBed(organizationId, dto.bedId)

    if (admission.bedId) {
      throw new ConflictException('This admission already holds or has reserved a bed')
    }
    if (bed.status !== 'AVAILABLE') {
      throw new ConflictException(`Bed is currently ${bed.status.toLowerCase()} and cannot be reserved`)
    }

    const [, , allocation] = await this.prisma.$transaction([
      this.prisma.bed.update({ where: { id: bed.id }, data: { status: 'RESERVED' } }),
      this.prisma.admission.update({
        where: { id: admissionId },
        data: { bedId: bed.id, roomId: bed.roomId, wardId: bed.wardId },
      }),
      this.prisma.bedAllocation.create({
        data: {
          admissionId,
          bedId: bed.id,
          organizationId,
          action: 'RESERVED',
          performedByUserId: actorUserId,
          reason: dto.reason,
        },
      }),
    ])

    this.eventEmitter.emit('ipd.bed_reserved', {
      admissionId,
      bedId: bed.id,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.toAllocationResponse(allocation)
  }

  async cancelReservation(organizationId: string, admissionId: string, actorUserId?: string): Promise<BedAllocation> {
    const admission = await this.requireActiveAdmission(organizationId, admissionId)
    if (!admission.bedId) throw new BadRequestException('This admission has no reserved bed')
    const bed = await this.bedsService.requireBed(organizationId, admission.bedId)
    if (bed.status !== 'RESERVED') throw new ConflictException('This bed is not currently reserved')

    const [, , allocation] = await this.prisma.$transaction([
      this.prisma.bed.update({ where: { id: bed.id }, data: { status: 'AVAILABLE' } }),
      this.prisma.admission.update({ where: { id: admissionId }, data: { bedId: null, roomId: null } }),
      this.prisma.bedAllocation.create({
        data: {
          admissionId,
          bedId: bed.id,
          organizationId,
          action: 'RESERVATION_CANCELLED',
          performedByUserId: actorUserId,
        },
      }),
    ])

    this.eventEmitter.emit('ipd.bed_reservation_cancelled', {
      admissionId,
      bedId: bed.id,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.toAllocationResponse(allocation)
  }

  async vacate(
    organizationId: string,
    admissionId: string,
    dto: VacateBedDto,
    actorUserId?: string,
  ): Promise<BedAllocation> {
    const admission = await this.requireActiveAdmission(organizationId, admissionId)
    if (!admission.bedId) throw new BadRequestException('This admission has no allocated bed')
    const bed = await this.bedsService.requireBed(organizationId, admission.bedId)
    if (bed.status !== 'OCCUPIED') throw new ConflictException('This bed is not currently occupied')

    const [, , allocation] = await this.prisma.$transaction([
      this.prisma.bed.update({ where: { id: bed.id }, data: { status: 'CLEANING' } }),
      this.prisma.admission.update({ where: { id: admissionId }, data: { bedId: null } }),
      this.prisma.bedAllocation.create({
        data: {
          admissionId,
          bedId: bed.id,
          organizationId,
          action: 'VACATED',
          performedByUserId: actorUserId,
          reason: dto.reason,
        },
      }),
    ])

    this.eventEmitter.emit('ipd.bed_vacated', {
      admissionId,
      bedId: bed.id,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.toAllocationResponse(allocation)
  }

  async transfer(
    organizationId: string,
    admissionId: string,
    dto: TransferBedDto,
    actorUserId?: string,
  ): Promise<BedTransfer> {
    const admission = await this.requireActiveAdmission(organizationId, admissionId)
    const toBed = await this.bedsService.requireBed(organizationId, dto.toBedId)

    if (toBed.status !== 'AVAILABLE') {
      throw new ConflictException(`Target bed is currently ${toBed.status.toLowerCase()} and cannot be transferred to`)
    }
    if (admission.bedId === toBed.id) {
      throw new ConflictException('Admission is already in this bed')
    }

    const fromBed = admission.bedId ? await this.bedsService.requireBed(organizationId, admission.bedId) : null

    const operations: Prisma.PrismaPromise<unknown>[] = []
    if (fromBed) {
      operations.push(this.prisma.bed.update({ where: { id: fromBed.id }, data: { status: 'CLEANING' } }))
    }
    operations.push(this.prisma.bed.update({ where: { id: toBed.id }, data: { status: 'OCCUPIED' } }))
    operations.push(
      this.prisma.admission.update({
        where: { id: admissionId },
        data: { bedId: toBed.id, roomId: toBed.roomId, wardId: toBed.wardId },
      }),
    )
    operations.push(
      this.prisma.bedTransfer.create({
        data: {
          admissionId,
          organizationId,
          fromBedId: fromBed?.id,
          toBedId: toBed.id,
          fromRoomId: fromBed?.roomId,
          toRoomId: toBed.roomId,
          fromWardId: fromBed?.wardId ?? admission.wardId,
          toWardId: toBed.wardId,
          reason: dto.reason,
          transferredByUserId: actorUserId,
        },
      }),
    )

    const results = await this.prisma.$transaction(operations)
    const transfer = results[results.length - 1] as Awaited<ReturnType<typeof this.prisma.bedTransfer.create>>

    this.eventEmitter.emit('ipd.bed_transferred', {
      admissionId,
      fromBedId: fromBed?.id,
      toBedId: toBed.id,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.toTransferResponse(transfer)
  }

  async listAllocationHistory(organizationId: string, admissionId: string): Promise<BedAllocation[]> {
    await this.requireActiveAdmission(organizationId, admissionId, false)
    const allocations = await this.prisma.bedAllocation.findMany({
      where: { admissionId, organizationId },
      orderBy: { occurredAt: 'desc' },
    })
    return allocations.map((a) => this.toAllocationResponse(a))
  }

  async listTransferHistory(organizationId: string, admissionId: string): Promise<BedTransferWithDetails[]> {
    await this.requireActiveAdmission(organizationId, admissionId, false)
    const transfers = await this.prisma.bedTransfer.findMany({
      where: { admissionId, organizationId },
      include: {
        fromBed: { select: { id: true, bedNumber: true } },
        toBed: { select: { id: true, bedNumber: true } },
        fromWard: { select: { id: true, name: true } },
        toWard: { select: { id: true, name: true } },
      },
      orderBy: { transferredAt: 'desc' },
    })
    return transfers.map((t) => ({ ...this.toTransferResponse(t), fromBed: t.fromBed, toBed: t.toBed, fromWard: t.fromWard, toWard: t.toWard }))
  }

  private async requireActiveAdmission(
    organizationId: string,
    admissionId: string,
    requireAdmitted = true,
  ): Promise<PrismaAdmission> {
    const admission = await this.prisma.admission.findFirst({ where: { id: admissionId, organizationId } })
    if (!admission) throw new NotFoundException('Admission not found')
    if (requireAdmitted && admission.status !== 'ADMITTED') {
      throw new ConflictException('This admission is no longer active')
    }
    return admission
  }

  private toAllocationResponse(allocation: {
    id: string
    admissionId: string
    bedId: string
    organizationId: string
    action: string
    performedByUserId: string | null
    reason: string | null
    occurredAt: Date
  }): BedAllocation {
    return {
      id: allocation.id,
      admissionId: allocation.admissionId,
      bedId: allocation.bedId,
      organizationId: allocation.organizationId,
      action: allocation.action as unknown as BedAllocationAction,
      performedByUserId: allocation.performedByUserId,
      reason: allocation.reason,
      occurredAt: allocation.occurredAt,
    }
  }

  private toTransferResponse(transfer: {
    id: string
    admissionId: string
    organizationId: string
    fromBedId: string | null
    toBedId: string
    fromRoomId: string | null
    toRoomId: string | null
    fromWardId: string | null
    toWardId: string
    reason: string | null
    transferredByUserId: string | null
    transferredAt: Date
  }): BedTransfer {
    return {
      id: transfer.id,
      admissionId: transfer.admissionId,
      organizationId: transfer.organizationId,
      fromBedId: transfer.fromBedId,
      toBedId: transfer.toBedId,
      fromRoomId: transfer.fromRoomId,
      toRoomId: transfer.toRoomId,
      fromWardId: transfer.fromWardId,
      toWardId: transfer.toWardId,
      reason: transfer.reason,
      transferredByUserId: transfer.transferredByUserId,
      transferredAt: transfer.transferredAt,
    }
  }
}
