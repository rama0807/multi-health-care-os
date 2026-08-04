import {
  AssignStoreManagerDto,
  CreateInventoryStoreDto,
  InventoryStore,
  InventoryStoreManager,
  UpdateInventoryStoreDto,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, isActive?: boolean): Promise<InventoryStore[]> {
    const stores = await this.prisma.inventoryStore.findMany({
      where: { organizationId, ...(isActive === undefined ? {} : { isActive }) },
      orderBy: { name: 'asc' },
    })
    return stores as unknown as InventoryStore[]
  }

  async getById(organizationId: string, id: string): Promise<InventoryStore> {
    const store = await this.requireStore(organizationId, id)
    return store as unknown as InventoryStore
  }

  async create(organizationId: string, dto: CreateInventoryStoreDto): Promise<InventoryStore> {
    const store = await this.prisma.inventoryStore
      .create({ data: { organizationId, ...dto } })
      .catch((e) => this.rethrowUniqueCode(e))
    return store as unknown as InventoryStore
  }

  async update(organizationId: string, id: string, dto: UpdateInventoryStoreDto): Promise<InventoryStore> {
    await this.requireStore(organizationId, id)
    const store = await this.prisma.inventoryStore
      .update({ where: { id }, data: dto })
      .catch((e) => this.rethrowUniqueCode(e))
    return store as unknown as InventoryStore
  }

  async deactivate(organizationId: string, id: string): Promise<InventoryStore> {
    await this.requireStore(organizationId, id)
    const stockWithBalance = await this.prisma.inventoryStock.findFirst({
      where: { storeId: id, currentStock: { gt: 0 } },
    })
    if (stockWithBalance) {
      throw new ConflictException('Cannot deactivate a store that still holds stock')
    }
    const store = await this.prisma.inventoryStore.update({ where: { id }, data: { isActive: false } })
    return store as unknown as InventoryStore
  }

  async listManagers(organizationId: string, storeId: string): Promise<InventoryStoreManager[]> {
    await this.requireStore(organizationId, storeId)
    const managers = await this.prisma.inventoryStoreManager.findMany({
      where: { storeId },
      include: { store: false },
    })
    const userIds = managers.map((m) => m.userId)
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    const userById = new Map(users.map((u) => [u.id, u]))
    return managers.map((m) => ({
      id: m.id,
      organizationId: m.organizationId,
      storeId: m.storeId,
      userId: m.userId,
      role: m.role as unknown as InventoryStoreManager['role'],
      assignedByUserId: m.assignedByUserId,
      assignedAt: m.assignedAt,
      user: userById.get(m.userId) ?? { id: m.userId, firstName: 'Unknown', lastName: '', email: '' },
    }))
  }

  async assignManager(
    organizationId: string,
    storeId: string,
    assignedByUserId: string,
    dto: AssignStoreManagerDto,
  ): Promise<InventoryStoreManager> {
    await this.requireStore(organizationId, storeId)
    const user = await this.prisma.user.findFirst({ where: { id: dto.userId, organizationId } })
    if (!user) throw new NotFoundException('User not found')

    const manager = await this.prisma.inventoryStoreManager.upsert({
      where: { storeId_userId: { storeId, userId: dto.userId } },
      update: { role: dto.role },
      create: { organizationId, storeId, userId: dto.userId, role: dto.role, assignedByUserId },
    })
    return {
      id: manager.id,
      organizationId: manager.organizationId,
      storeId: manager.storeId,
      userId: manager.userId,
      role: manager.role as unknown as InventoryStoreManager['role'],
      assignedByUserId: manager.assignedByUserId,
      assignedAt: manager.assignedAt,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
    }
  }

  async removeManager(organizationId: string, storeId: string, managerId: string): Promise<void> {
    await this.requireStore(organizationId, storeId)
    const manager = await this.prisma.inventoryStoreManager.findFirst({ where: { id: managerId, storeId } })
    if (!manager) throw new NotFoundException('Store manager assignment not found')
    await this.prisma.inventoryStoreManager.delete({ where: { id: managerId } })
  }

  /** Used by other inventory services to resolve/validate a store reference. */
  async requireStore(organizationId: string, id: string) {
    const store = await this.prisma.inventoryStore.findFirst({ where: { id, organizationId } })
    if (!store) throw new NotFoundException('Store not found')
    return store
  }

  private rethrowUniqueCode(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new ConflictException('A store with that code already exists')
    }
    throw error
  }
}
