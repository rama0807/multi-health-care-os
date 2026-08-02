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

describe('Pharmacy (e2e)', () => {
  let app: NestFastifyApplication
  let server: Parameters<typeof request>[0]
  let adminToken: string
  let doctorId: string
  let patientId: string

  const unique = Date.now()
  const adminEmail = `e2e-pharmacy-admin-${unique}@example.com`
  const orgSlug = `e2e-pharmacy-org-${unique}`
  const doctorEmail = `e2e-pharmacy-doctor-${unique}@example.com`

  function authed() {
    return { Authorization: `Bearer ${adminToken}` }
  }

  async function createEncounter() {
    const res = await request(server)
      .post('/api/v1/encounters')
      .set(authed())
      .send({ patientId, doctorId, type: 'OPD', notes: 'Routine visit' })
      .expect(201)
    return res.body.data.id as string
  }

  async function createPrescription(encounterId: string, items: Array<Record<string, unknown>>) {
    const res = await request(server)
      .post('/api/v1/prescriptions')
      .set(authed())
      .send({ encounterId, items })
      .expect(201)
    return res.body.data.prescription as { id: string; status: string }
  }

  async function createDrug(overrides: Partial<Record<string, unknown>> = {}) {
    const res = await request(server)
      .post('/api/v1/pharmacy/catalog')
      .set(authed())
      .send({
        genericName: 'Paracetamol',
        brandName: 'Crocin',
        strength: '500mg',
        dosageForm: 'Tablet',
        manufacturer: 'GSK',
        batchNumber: `BATCH-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        expiryDate: '2027-12-31',
        price: 2.5,
        taxPercent: 5,
        currentStock: 50,
        minStockLevel: 10,
        reorderLevel: 20,
        ...overrides,
      })
      .expect(201)
    return res.body.data
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
    const requiredPermissions = [
      { resource: 'doctors', action: 'read', scope: 'all' },
      { resource: 'doctors', action: 'create', scope: 'all' },
      { resource: 'hospitals', action: 'read', scope: 'all' },
      { resource: 'hospitals', action: 'create', scope: 'all' },
      { resource: 'departments', action: 'read', scope: 'all' },
      { resource: 'departments', action: 'create', scope: 'all' },
      { resource: 'patients', action: 'create', scope: 'all' },
      { resource: 'medical_records', action: 'read', scope: 'all' },
      { resource: 'medical_records', action: 'create', scope: 'all' },
      { resource: 'prescriptions', action: 'read', scope: 'all' },
      { resource: 'prescriptions', action: 'create', scope: 'all' },
      { resource: 'prescriptions', action: 'update', scope: 'all' },
      { resource: 'pharmacy', action: 'read', scope: 'all' },
      { resource: 'pharmacy', action: 'create', scope: 'all' },
      { resource: 'pharmacy', action: 'update', scope: 'all' },
    ]
    for (const perm of requiredPermissions) {
      await prisma.permission.upsert({
        where: { resource_action_scope: perm },
        update: {},
        create: { ...perm, description: `${perm.action} ${perm.resource} (${perm.scope})` },
      })
    }

    const registerRes = await request(server)
      .post('/api/v1/auth/register')
      .send({
        organizationName: 'E2E Pharmacy Org',
        organizationSlug: orgSlug,
        adminFirstName: 'E2E',
        adminLastName: 'Admin',
        adminEmail,
        adminPassword: 'Passw0rd123',
        phone: '9876543210',
      })
      .expect(201)
    adminToken = registerRes.body.data.accessToken

    const org = await prisma.organization.findUniqueOrThrow({ where: { slug: orgSlug } })
    await prisma.role.create({
      data: { name: 'Doctor', systemRole: 'DOCTOR', organizationId: org.id, description: 'Doctor role' },
    })

    const hospitalRes = await request(server)
      .post('/api/v1/hospitals')
      .set(authed())
      .send({ name: 'E2E Pharmacy Hospital', code: 'E2EPHARM' })
      .expect(201)
    const hospitalId = hospitalRes.body.data.id

    const departmentRes = await request(server)
      .post('/api/v1/departments')
      .set(authed())
      .send({ hospitalId, name: 'General Medicine', code: 'GENMED' })
      .expect(201)
    const departmentId = departmentRes.body.data.id

    const doctorRes = await request(server)
      .post('/api/v1/doctors')
      .set(authed())
      .send({
        email: doctorEmail,
        firstName: 'Priya',
        lastName: 'Sharma',
        registrationNumber: `MCI-PHARM-${unique}`,
        specialization: 'General Medicine',
        qualification: 'MBBS',
        experienceYears: 6,
        languagesSpoken: ['English'],
        consultationFee: 400,
        joiningDate: '2020-01-01',
        hospitalId,
        departmentId,
      })
      .expect(201)
    doctorId = doctorRes.body.data.id

    const patientRes = await request(server)
      .post('/api/v1/patients')
      .set(authed())
      .send({ firstName: 'Anita', lastName: 'Desai', phone: '9123456781', dateOfBirth: '1990-05-15', gender: 'FEMALE' })
      .expect(201)
    patientId = patientRes.body.data.id
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  describe('drug catalog', () => {
    it('creates a drug batch with the roadmap fields', async () => {
      const drug = await createDrug({ batchNumber: 'CAT-BATCH-001' })

      expect(drug.genericName).toBe('Paracetamol')
      expect(drug.batchNumber).toBe('CAT-BATCH-001')
      expect(drug.currentStock).toBe(50)
      expect(drug.availableStock).toBe(50)
      expect(drug.isActive).toBe(true)
    })

    it('lists, filters, and paginates the catalog', async () => {
      const res = await request(server)
        .get('/api/v1/pharmacy/catalog')
        .set(authed())
        .query({ search: 'Paracetamol', page: 1, limit: 10, sortBy: 'genericName', sortOrder: 'asc' })
        .expect(200)

      expect(res.body.data.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 10 })
      expect(res.body.data.data.every((d: { genericName: string }) => d.genericName.includes('Paracetamol'))).toBe(true)
    })

    it('updates and deactivates a drug', async () => {
      const drug = await createDrug({ batchNumber: 'CAT-BATCH-002' })

      const res = await request(server)
        .patch(`/api/v1/pharmacy/catalog/${drug.id}`)
        .set(authed())
        .send({ isActive: false, price: 3 })
        .expect(200)

      expect(res.body.data.isActive).toBe(false)
      expect(res.body.data.price).toBe('3')
    })

    it('adjusts stock up and down, rejecting a drop below the reserved amount', async () => {
      const drug = await createDrug({ batchNumber: 'CAT-BATCH-003', currentStock: 10 })

      const upRes = await request(server)
        .post(`/api/v1/pharmacy/catalog/${drug.id}/adjust-stock`)
        .set(authed())
        .send({ quantity: 20, reason: 'New delivery' })
        .expect(201)
      expect(upRes.body.data.currentStock).toBe(30)

      await request(server)
        .post(`/api/v1/pharmacy/catalog/${drug.id}/adjust-stock`)
        .set(authed())
        .send({ quantity: -100 })
        .expect(400)
    })

    it('filters low-stock drugs', async () => {
      const lowStock = await createDrug({ batchNumber: 'CAT-LOW-001', currentStock: 2, reorderLevel: 20 })

      const res = await request(server).get('/api/v1/pharmacy/catalog').set(authed()).query({ lowStockOnly: 'true' }).expect(200)

      expect(res.body.data.data.some((d: { id: string }) => d.id === lowStock.id)).toBe(true)
    })
  })

  describe('dispensing workflow', () => {
    let prescriptionId: string
    let dispenseOrderId: string
    let item1Id: string
    let item2Id: string
    let drug1Id: string
    let drug2Id: string

    it('creates a dispense order from an active prescription, mirroring its items', async () => {
      const encounterId = await createEncounter()
      const prescription = await createPrescription(encounterId, [
        { medicationName: 'Paracetamol', dosage: '500mg', frequency: 'BD', duration: '5 days', quantity: 10 },
        { medicationName: 'Amoxicillin', dosage: '250mg', frequency: 'TDS', duration: '7 days', quantity: 21 },
      ])
      prescriptionId = prescription.id

      const res = await request(server)
        .post('/api/v1/pharmacy/dispense')
        .set(authed())
        .send({ prescriptionId })
        .expect(201)

      dispenseOrderId = res.body.data.id
      expect(res.body.data.dispenseNumber).toMatch(/^DSP-.+-\d{4}-\d{6}$/)
      expect(res.body.data.status).toBe('PENDING')
    })

    it('rejects creating a second dispense order for the same prescription', async () => {
      await request(server).post('/api/v1/pharmacy/dispense').set(authed()).send({ prescriptionId }).expect(409)
    })

    it('reads the order back with its items', async () => {
      const res = await request(server).get(`/api/v1/pharmacy/dispense/${dispenseOrderId}`).set(authed()).expect(200)

      expect(res.body.data.items).toHaveLength(2)
      item1Id = res.body.data.items.find((i: { medicationName: string }) => i.medicationName === 'Paracetamol').id
      item2Id = res.body.data.items.find((i: { medicationName: string }) => i.medicationName === 'Amoxicillin').id
      expect(res.body.data.patient.id).toBe(patientId)
      expect(res.body.data.prescription.id).toBe(prescriptionId)
    })

    it('rejects selecting a batch with insufficient available stock', async () => {
      const scarceDrug = await createDrug({ genericName: 'Paracetamol', batchNumber: 'SCARCE-001', currentStock: 1 })

      await request(server)
        .post(`/api/v1/pharmacy/dispense/${dispenseOrderId}/prepare`)
        .set(authed())
        .send({ items: [{ dispenseItemId: item1Id, drugId: scarceDrug.id }] })
        .expect(400)
    })

    it('selects batches for both items, reserving stock and moving to PREPARING', async () => {
      const drug1 = await createDrug({ genericName: 'Paracetamol', batchNumber: 'PARA-001', currentStock: 50 })
      const drug2 = await createDrug({ genericName: 'Amoxicillin', brandName: 'Amoxil', batchNumber: 'AMOX-001', currentStock: 50 })
      drug1Id = drug1.id
      drug2Id = drug2.id

      const res = await request(server)
        .post(`/api/v1/pharmacy/dispense/${dispenseOrderId}/prepare`)
        .set(authed())
        .send({
          items: [
            { dispenseItemId: item1Id, drugId: drug1Id },
            { dispenseItemId: item2Id, drugId: drug2Id },
          ],
        })
        .expect(201)

      expect(res.body.data.status).toBe('PREPARING')

      const drug1After = await request(server).get(`/api/v1/pharmacy/catalog/${drug1Id}`).set(authed()).expect(200)
      expect(drug1After.body.data.reservedStock).toBe(10)
      expect(drug1After.body.data.availableStock).toBe(40)
    })

    it('marks the order READY once every item has a batch', async () => {
      const res = await request(server).post(`/api/v1/pharmacy/dispense/${dispenseOrderId}/ready`).set(authed()).expect(201)
      expect(res.body.data.status).toBe('READY')
    })

    it('partially dispenses one item, leaving the order READY', async () => {
      const res = await request(server)
        .post(`/api/v1/pharmacy/dispense/${dispenseOrderId}/dispense-partial`)
        .set(authed())
        .send({ items: [{ dispenseItemId: item1Id, quantity: 4 }] })
        .expect(201)

      expect(res.body.data.status).toBe('READY')
      const item1 = res.body.data.items.find((i: { id: string }) => i.id === item1Id)
      expect(item1.quantityDispensed).toBe(4)

      const drug1After = await request(server).get(`/api/v1/pharmacy/catalog/${drug1Id}`).set(authed()).expect(200)
      expect(drug1After.body.data.currentStock).toBe(46)
      expect(drug1After.body.data.reservedStock).toBe(6)
    })

    it('completes the dispense, filling the remainder and completing the source prescription', async () => {
      const res = await request(server)
        .post(`/api/v1/pharmacy/dispense/${dispenseOrderId}/dispense-complete`)
        .set(authed())
        .expect(201)

      expect(res.body.data.status).toBe('DISPENSED')
      expect(res.body.data.items.every((i: { quantityDispensed: number; quantityRequested: number }) => i.quantityDispensed === i.quantityRequested)).toBe(true)

      const prescriptionRes = await request(server).get(`/api/v1/prescriptions/${prescriptionId}`).set(authed()).expect(200)
      expect(prescriptionRes.body.data.status).toBe('COMPLETED')

      const drug2After = await request(server).get(`/api/v1/pharmacy/catalog/${drug2Id}`).set(authed()).expect(200)
      expect(drug2After.body.data.currentStock).toBe(29)
      expect(drug2After.body.data.reservedStock).toBe(0)
    })

    it('rejects a return larger than what was dispensed', async () => {
      await request(server)
        .post(`/api/v1/pharmacy/dispense/${dispenseOrderId}/returns`)
        .set(authed())
        .send({ dispenseItemId: item1Id, quantityReturned: 100, reason: 'Too many' })
        .expect(400)
    })

    it('records a medicine return, restocks the drug, and moves the order to RETURNED', async () => {
      const res = await request(server)
        .post(`/api/v1/pharmacy/dispense/${dispenseOrderId}/returns`)
        .set(authed())
        .send({ dispenseItemId: item1Id, quantityReturned: 3, reason: 'Patient discontinued' })
        .expect(201)

      expect(res.body.data.quantityReturned).toBe(3)

      const orderRes = await request(server).get(`/api/v1/pharmacy/dispense/${dispenseOrderId}`).set(authed()).expect(200)
      expect(orderRes.body.data.status).toBe('RETURNED')
      expect(orderRes.body.data.returns).toHaveLength(1)

      const drug1After = await request(server).get(`/api/v1/pharmacy/catalog/${drug1Id}`).set(authed()).expect(200)
      expect(drug1After.body.data.currentStock).toBe(43)
    })

    it('lists the order in dispense history filtered by patient', async () => {
      const res = await request(server)
        .get('/api/v1/pharmacy/dispense')
        .set(authed())
        .query({ patientId, status: 'RETURNED' })
        .expect(200)

      expect(res.body.data.data.some((o: { id: string }) => o.id === dispenseOrderId)).toBe(true)
    })
  })

  describe('reject and cancel', () => {
    it('rejects an unprocessed order, releasing any reserved stock', async () => {
      const encounterId = await createEncounter()
      const prescription = await createPrescription(encounterId, [
        { medicationName: 'Ibuprofen', dosage: '400mg', frequency: 'BD', duration: '3 days', quantity: 6 },
      ])
      const orderRes = await request(server)
        .post('/api/v1/pharmacy/dispense')
        .set(authed())
        .send({ prescriptionId: prescription.id })
        .expect(201)

      const res = await request(server)
        .post(`/api/v1/pharmacy/dispense/${orderRes.body.data.id}/reject`)
        .set(authed())
        .send({ reason: 'Drug discontinued by manufacturer' })
        .expect(201)

      expect(res.body.data.status).toBe('CANCELLED')
      expect(res.body.data.rejected).toBe(true)
      expect(res.body.data.cancelReason).toBe('Drug discontinued by manufacturer')
    })

    it('cancels an unprocessed order without marking it rejected', async () => {
      const encounterId = await createEncounter()
      const prescription = await createPrescription(encounterId, [
        { medicationName: 'Cetirizine', dosage: '10mg', frequency: 'OD', duration: '5 days', quantity: 5 },
      ])
      const orderRes = await request(server)
        .post('/api/v1/pharmacy/dispense')
        .set(authed())
        .send({ prescriptionId: prescription.id })
        .expect(201)

      const res = await request(server)
        .post(`/api/v1/pharmacy/dispense/${orderRes.body.data.id}/cancel`)
        .set(authed())
        .send({})
        .expect(201)

      expect(res.body.data.status).toBe('CANCELLED')
      expect(res.body.data.rejected).toBe(false)

      await request(server)
        .post(`/api/v1/pharmacy/dispense/${orderRes.body.data.id}/ready`)
        .set(authed())
        .expect(400)
    })
  })

  describe('dashboard stats', () => {
    it('returns pharmacy dashboard counters', async () => {
      const res = await request(server).get('/api/v1/pharmacy/dispense/dashboard-stats').set(authed()).expect(200)

      expect(res.body.data).toMatchObject({
        pending: expect.any(Number),
        ready: expect.any(Number),
        dispensedToday: expect.any(Number),
        lowStock: expect.any(Number),
        expiringSoon: expect.any(Number),
      })
    })
  })

  it('rejects pharmacy routes without a bearer token', async () => {
    await request(server).get('/api/v1/pharmacy/catalog').expect(401)
    await request(server).get('/api/v1/pharmacy/dispense').expect(401)
  })
})
