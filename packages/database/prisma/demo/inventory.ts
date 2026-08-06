import { PrismaClient } from '@prisma/client'

import type { DemoContext } from './foundation'
import {
  INVENTORY_BRANDS,
  INVENTORY_CATEGORIES,
  INVENTORY_ITEMS,
  INVENTORY_ITEM_GROUPS,
  INVENTORY_MANUFACTURERS,
  INVENTORY_STORES,
  INVENTORY_UNITS,
  VENDORS,
} from './reference-data'
import { YEAR, chance, daysAgo, daysFromNow, docNumber, int, money, pick, pickMany, rnd } from './helpers'

/**
 * Seeds the general (non-drug) inventory and procurement surface: the item
 * master and its classification tables, multi-store stock with batches, the
 * Purchase Request → PO → GRN → Vendor Invoice chain, internal requisitions,
 * store-to-store transfers, serialised assets with maintenance history, and
 * stock audits.
 */
export async function seedInventory(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const { organizationId, users, departmentsByCode } = ctx
  const actor = users.inventorymanager ?? users.admin

  // ── Classification tables ───────────────────────────────────────────────
  const categoryByCode = new Map<string, string>()
  for (const category of INVENTORY_CATEGORIES) {
    const parent = await prisma.inventoryCategory.create({
      data: { organizationId, name: category.name, code: category.code },
    })
    categoryByCode.set(category.code, parent.id)
    for (const child of category.children) {
      const sub = await prisma.inventoryCategory.create({
        data: { organizationId, parentId: parent.id, name: child.name, code: child.code },
      })
      categoryByCode.set(child.code, sub.id)
    }
  }

  const groupByCode = new Map<string, string>()
  for (const group of INVENTORY_ITEM_GROUPS) {
    const row = await prisma.inventoryItemGroup.create({
      data: { organizationId, name: group.name, code: group.code },
    })
    groupByCode.set(group.code, row.id)
  }

  const unitBySymbol = new Map<string, string>()
  for (const unit of INVENTORY_UNITS) {
    const row = await prisma.inventoryUnit.create({
      data: { organizationId, name: unit.name, symbol: unit.symbol },
    })
    unitBySymbol.set(unit.symbol, row.id)
  }

  const manufacturerByName = new Map<string, string>()
  for (const mfr of INVENTORY_MANUFACTURERS) {
    const row = await prisma.inventoryManufacturer.create({
      data: {
        organizationId,
        name: mfr.name,
        contactPerson: mfr.contactPerson,
        phone: mfr.phone,
        email: mfr.email,
        address: mfr.address,
      },
    })
    manufacturerByName.set(mfr.name, row.id)
  }

  const brandByName = new Map<string, string>()
  for (const brand of INVENTORY_BRANDS) {
    const row = await prisma.inventoryBrand.create({
      data: { organizationId, name: brand.name, manufacturerId: manufacturerByName.get(brand.manufacturer) },
    })
    brandByName.set(brand.name, row.id)
  }

  // ── Item master ─────────────────────────────────────────────────────────
  const items = new Map<string, { id: string; spec: (typeof INVENTORY_ITEMS)[number] }>()
  for (let i = 0; i < INVENTORY_ITEMS.length; i += 1) {
    const spec = INVENTORY_ITEMS[i]
    const row = await prisma.inventoryItem.create({
      data: {
        organizationId,
        categoryId: categoryByCode.get(spec.categoryCode),
        itemGroupId: groupByCode.get(spec.groupCode),
        unitId: unitBySymbol.get(spec.unitSymbol),
        manufacturerId: spec.manufacturer ? manufacturerByName.get(spec.manufacturer) : undefined,
        brandId: spec.brand ? brandByName.get(spec.brand) : undefined,
        name: spec.name,
        code: spec.code,
        description: `${spec.name} - ${spec.itemType === 'ASSET' ? 'capital equipment' : 'consumable'} stocked by the central store.`,
        itemType: spec.itemType as never,
        hsnCode: spec.hsnCode,
        gstPercent: spec.gstPercent,
        barcodeValue: `890${String(1000000 + i * 7919).slice(0, 7)}`,
        qrCodeValue: `MEDICORE|ITEM|${spec.code}`,
        trackBatch: spec.trackBatch,
        trackSerial: spec.trackSerial,
        trackExpiry: spec.trackExpiry,
        unitCost: spec.unitCost,
      },
    })
    items.set(spec.code, { id: row.id, spec })
  }

  // ── Stores ──────────────────────────────────────────────────────────────
  const storeByCode = new Map<string, string>()
  for (const store of INVENTORY_STORES) {
    const row = await prisma.inventoryStore.create({
      data: {
        organizationId,
        name: store.name,
        code: store.code,
        type: store.type as never,
        location: store.location,
      },
    })
    storeByCode.set(store.code, row.id)

    await prisma.inventoryStoreManager.create({
      data: {
        organizationId,
        storeId: row.id,
        userId: store.code === 'CENTRAL' ? actor : (users.nurse ?? actor),
        role: store.code === 'CENTRAL' ? 'MANAGER' : 'STAFF',
        assignedByUserId: users.admin ?? actor,
        assignedAt: daysAgo(int(60, 300)),
      },
    })
  }

  const centralStoreId = storeByCode.get('CENTRAL') as string

  // ── Vendors ─────────────────────────────────────────────────────────────
  const vendorByCode = new Map<string, string>()
  for (const vendor of VENDORS) {
    const row = await prisma.vendor.create({ data: { organizationId, ...vendor } })
    vendorByCode.set(vendor.code, row.id)

    // Several rating events each, so the computed average is meaningful.
    for (let r = 0; r < int(2, 3); r += 1) {
      await prisma.vendorRating.create({
        data: {
          organizationId,
          vendorId: row.id,
          rating: int(3, 5),
          comments: pick([
            'Delivered on schedule, documentation in order.',
            'Good quality supply, minor delay in dispatch.',
            'Responsive to queries; pricing competitive.',
            'Partial shipment received against the order.',
          ]),
          ratedByUserId: actor,
          ratedAt: daysAgo(int(15, 200)),
        },
      })
    }
  }

  // ── Stock per store, with batches where the item tracks them ────────────
  // Consumables are stocked across the operational stores; assets sit in the
  // biomedical store.
  const consumableStores = ['CENTRAL', 'ICUST', 'OTST', 'EMRGST', 'LABST', 'HKST']

  for (const [code, item] of items) {
    const stores = item.spec.itemType === 'ASSET'
      ? ['BIOMEDST']
      : pickMany(consumableStores, item.spec.groupCode === 'FAST' ? int(3, 5) : int(1, 3))

    for (const storeCode of stores) {
      const storeId = storeByCode.get(storeCode)
      if (!storeId) continue

      const isCentral = storeCode === 'CENTRAL'
      // A slice of items sits below its reorder level, so the low-stock
      // report and reorder alerts have genuine rows.
      const belowReorder = rnd() < 0.2
      const baseline = item.spec.itemType === 'ASSET'
        ? int(2, 12)
        : isCentral ? item.spec.maxStock / 2 : item.spec.reorderLevel
      const currentStock = belowReorder
        ? Math.max(1, Math.round(item.spec.reorderLevel * (0.2 + rnd() * 0.5)))
        : Math.round(baseline * (0.8 + rnd() * 0.6))

      const damagedStock = chance(0.15) ? int(1, 8) : 0
      const expiredStock = item.spec.trackExpiry && chance(0.12) ? int(1, 12) : 0
      const lostStock = chance(0.06) ? int(1, 4) : 0
      const reservedStock = chance(0.2) ? int(1, Math.max(1, Math.round(currentStock * 0.05))) : 0
      const openingStock = Math.round(currentStock * 0.6)
      const openingStockDate = daysAgo(int(90, 300))

      const stock = await prisma.inventoryStock.create({
        data: {
          organizationId,
          itemId: item.id,
          storeId,
          currentStock,
          reservedStock,
          damagedStock,
          expiredStock,
          lostStock,
          reorderLevel: isCentral ? item.spec.reorderLevel : Math.round(item.spec.reorderLevel / 4),
          minStock: isCentral ? item.spec.minStock : Math.round(item.spec.minStock / 4),
          maxStock: isCentral ? item.spec.maxStock : Math.round(item.spec.maxStock / 4),
          openingStock,
          openingStockDate,
        },
      })

      // The opening balance is itself a ledger entry, so every number on the
      // stock row traces back to a recorded movement.
      await prisma.inventoryStockAdjustment.create({
        data: {
          organizationId,
          itemId: item.id,
          storeId,
          type: 'OPENING',
          quantityDelta: openingStock,
          reason: 'Opening balance carried forward at go-live.',
          adjustedByUserId: actor,
          adjustedAt: openingStockDate,
        },
      })

      if (item.spec.trackBatch || item.spec.trackExpiry) {
        // Split the holding across batches with staggered expiries -
        // including, for a few items, one that has already expired.
        const batchCount = int(1, 3)
        let remaining = currentStock
        for (let b = 0; b < batchCount; b += 1) {
          const isLast = b === batchCount - 1
          const quantity = isLast ? remaining : Math.max(1, Math.round(remaining / (batchCount - b)))
          remaining -= quantity
          if (quantity <= 0) continue

          const expiryRoll = rnd()
          const expiryDate = !item.spec.trackExpiry
            ? null
            : expiryRoll < 0.1
              ? daysAgo(int(5, 60))
              : expiryRoll < 0.25
                ? daysFromNow(int(10, 80))
                : daysFromNow(int(180, 900))

          const expired = expiryDate != null && expiryDate < new Date()

          await prisma.inventoryBatch.create({
            data: {
              organizationId,
              itemId: item.id,
              storeId,
              inventoryStockId: stock.id,
              batchNumber: item.spec.trackBatch ? `${code}-B${YEAR % 100}${String(100 + b * 17)}` : null,
              manufactureDate: expiryDate ? daysAgo(int(120, 400)) : null,
              expiryDate,
              quantity,
              status: (expired ? 'EXPIRED' : 'AVAILABLE') as never,
              receivedAt: daysAgo(int(20, 180)),
            },
          })
        }
      }

      // Some correction/damage entries, so the ledger reads like a real one
      // rather than only opening balances.
      if (chance(0.25)) {
        const type = pick(['DAMAGE', 'CORRECTION', 'ISSUE', 'EXPIRY'])
        await prisma.inventoryStockAdjustment.create({
          data: {
            organizationId,
            itemId: item.id,
            storeId,
            type: type as never,
            quantityDelta: type === 'CORRECTION' ? int(1, 10) : -int(1, 10),
            reason: type === 'DAMAGE'
              ? 'Packaging damaged in transit - written off.'
              : type === 'EXPIRY'
                ? 'Batch crossed expiry and was removed from usable stock.'
                : type === 'ISSUE'
                  ? 'Issued against a ward requisition.'
                  : 'Physical count correction after shelf verification.',
            adjustedByUserId: actor,
            adjustedAt: daysAgo(int(1, 60)),
          },
        })
      }
    }
  }

  const itemList = [...items.values()]
  const consumables = itemList.filter((i) => i.spec.itemType === 'CONSUMABLE')
  const assets = itemList.filter((i) => i.spec.itemType === 'ASSET')

  // ── Purchase Request → Purchase Order → GRN → Vendor Invoice ───────────
  for (let p = 0; p < 8; p += 1) {
    const requestLines = pickMany(consumables, int(2, 5))
    const prStatus = p < 2 ? 'SUBMITTED' : p < 3 ? 'REJECTED' : p < 4 ? 'APPROVED' : 'CONVERTED'
    const decided = prStatus !== 'SUBMITTED'
    const createdAt = daysAgo(int(10, 90))

    const purchaseRequest = await prisma.purchaseRequest.create({
      data: {
        organizationId,
        requestNumber: docNumber('PR'),
        storeId: centralStoreId,
        requestedByUserId: actor,
        status: prStatus as never,
        notes: 'Replenishment against consumption over the last month.',
        approvedByUserId: decided && prStatus !== 'REJECTED' ? users.admin : null,
        approvedAt: decided && prStatus !== 'REJECTED' ? createdAt : null,
        rejectionReason: prStatus === 'REJECTED' ? 'Sufficient stock already available in the central store.' : null,
        createdAt,
        items: {
          create: requestLines.map((line) => ({
            itemId: line.id,
            quantity: Math.max(10, Math.round(line.spec.reorderLevel * (0.5 + rnd()))),
            notes: 'As per the reorder level.',
          })),
        },
      },
      include: { items: true },
    })

    if (prStatus !== 'CONVERTED') continue

    // ── Purchase order raised from the approved request ───────────────────
    const vendorId = vendorByCode.get(pick(VENDORS).code) as string
    // Most POs are fully received; some are still open or part-received.
    const poRoll = rnd()
    const poStatus = poRoll < 0.55
      ? 'RECEIVED'
      : poRoll < 0.75 ? 'PARTIALLY_RECEIVED' : poRoll < 0.9 ? 'SENT' : 'APPROVED'
    const poCreatedAt = daysAgo(int(5, 60))

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        organizationId,
        poNumber: docNumber('PO'),
        vendorId,
        storeId: centralStoreId,
        purchaseRequestId: purchaseRequest.id,
        status: poStatus as never,
        expectedDeliveryDate: daysFromNow(int(-20, 15)),
        approvedByUserId: users.admin,
        approvedAt: poCreatedAt,
        notes: 'Rates as per the annual supply agreement.',
        createdAt: poCreatedAt,
        items: {
          create: purchaseRequest.items.map((line) => {
            const spec = itemList.find((i) => i.id === line.itemId)?.spec
            return {
              itemId: line.itemId,
              quantityOrdered: line.quantity,
              quantityReceived: 0,
              unitPrice: spec?.unitCost ?? 0,
              taxPercent: spec?.gstPercent ?? 0,
            }
          }),
        },
      },
      include: { items: true },
    })

    if (poStatus !== 'RECEIVED' && poStatus !== 'PARTIALLY_RECEIVED') continue

    // ── Goods receipt ─────────────────────────────────────────────────────
    const receivedAt = daysAgo(int(1, 20))
    const grn = await prisma.goodsReceiptNote.create({
      data: {
        organizationId,
        grnNumber: docNumber('GRN'),
        purchaseOrderId: purchaseOrder.id,
        vendorId,
        storeId: centralStoreId,
        receivedByUserId: actor,
        status: 'COMPLETED',
        receivedAt,
        notes: 'Physical count verified against the delivery challan.',
        createdAt: receivedAt,
      },
    })

    let invoiceBase = 0
    let invoiceTax = 0

    for (const poItem of purchaseOrder.items) {
      const quantityReceived = poStatus === 'RECEIVED'
        ? poItem.quantityOrdered
        : Math.max(1, Math.round(poItem.quantityOrdered * 0.6))
      const spec = itemList.find((i) => i.id === poItem.itemId)?.spec
      const unitPrice = Number(poItem.unitPrice)

      invoiceBase += unitPrice * quantityReceived
      invoiceTax += (unitPrice * quantityReceived * Number(poItem.taxPercent)) / 100

      await prisma.goodsReceiptItem.create({
        data: {
          goodsReceiptNoteId: grn.id,
          purchaseOrderItemId: poItem.id,
          itemId: poItem.itemId,
          quantityReceived,
          batchNumber: spec?.trackBatch ? `GRN-${YEAR % 100}${int(1000, 9999)}` : null,
          manufactureDate: spec?.trackExpiry ? daysAgo(int(30, 200)) : null,
          expiryDate: spec?.trackExpiry ? daysFromNow(int(180, 800)) : null,
          unitPrice,
        },
      })

      await prisma.purchaseOrderItem.update({ where: { id: poItem.id }, data: { quantityReceived } })

      // Receiving stock is a ledger movement like any other.
      await prisma.inventoryStockAdjustment.create({
        data: {
          organizationId,
          itemId: poItem.itemId,
          storeId: centralStoreId,
          type: 'RECEIPT',
          quantityDelta: quantityReceived,
          reason: `Received against ${grn.grnNumber}.`,
          referenceType: 'GRN',
          referenceId: grn.id,
          adjustedByUserId: actor,
          adjustedAt: receivedAt,
        },
      })
    }

    // ── Vendor invoice against the receipt ────────────────────────────────
    const amount = money(invoiceBase)
    const taxAmount = money(invoiceTax)
    const totalAmount = money(amount + taxAmount)
    const invoiceStatus = pick(['PENDING', 'VERIFIED', 'PAID', 'PAID', 'DISPUTED'])

    await prisma.vendorInvoice.create({
      data: {
        organizationId,
        invoiceNumber: `VINV-${YEAR}-${int(10000, 99999)}`,
        vendorId,
        purchaseOrderId: purchaseOrder.id,
        goodsReceiptNoteId: grn.id,
        invoiceDate: receivedAt,
        dueDate: daysFromNow(int(-10, 30)),
        amount,
        taxAmount,
        totalAmount,
        paidAmount: invoiceStatus === 'PAID' ? totalAmount : 0,
        status: invoiceStatus as never,
        notes: invoiceStatus === 'DISPUTED'
          ? 'Rate mismatch against the purchase order - under discussion with the vendor.'
          : null,
        createdAt: receivedAt,
      },
    })

    // Occasionally something goes back to the vendor.
    if (chance(0.25)) {
      await prisma.vendorReturn.create({
        data: {
          organizationId,
          returnNumber: docNumber('VRTN'),
          vendorId,
          goodsReceiptNoteId: grn.id,
          storeId: centralStoreId,
          reason: pick([
            'Damaged packaging on receipt',
            'Short shelf life at delivery',
            'Item supplied does not match the specification',
          ]),
          status: pick(['DRAFT', 'SENT', 'ACKNOWLEDGED']) as never,
          returnedByUserId: actor,
          createdAt: daysAgo(int(1, 15)),
          items: {
            create: pickMany(purchaseOrder.items, 1).map((line) => ({
              itemId: line.itemId,
              quantity: int(1, 10),
              unitPrice: Number(line.unitPrice),
            })),
          },
        },
      })
    }
  }

  // ── Internal store requisitions (demand-initiated, need approval) ──────
  const requestingStores = ['ICUST', 'OTST', 'EMRGST', 'LABST', 'HKST']
  for (let r = 0; r < 10; r += 1) {
    const toStoreCode = pick(requestingStores)
    const toStoreId = storeByCode.get(toStoreCode)
    if (!toStoreId) continue

    const status = pick(['REQUESTED', 'REQUESTED', 'APPROVED', 'ISSUED', 'RECEIVED', 'PARTIALLY_ISSUED', 'REJECTED'])
    const approved = ['APPROVED', 'ISSUED', 'RECEIVED', 'PARTIALLY_ISSUED'].includes(status)
    const issued = ['ISSUED', 'RECEIVED', 'PARTIALLY_ISSUED'].includes(status)
    const received = status === 'RECEIVED'
    const createdAt = daysAgo(int(1, 30))

    await prisma.storeRequisition.create({
      data: {
        organizationId,
        requisitionNumber: docNumber('REQ'),
        fromStoreId: centralStoreId,
        toStoreId,
        requestedByUserId: users.nurse ?? actor,
        status: status as never,
        priority: (chance(0.2) ? 'URGENT' : 'ROUTINE') as never,
        notes: `Routine indent for ${toStoreCode}.`,
        approvedByUserId: approved ? actor : null,
        approvedAt: approved ? createdAt : null,
        rejectionReason: status === 'REJECTED'
          ? 'Requested quantity exceeds the monthly allotment for this store.'
          : null,
        issuedByUserId: issued ? actor : null,
        issuedAt: issued ? createdAt : null,
        receivedByUserId: received ? (users.nurse ?? actor) : null,
        receivedAt: received ? createdAt : null,
        createdAt,
        items: {
          create: pickMany(consumables, int(2, 4)).map((line) => {
            const quantityRequested = int(10, 200)
            const quantityIssued = issued
              ? status === 'PARTIALLY_ISSUED' ? Math.round(quantityRequested * 0.5) : quantityRequested
              : 0
            return {
              itemId: line.id,
              quantityRequested,
              quantityIssued,
              quantityReceived: received ? quantityIssued : 0,
            }
          }),
        },
      },
    })
  }

  // ── Store-to-store transfers (supply-initiated, no approval step) ──────
  for (let t = 0; t < 4; t += 1) {
    const toStoreId = storeByCode.get(pick(requestingStores))
    if (!toStoreId) continue
    const status = pick(['DRAFT', 'IN_TRANSIT', 'COMPLETED', 'COMPLETED'])
    const dispatched = status !== 'DRAFT'
    const completed = status === 'COMPLETED'
    const createdAt = daysAgo(int(1, 25))

    await prisma.inventoryStockTransfer.create({
      data: {
        organizationId,
        transferNumber: docNumber('TRF'),
        fromStoreId: centralStoreId,
        toStoreId,
        status: status as never,
        requestedByUserId: actor,
        dispatchedByUserId: dispatched ? actor : null,
        dispatchedAt: dispatched ? createdAt : null,
        receivedByUserId: completed ? (users.nurse ?? actor) : null,
        receivedAt: completed ? createdAt : null,
        notes: 'Proactive rebalancing of fast-moving stock.',
        createdAt,
        items: {
          create: pickMany(consumables, int(1, 3)).map((line) => ({ itemId: line.id, quantity: int(20, 150) })),
        },
      },
    })
  }

  // ── Serialised assets, with maintenance and assignment history ─────────
  const biomedStoreId = storeByCode.get('BIOMEDST') as string
  const departmentIds = [...departmentsByCode.values()]
  const amcVendorId = vendorByCode.get('VEN-BIOMED') as string
  let assetSeq = 0

  for (const asset of assets) {
    const unitsOwned = asset.spec.code === 'AST-VENT' ? 4 : asset.spec.code === 'AST-ECG' ? 3 : int(4, 9)

    for (let u = 0; u < unitsOwned; u += 1) {
      assetSeq += 1
      const purchaseDate = daysAgo(int(200, 1500))
      const statusRoll = rnd()
      const status = statusRoll < 0.62
        ? 'IN_USE'
        : statusRoll < 0.78
          ? 'IN_STORE'
          : statusRoll < 0.88
            ? 'UNDER_MAINTENANCE'
            : statusRoll < 0.95 ? 'BREAKDOWN' : 'DECOMMISSIONED'

      const inUse = status === 'IN_USE'
      const departmentId = pick(departmentIds)

      const assetRow = await prisma.asset.create({
        data: {
          organizationId,
          itemId: asset.id,
          storeId: biomedStoreId,
          assetTag: `AST-${YEAR}-${String(assetSeq).padStart(4, '0')}`,
          serialNumber: `SN${asset.spec.code.slice(-4)}${String(10000 + assetSeq * 37)}`,
          status: status as never,
          purchaseDate,
          purchasePrice: asset.spec.unitCost,
          warrantyExpiryDate: daysFromNow(int(-400, 600)),
          amcVendorId,
          amcStartDate: daysAgo(int(30, 360)),
          amcEndDate: daysFromNow(int(30, 400)),
          lastCalibrationDate: daysAgo(int(30, 300)),
          // Some calibrations are overdue - the calibration-due view needs
          // both past-due and upcoming rows.
          nextCalibrationDate: daysFromNow(int(-40, 260)),
          assignedToDepartmentId: inUse ? departmentId : null,
          notes: status === 'BREAKDOWN'
            ? 'Reported non-functional by the ward; awaiting the vendor engineer.'
            : null,
          createdAt: purchaseDate,
        },
      })

      if (inUse) {
        await prisma.assetAssignment.create({
          data: {
            organizationId,
            assetId: assetRow.id,
            assignedToDepartmentId: departmentId,
            storeId: biomedStoreId,
            assignedByUserId: actor,
            assignedAt: daysAgo(int(10, 200)),
            notes: 'Issued to the department for routine clinical use.',
          },
        })
      }

      // Preventive maintenance / calibration history.
      for (let m = 0; m < int(1, 3); m += 1) {
        const completedDate = daysAgo(int(20, 400))
        await prisma.assetMaintenanceRecord.create({
          data: {
            organizationId,
            assetId: assetRow.id,
            type: pick(['PREVENTIVE', 'CALIBRATION', 'AMC']) as never,
            status: 'COMPLETED',
            scheduledDate: completedDate,
            completedDate,
            description: pick([
              'Scheduled preventive maintenance and functional check completed.',
              'Annual calibration carried out; certificate filed.',
              'AMC quarterly service visit completed.',
            ]),
            cost: chance(0.5) ? int(1500, 12000) : null,
            performedBy: 'Vendor service engineer',
            vendorId: amcVendorId,
            createdAt: completedDate,
          },
        })
      }

      if (status === 'BREAKDOWN' || status === 'UNDER_MAINTENANCE') {
        await prisma.assetMaintenanceRecord.create({
          data: {
            organizationId,
            assetId: assetRow.id,
            type: status === 'BREAKDOWN' ? 'BREAKDOWN' : 'REPAIR',
            status: status === 'BREAKDOWN' ? 'SCHEDULED' : 'IN_PROGRESS',
            scheduledDate: daysFromNow(int(1, 10)),
            description: status === 'BREAKDOWN'
              ? 'Device not powering on - vendor engineer visit requested.'
              : 'Display module replacement in progress.',
            vendorId: amcVendorId,
            createdAt: daysAgo(int(1, 10)),
          },
        })
      }

      // Upcoming preventive maintenance, so the schedule view is populated.
      if (chance(0.4)) {
        await prisma.assetMaintenanceRecord.create({
          data: {
            organizationId,
            assetId: assetRow.id,
            type: 'PREVENTIVE',
            status: 'SCHEDULED',
            scheduledDate: daysFromNow(int(3, 60)),
            description: 'Next scheduled preventive maintenance visit.',
            vendorId: amcVendorId,
            createdAt: daysAgo(int(1, 30)),
          },
        })
      }
    }
  }

  // ── Stock audits ────────────────────────────────────────────────────────
  const auditPlan = [
    { storeCode: 'CENTRAL', status: 'COMPLETED' },
    { storeCode: 'ICUST', status: 'IN_PROGRESS' },
    { storeCode: 'HKST', status: 'DRAFT' },
  ]

  for (const plan of auditPlan) {
    const storeId = storeByCode.get(plan.storeCode)
    if (!storeId) continue

    const scheduledDate = plan.status === 'DRAFT' ? daysFromNow(int(3, 20)) : daysAgo(int(2, 30))
    const audit = await prisma.stockAudit.create({
      data: {
        organizationId,
        auditNumber: docNumber('AUD'),
        storeId,
        status: plan.status as never,
        scheduledDate,
        startedAt: plan.status === 'DRAFT' ? null : scheduledDate,
        completedAt: plan.status === 'COMPLETED' ? scheduledDate : null,
        conductedByUserId: actor,
        notes: plan.status === 'COMPLETED'
          ? 'Physical verification completed; variances raised as correction entries.'
          : 'Periodic physical stock verification.',
        createdAt: daysAgo(int(5, 35)),
      },
    })

    const stockRows = await prisma.inventoryStock.findMany({ where: { organizationId, storeId }, take: 12 })
    for (const row of stockRows) {
      const counted = plan.status === 'DRAFT'
        ? null
        : chance(0.75) ? row.currentStock : Math.max(0, row.currentStock - int(1, 15))
      await prisma.stockAuditItem.create({
        data: {
          stockAuditId: audit.id,
          itemId: row.itemId,
          systemQuantity: row.currentStock,
          countedQuantity: counted,
          varianceQuantity: counted == null ? null : counted - row.currentStock,
          remarks: counted != null && counted !== row.currentStock
            ? 'Variance noted; recount confirmed the physical figure.'
            : null,
        },
      })
    }
  }
}
