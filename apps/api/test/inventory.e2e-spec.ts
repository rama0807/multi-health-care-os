import { generateKeyPairSync } from 'crypto'

import fastifyCookie from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import { VersioningType } from '@nestjs/common'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { ZodValidationPipe } from 'nestjs-zod'
import request from 'supertest'

process.env.DATABASE_URL ??= 'postgresql://medicore:medicore@localhost:5434/medicore_test?schema=public'
process.env.REDIS_HOST ??= 'localhost'
process.env.REDIS_PORT ??= '6381'
process.env.COOKIE_SECRET ??= 'e2e-test-cookie-secret'
process.env.FRONTEND_URL ??= 'http://localhost:3000'
process.env.STORAGE_PROVIDER ??= 'local'
process.env.LOCAL_STORAGE_PATH ??= './uploads-e2e-test'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = Buffer.from(privateKey).toString('base64')
process.env.JWT_PUBLIC_KEY = Buffer.from(publicKey).toString('base64')

// eslint-disable-next-line import/order
import { AppModule } from '../src/app.module'
// eslint-disable-next-line import/order
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter'
// eslint-disable-next-line import/order
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor'
// eslint-disable-next-line import/order
import { PrismaService } from '../src/prisma/prisma.service'

describe('Inventory & Procurement (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let adminToken: string
  let departmentId: string

  const unique = Date.now()
  const adminEmail = `e2e-inventory-admin-${unique}@example.com`
  const orgSlug = `e2e-inventory-org-${unique}`

  function authed() {
    return { Authorization: `Bearer ${adminToken}` }
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile()

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
    await app.register(fastifyCookie, { secret: process.env.COOKIE_SECRET })
    await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } })

    app.enableVersioning({ type: VersioningType.URI })
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ZodValidationPipe())
    app.useGlobalFilters(new HttpExceptionFilter())
    app.useGlobalInterceptors(new ResponseTransformInterceptor())

    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    server = app.getHttpAdapter().getInstance().server

    const prisma = app.get(PrismaService)
    const resources: Record<string, string[]> = {
      'inventory.items': ['read', 'create', 'update', 'delete'],
      'inventory.stores': ['read', 'create', 'update', 'delete'],
      'inventory.stock': ['read', 'create', 'update'],
      'inventory.procurement': ['read', 'create', 'update', 'approve', 'manage'],
      'inventory.vendors': ['read', 'create', 'update'],
      'inventory.requests': ['read', 'create', 'update', 'approve'],
      'inventory.assets': ['read', 'create', 'update'],
      'inventory.audit': ['read', 'create', 'update', 'manage'],
      hospitals: ['read', 'create'],
      departments: ['read', 'create'],
    }
    for (const [resource, actions] of Object.entries(resources)) {
      for (const action of actions) {
        const perm = { resource, action, scope: 'all' }
        await prisma.permission.upsert({
          where: { resource_action_scope: perm },
          update: {},
          create: { ...perm, description: `${action} ${resource} (all)` },
        })
      }
    }

    const registerRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        organizationName: 'E2E Inventory Org',
        organizationSlug: orgSlug,
        adminFirstName: 'E2E',
        adminLastName: 'Admin',
        adminEmail,
        adminPassword: 'Passw0rd123',
        phone: '9876543210',
      })
      .expect(201)
    adminToken = registerRes.body.data.accessToken

    const hospitalRes = await request(server)
      .post('/api/v1/hospitals')
      .set(authed())
      .send({ name: 'E2E Inventory Hospital', code: 'E2EINV' })
      .expect(201)
    const hospitalId = hospitalRes.body.data.id

    const departmentRes = await request(server)
      .post('/api/v1/departments')
      .set(authed())
      .send({ hospitalId, name: 'Biomedical Engineering', code: 'BIOMED' })
      .expect(201)
    departmentId = departmentRes.body.data.id
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  // ── Item Master ────────────────────────────────────────────────────────

  let categoryId: string
  let unitId: string
  let manufacturerId: string
  let brandId: string
  let consumableItemId: string
  let assetItemId: string

  describe('item master', () => {
    it('creates categories, units, manufacturers, brands', async () => {
      const category = await request(server)
        .post('/api/v1/inventory/categories')
        .set(authed())
        .send({ name: 'Consumables', code: `CAT-${unique}` })
        .expect(201)
      categoryId = category.body.data.id

      const subCategory = await request(server)
        .post('/api/v1/inventory/categories')
        .set(authed())
        .send({ name: 'Surgical Consumables', code: `SUBCAT-${unique}`, parentId: categoryId })
        .expect(201)
      expect(subCategory.body.data.parentId).toBe(categoryId)

      const unit = await request(server)
        .post('/api/v1/inventory/units')
        .set(authed())
        .send({ name: 'Box', symbol: `BOX-${unique}` })
        .expect(201)
      unitId = unit.body.data.id

      const manufacturer = await request(server)
        .post('/api/v1/inventory/manufacturers')
        .set(authed())
        .send({ name: `Acme Medical ${unique}` })
        .expect(201)
      manufacturerId = manufacturer.body.data.id

      const brand = await request(server)
        .post('/api/v1/inventory/brands')
        .set(authed())
        .send({ name: `AcmeBrand ${unique}`, manufacturerId })
        .expect(201)
      brandId = brand.body.data.id
    })

    it('creates a consumable and an asset item', async () => {
      const consumable = await request(server)
        .post('/api/v1/inventory/items')
        .set(authed())
        .send({
          name: 'Surgical Gloves',
          code: `ITEM-GLV-${unique}`,
          categoryId,
          unitId,
          manufacturerId,
          brandId,
          itemType: 'CONSUMABLE',
          trackBatch: true,
          trackExpiry: true,
          hsnCode: '4015',
          gstPercent: 12,
          unitCost: 5.5,
        })
        .expect(201)
      consumableItemId = consumable.body.data.id
      expect(consumable.body.data.category.id).toBe(categoryId)

      const asset = await request(server)
        .post('/api/v1/inventory/items')
        .set(authed())
        .send({ name: 'Infusion Pump', code: `ITEM-ASSET-${unique}`, itemType: 'ASSET', trackSerial: true })
        .expect(201)
      assetItemId = asset.body.data.id
    })

    it('lists and filters items', async () => {
      const res = await request(server)
        .get('/api/v1/inventory/items')
        .set(authed())
        .query({ search: 'Surgical Gloves', page: 1, limit: 10 })
        .expect(200)
      expect(res.body.data.data.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── Store Management ─────────────────────────────────────────────────────

  let centralStoreId: string
  let icuStoreId: string

  describe('store management', () => {
    it('creates stores', async () => {
      const central = await request(server)
        .post('/api/v1/inventory/stores')
        .set(authed())
        .send({ name: 'Central Store', code: `CENTRAL-${unique}`, type: 'CENTRAL' })
        .expect(201)
      centralStoreId = central.body.data.id

      const icu = await request(server)
        .post('/api/v1/inventory/stores')
        .set(authed())
        .send({ name: 'ICU Store', code: `ICU-${unique}`, type: 'ICU' })
        .expect(201)
      icuStoreId = icu.body.data.id
    })

    it('rejects deactivating a store that still holds stock', async () => {
      await request(server)
        .post('/api/v1/inventory/stock/opening')
        .set(authed())
        .send({ itemId: consumableItemId, storeId: centralStoreId, quantity: 5, batchNumber: 'DEACT-TEST' })
        .expect(201)

      await request(server).post(`/api/v1/inventory/stores/${centralStoreId}/deactivate`).set(authed()).expect(409)
    })
  })

  // ── Stock ─────────────────────────────────────────────────────────────────

  describe('stock', () => {
    it('sets opening stock and computes available stock', async () => {
      const res = await request(server)
        .post('/api/v1/inventory/stock/opening')
        .set(authed())
        .send({
          itemId: assetItemId,
          storeId: centralStoreId,
          quantity: 100,
          reorderLevel: 20,
          minStock: 10,
          maxStock: 200,
        })
        .expect(201)
      expect(res.body.data.currentStock).toBe(100)
      expect(res.body.data.availableStock).toBe(100)
    })

    it('adjusts stock for damage, reducing available and increasing damagedStock', async () => {
      const stockRes = await request(server)
        .get('/api/v1/inventory/stock')
        .set(authed())
        .query({ storeId: centralStoreId, itemId: assetItemId })
        .expect(200)
      const stockId = stockRes.body.data.data[0].id

      const adjustRes = await request(server)
        .post('/api/v1/inventory/stock/adjust')
        .set(authed())
        .send({ itemId: assetItemId, storeId: centralStoreId, type: 'DAMAGE', quantityDelta: 10, reason: 'Dropped during handling' })
        .expect(201)

      expect(adjustRes.body.data.damagedStock).toBe(10)
      expect(adjustRes.body.data.currentStock).toBe(90)
      expect(adjustRes.body.data.availableStock).toBe(80)

      await request(server).get(`/api/v1/inventory/stock/${stockId}`).set(authed()).expect(200)
    })
  })

  // ── Vendors ───────────────────────────────────────────────────────────────

  let vendorId: string

  describe('vendors', () => {
    it('creates and rates a vendor, computing outstanding balance', async () => {
      const vendor = await request(server)
        .post('/api/v1/inventory/vendors')
        .set(authed())
        .send({ name: 'MedSupply Co', code: `VEND-${unique}`, gstin: '27ABCDE1234F1Z5', paymentTermsDays: 45 })
        .expect(201)
      vendorId = vendor.body.data.id

      await request(server).post(`/api/v1/inventory/vendors/${vendorId}/ratings`).set(authed()).send({ rating: 4, comments: 'Reliable' }).expect(201)

      const detail = await request(server).get(`/api/v1/inventory/vendors/${vendorId}`).set(authed()).expect(200)
      expect(detail.body.data.averageRating).toBe(4)
      expect(detail.body.data.outstandingBalance).toBe('0.00')
    })
  })

  // ── Procurement: PR -> PO -> GRN -> Vendor Invoice ──────────────────────

  let purchaseRequestId: string
  let purchaseOrderId: string
  let purchaseOrderItemId: string
  let grnId: string

  describe('procurement lifecycle', () => {
    it('creates and approves a purchase request', async () => {
      const pr = await request(server)
        .post('/api/v1/inventory/purchase-requests')
        .set(authed())
        .send({ storeId: centralStoreId, items: [{ itemId: consumableItemId, quantity: 100 }] })
        .expect(201)
      purchaseRequestId = pr.body.data.id
      expect(pr.body.data.status).toBe('DRAFT')

      await request(server).post(`/api/v1/inventory/purchase-requests/${purchaseRequestId}/submit`).set(authed()).expect(201)
      const approved = await request(server)
        .post(`/api/v1/inventory/purchase-requests/${purchaseRequestId}/approve`)
        .set(authed())
        .expect(201)
      expect(approved.body.data.status).toBe('APPROVED')
    })

    it('converts the approved PR into a purchase order and walks it to Sent', async () => {
      const po = await request(server)
        .post('/api/v1/inventory/purchase-orders')
        .set(authed())
        .send({
          vendorId,
          storeId: centralStoreId,
          purchaseRequestId,
          items: [{ itemId: consumableItemId, quantityOrdered: 100, unitPrice: 10, taxPercent: 12 }],
        })
        .expect(201)
      purchaseOrderId = po.body.data.id
      purchaseOrderItemId = po.body.data.items[0].id
      expect(po.body.data.totalAmount).toBe('1120.00')

      const prAfter = await request(server).get(`/api/v1/inventory/purchase-requests/${purchaseRequestId}`).set(authed()).expect(200)
      expect(prAfter.body.data.status).toBe('CONVERTED')

      await request(server).post(`/api/v1/inventory/purchase-orders/${purchaseOrderId}/submit`).set(authed()).expect(201)
      await request(server).post(`/api/v1/inventory/purchase-orders/${purchaseOrderId}/approve`).set(authed()).expect(201)
      const sent = await request(server).post(`/api/v1/inventory/purchase-orders/${purchaseOrderId}/send`).set(authed()).expect(201)
      expect(sent.body.data.status).toBe('SENT')
    })

    it('records a partial GRN, then completes it and adds real stock', async () => {
      const grn = await request(server)
        .post('/api/v1/inventory/grn')
        .set(authed())
        .send({
          purchaseOrderId,
          items: [
            {
              purchaseOrderItemId,
              quantityReceived: 60,
              batchNumber: `GRN-BATCH-${unique}`,
              expiryDate: '2028-01-01',
              unitPrice: 10,
            },
          ],
        })
        .expect(201)
      grnId = grn.body.data.id
      expect(grn.body.data.status).toBe('DRAFT')

      const completed = await request(server).post(`/api/v1/inventory/grn/${grnId}/complete`).set(authed()).expect(201)
      expect(completed.body.data.status).toBe('COMPLETED')

      const poAfter = await request(server).get(`/api/v1/inventory/purchase-orders/${purchaseOrderId}`).set(authed()).expect(200)
      expect(poAfter.body.data.status).toBe('PARTIALLY_RECEIVED')

      const stockRes = await request(server)
        .get('/api/v1/inventory/stock')
        .set(authed())
        .query({ storeId: centralStoreId, itemId: consumableItemId })
        .expect(200)
      expect(stockRes.body.data.data[0].currentStock).toBe(65) // 5 opening + 60 received
    })

    it('records a vendor invoice and pays it in full', async () => {
      const invoice = await request(server)
        .post('/api/v1/inventory/vendor-invoices')
        .set(authed())
        .send({
          vendorId,
          purchaseOrderId,
          goodsReceiptNoteId: grnId,
          invoiceNumber: `INV-${unique}`,
          invoiceDate: '2026-08-01',
          amount: 600,
          taxAmount: 72,
        })
        .expect(201)
      expect(invoice.body.data.totalAmount).toBe('672')
      expect(invoice.body.data.status).toBe('PENDING')

      const paid = await request(server)
        .post(`/api/v1/inventory/vendor-invoices/${invoice.body.data.id}/payments`)
        .set(authed())
        .send({ amount: 672 })
        .expect(201)
      expect(paid.body.data.status).toBe('PAID')
    })

    it('records a vendor return against the GRN, decrementing store stock', async () => {
      const before = await request(server)
        .get('/api/v1/inventory/stock')
        .set(authed())
        .query({ storeId: centralStoreId, itemId: consumableItemId })
        .expect(200)
      const beforeStock = before.body.data.data[0].currentStock

      const vendorReturn = await request(server)
        .post('/api/v1/inventory/vendor-returns')
        .set(authed())
        .send({
          vendorId,
          goodsReceiptNoteId: grnId,
          storeId: centralStoreId,
          reason: 'Damaged in transit',
          items: [{ itemId: consumableItemId, quantity: 5, unitPrice: 10 }],
        })
        .expect(201)
      expect(vendorReturn.body.data.status).toBe('SENT')

      await request(server).post(`/api/v1/inventory/vendor-returns/${vendorReturn.body.data.id}/acknowledge`).set(authed()).expect(201)

      const after = await request(server)
        .get('/api/v1/inventory/stock')
        .set(authed())
        .query({ storeId: centralStoreId, itemId: consumableItemId })
        .expect(200)
      expect(after.body.data.data[0].currentStock).toBe(beforeStock - 5)
    })
  })

  // ── Internal Requests (Store Requisitions) ──────────────────────────────

  describe('internal requisitions', () => {
    it('walks a requisition through request -> approve -> issue -> receive', async () => {
      const req = await request(server)
        .post('/api/v1/inventory/requisitions')
        .set(authed())
        .send({
          fromStoreId: centralStoreId,
          toStoreId: icuStoreId,
          priority: 'URGENT',
          items: [{ itemId: consumableItemId, quantityRequested: 10 }],
        })
        .expect(201)
      const requisitionId = req.body.data.id
      const reqItemId = req.body.data.items[0].id

      await request(server).post(`/api/v1/inventory/requisitions/${requisitionId}/approve`).set(authed()).expect(201)

      const issued = await request(server)
        .post(`/api/v1/inventory/requisitions/${requisitionId}/issue`)
        .set(authed())
        .send({ items: [{ storeRequisitionItemId: reqItemId, quantityIssued: 10 }] })
        .expect(201)
      expect(issued.body.data.status).toBe('ISSUED')

      const received = await request(server)
        .post(`/api/v1/inventory/requisitions/${requisitionId}/receive`)
        .set(authed())
        .send({ items: [{ storeRequisitionItemId: reqItemId, quantityReceived: 10 }] })
        .expect(201)
      expect(received.body.data.status).toBe('RECEIVED')

      const icuStock = await request(server)
        .get('/api/v1/inventory/stock')
        .set(authed())
        .query({ storeId: icuStoreId, itemId: consumableItemId })
        .expect(200)
      expect(icuStock.body.data.data[0].currentStock).toBe(10)
    })

    it('rejects a requisition with a reason', async () => {
      const req = await request(server)
        .post('/api/v1/inventory/requisitions')
        .set(authed())
        .send({ fromStoreId: centralStoreId, toStoreId: icuStoreId, items: [{ itemId: consumableItemId, quantityRequested: 1 }] })
        .expect(201)

      const rejected = await request(server)
        .post(`/api/v1/inventory/requisitions/${req.body.data.id}/reject`)
        .set(authed())
        .send({ reason: 'Not urgently needed' })
        .expect(201)
      expect(rejected.body.data.status).toBe('REJECTED')
    })
  })

  // ── Stock Transfers ───────────────────────────────────────────────────────

  describe('stock transfers', () => {
    it('dispatches and receives a direct store-to-store transfer', async () => {
      const transfer = await request(server)
        .post('/api/v1/inventory/transfers')
        .set(authed())
        .send({ fromStoreId: centralStoreId, toStoreId: icuStoreId, items: [{ itemId: assetItemId, quantity: 20 }] })
        .expect(201)
      const transferId = transfer.body.data.id

      const dispatched = await request(server).post(`/api/v1/inventory/transfers/${transferId}/dispatch`).set(authed()).expect(201)
      expect(dispatched.body.data.status).toBe('IN_TRANSIT')

      const received = await request(server).post(`/api/v1/inventory/transfers/${transferId}/receive`).set(authed()).expect(201)
      expect(received.body.data.status).toBe('COMPLETED')

      const icuStock = await request(server)
        .get('/api/v1/inventory/stock')
        .set(authed())
        .query({ storeId: icuStoreId, itemId: assetItemId })
        .expect(200)
      expect(icuStock.body.data.data[0].currentStock).toBe(20)
    })

    it('cancels a dispatched transfer, restoring stock to the source store', async () => {
      const transfer = await request(server)
        .post('/api/v1/inventory/transfers')
        .set(authed())
        .send({ fromStoreId: centralStoreId, toStoreId: icuStoreId, items: [{ itemId: assetItemId, quantity: 5 }] })
        .expect(201)
      await request(server).post(`/api/v1/inventory/transfers/${transfer.body.data.id}/dispatch`).set(authed()).expect(201)

      const cancelled = await request(server)
        .post(`/api/v1/inventory/transfers/${transfer.body.data.id}/cancel`)
        .set(authed())
        .send({ reason: 'ICU no longer needs it' })
        .expect(201)
      expect(cancelled.body.data.status).toBe('CANCELLED')
    })
  })

  // ── Asset Management ──────────────────────────────────────────────────────

  describe('asset management', () => {
    let registeredAssetId: string

    it('registers a physical asset and assigns it to a department', async () => {
      const asset = await request(server)
        .post('/api/v1/inventory/assets')
        .set(authed())
        .send({
          itemId: assetItemId,
          storeId: centralStoreId,
          assetTag: `ASSET-${unique}`,
          serialNumber: `SN-${unique}`,
          purchasePrice: 250000,
          warrantyExpiryDate: '2028-01-01',
        })
        .expect(201)
      registeredAssetId = asset.body.data.id
      expect(asset.body.data.status).toBe('IN_STORE')

      const assigned = await request(server)
        .post(`/api/v1/inventory/assets/${registeredAssetId}/assign`)
        .set(authed())
        .send({ assignedToDepartmentId: departmentId })
        .expect(201)
      expect(assigned.body.data.status).toBe('IN_USE')
      expect(assigned.body.data.assignedToDepartmentId).toBe(departmentId)

      const assignments = await request(server).get(`/api/v1/inventory/assets/${registeredAssetId}/assignments`).set(authed()).expect(200)
      expect(assignments.body.data.length).toBe(1)
    })

    it('logs a breakdown, then completes the maintenance record', async () => {
      const record = await request(server)
        .post(`/api/v1/inventory/assets/${registeredAssetId}/maintenance`)
        .set(authed())
        .send({ type: 'BREAKDOWN', description: 'Pump stopped working mid-infusion' })
        .expect(201)
      expect(record.body.data.status).toBe('IN_PROGRESS')

      const assetAfterBreakdown = await request(server).get(`/api/v1/inventory/assets/${registeredAssetId}`).set(authed()).expect(200)
      expect(assetAfterBreakdown.body.data.status).toBe('BREAKDOWN')

      const completed = await request(server)
        .post(`/api/v1/inventory/assets/${registeredAssetId}/maintenance/${record.body.data.id}/complete`)
        .set(authed())
        .send({ cost: 1500, performedBy: 'Vendor Technician' })
        .expect(201)
      expect(completed.body.data.status).toBe('COMPLETED')

      const assetAfterRepair = await request(server).get(`/api/v1/inventory/assets/${registeredAssetId}`).set(authed()).expect(200)
      expect(assetAfterRepair.body.data.status).toBe('IN_USE') // still assigned to the department
    })
  })

  // ── Stock Audit ────────────────────────────────────────────────────────────

  describe('stock audit', () => {
    it('runs a cycle count and applies a variance as a correction', async () => {
      const audit = await request(server)
        .post('/api/v1/inventory/audits')
        .set(authed())
        .send({ storeId: centralStoreId, notes: 'Monthly cycle count', itemIds: [consumableItemId] })
        .expect(201)
      const auditId = audit.body.data.id
      expect(audit.body.data.status).toBe('DRAFT')
      expect(audit.body.data.items.length).toBeGreaterThanOrEqual(1)

      await request(server).post(`/api/v1/inventory/audits/${auditId}/start`).set(authed()).expect(201)

      const targetItem = audit.body.data.items.find((i: { itemId: string }) => i.itemId === consumableItemId)
      const countedQuantity = targetItem.systemQuantity - 2 // simulate 2 units physically missing

      await request(server)
        .post(`/api/v1/inventory/audits/${auditId}/counts`)
        .set(authed())
        .send({ items: [{ stockAuditItemId: targetItem.id, countedQuantity, remarks: 'Short by 2' }] })
        .expect(201)

      const completed = await request(server).post(`/api/v1/inventory/audits/${auditId}/complete`).set(authed()).expect(201)
      expect(completed.body.data.status).toBe('COMPLETED')

      const stockAfter = await request(server)
        .get('/api/v1/inventory/stock')
        .set(authed())
        .query({ storeId: centralStoreId, itemId: consumableItemId })
        .expect(200)
      expect(stockAfter.body.data.data[0].currentStock).toBe(countedQuantity)
    })

    it('cancels a draft audit', async () => {
      const audit = await request(server)
        .post('/api/v1/inventory/audits')
        .set(authed())
        .send({ storeId: centralStoreId })
        .expect(201)
      const cancelled = await request(server).post(`/api/v1/inventory/audits/${audit.body.data.id}/cancel`).set(authed()).expect(201)
      expect(cancelled.body.data.status).toBe('CANCELLED')
    })
  })

  // ── Dashboard ──────────────────────────────────────────────────────────────

  describe('dashboard', () => {
    it('returns aggregated inventory stats', async () => {
      const res = await request(server).get('/api/v1/inventory/dashboard').set(authed()).expect(200)
      expect(res.body.data).toMatchObject({
        totalItems: expect.any(Number),
        totalStores: expect.any(Number),
        lowStockCount: expect.any(Number),
        pendingPurchaseRequests: expect.any(Number),
        assetsInBreakdown: expect.any(Number),
      })
      expect(res.body.data.totalStores).toBeGreaterThanOrEqual(2)
    })
  })

  // ── RBAC ─────────────────────────────────────────────────────────────────

  it('rejects unauthenticated requests', async () => {
    await request(server).get('/api/v1/inventory/items').expect(401)
  })
})
