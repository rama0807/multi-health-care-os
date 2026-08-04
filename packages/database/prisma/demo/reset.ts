import { PrismaClient } from '@prisma/client'

/**
 * Removes every row the demo seed creates, scoped to one organization, so
 * `db:seed:demo` is re-runnable rather than accumulating duplicates or
 * tripping unique constraints on a second run.
 *
 * Deletion order is FK-dependency order (children before parents). Where a
 * child cascades from its parent it is not listed separately; where the
 * relation is a plain restrict FK (e.g. `DispenseItem.prescriptionItemId`,
 * `GoodsReceiptItem.purchaseOrderItemId`) the parent's delete is sequenced
 * after the dependant's.
 *
 * Deliberately NOT deleted — these belong to the base seed (`seed.ts`) and
 * are upserted rather than recreated: permissions, roles, users,
 * organizations, hospitals, departments, and doctor profiles.
 */
export async function resetDemoData(prisma: PrismaClient, organizationId: string): Promise<void> {
  const org = { organizationId }

  // ── Inventory & procurement ─────────────────────────────────────────────
  // Audits/assets first (they reference items, stores, batches and vendors).
  await prisma.stockAuditItem.deleteMany({ where: { stockAudit: { organizationId } } })
  await prisma.stockAudit.deleteMany({ where: org })
  await prisma.assetAssignment.deleteMany({ where: org })
  await prisma.assetMaintenanceRecord.deleteMany({ where: org })
  await prisma.asset.deleteMany({ where: org })

  await prisma.storeRequisitionItem.deleteMany({ where: { storeRequisition: { organizationId } } })
  await prisma.storeRequisition.deleteMany({ where: org })

  await prisma.inventoryStockTransferItem.deleteMany({ where: { transfer: { organizationId } } })
  await prisma.inventoryStockTransfer.deleteMany({ where: org })

  await prisma.vendorReturnItem.deleteMany({ where: { vendorReturn: { organizationId } } })
  await prisma.vendorReturn.deleteMany({ where: org })

  // Vendor invoices reference both the PO and the GRN — clear them first.
  await prisma.vendorInvoice.deleteMany({ where: org })
  await prisma.goodsReceiptItem.deleteMany({ where: { goodsReceiptNote: { organizationId } } })
  await prisma.goodsReceiptNote.deleteMany({ where: org })
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { organizationId } } })
  await prisma.purchaseOrder.deleteMany({ where: org })
  await prisma.purchaseRequestItem.deleteMany({ where: { purchaseRequest: { organizationId } } })
  await prisma.purchaseRequest.deleteMany({ where: org })

  await prisma.inventoryStockAdjustment.deleteMany({ where: org })
  await prisma.inventoryBatch.deleteMany({ where: org })
  await prisma.inventoryStock.deleteMany({ where: org })

  await prisma.vendorRating.deleteMany({ where: org })
  await prisma.vendor.deleteMany({ where: org })
  await prisma.inventoryStoreManager.deleteMany({ where: org })
  await prisma.inventoryStore.deleteMany({ where: org })

  await prisma.inventoryItem.deleteMany({ where: org })
  await prisma.inventoryBrand.deleteMany({ where: org })
  await prisma.inventoryManufacturer.deleteMany({ where: org })
  await prisma.inventoryUnit.deleteMany({ where: org })
  await prisma.inventoryItemGroup.deleteMany({ where: org })
  // Subcategories reference their parent through the self-relation.
  await prisma.inventoryCategory.deleteMany({ where: { organizationId, parentId: { not: null } } })
  await prisma.inventoryCategory.deleteMany({ where: org })

  // ── Insurance ───────────────────────────────────────────────────────────
  await prisma.claimDocument.deleteMany({ where: org })
  await prisma.insuranceClaim.deleteMany({ where: org })
  await prisma.preAuthAttachment.deleteMany({ where: { preAuthorization: { organizationId } } })
  await prisma.preAuthorization.deleteMany({ where: org })

  // ── IPD (admissions and everything hanging off them) ────────────────────
  await prisma.dischargeSummary.deleteMany({ where: org })
  await prisma.dischargeChecklistItem.deleteMany({ where: org })
  await prisma.medicationAdministration.deleteMany({ where: org })
  await prisma.nursingTask.deleteMany({ where: org })
  await prisma.ipdOrder.deleteMany({ where: org })
  await prisma.intakeOutputRecord.deleteMany({ where: org })
  await prisma.nursingAssessment.deleteMany({ where: org })
  await prisma.nursingNote.deleteMany({ where: org })
  await prisma.bedTransfer.deleteMany({ where: org })
  await prisma.bedAllocation.deleteMany({ where: org })
  await prisma.admission.deleteMany({ where: org })

  // `PatientInsurance` is referenced by admissions/claims/pre-auths above.
  await prisma.patientInsurance.deleteMany({ where: org })
  await prisma.insurancePlan.deleteMany({ where: org })
  await prisma.insuranceProvider.deleteMany({ where: org })

  // ── Billing ─────────────────────────────────────────────────────────────
  await prisma.refund.deleteMany({ where: org })
  await prisma.payment.deleteMany({ where: org })
  await prisma.charge.deleteMany({ where: org })
  await prisma.invoiceItem.deleteMany({ where: { invoice: { organizationId } } })
  await prisma.invoice.deleteMany({ where: org })
  await prisma.serviceCatalogItem.deleteMany({ where: org })

  // ── Pharmacy ────────────────────────────────────────────────────────────
  // `DrugReturn` restricts on `DispenseItem`; `DispenseItem` restricts on
  // `PrescriptionItem` — so both go before prescriptions are touched.
  await prisma.drugReturn.deleteMany({ where: org })
  await prisma.dispenseItem.deleteMany({ where: { dispenseOrder: { organizationId } } })
  await prisma.dispenseOrder.deleteMany({ where: org })
  await prisma.drug.deleteMany({ where: org })

  // ── Diagnostics ─────────────────────────────────────────────────────────
  await prisma.radiologyAttachment.deleteMany({ where: org })
  await prisma.radiologyReport.deleteMany({ where: { radiologyOrder: { organizationId } } })
  await prisma.radiologyOrder.deleteMany({ where: org })
  await prisma.radiologyCatalogItem.deleteMany({ where: org })

  await prisma.labTestItem.deleteMany({ where: { labTest: { organizationId } } })
  await prisma.labTest.deleteMany({ where: org })
  await prisma.labTestCatalogItem.deleteMany({ where: org })

  // ── EMR ─────────────────────────────────────────────────────────────────
  await prisma.prescriptionItem.deleteMany({ where: { prescription: { organizationId } } })
  await prisma.prescription.deleteMany({ where: org })

  await prisma.encounterAttachment.deleteMany({ where: org })
  await prisma.procedure.deleteMany({ where: { encounter: { organizationId } } })
  await prisma.diagnosis.deleteMany({ where: { encounter: { organizationId } } })
  await prisma.vital.deleteMany({ where: { encounter: { organizationId } } })
  await prisma.clinicalNote.deleteMany({ where: { encounter: { organizationId } } })
  await prisma.encounter.deleteMany({ where: org })

  await prisma.appointment.deleteMany({ where: org })

  // ── Ward / room / bed inventory ─────────────────────────────────────────
  await prisma.bed.deleteMany({ where: org })
  await prisma.room.deleteMany({ where: org })
  await prisma.ward.deleteMany({ where: org })

  // ── Patients & notifications ────────────────────────────────────────────
  await prisma.patientDocument.deleteMany({ where: org })
  await prisma.notification.deleteMany({ where: org })
  await prisma.patient.deleteMany({ where: org })

  // ── Doctor scheduling (profiles themselves are upserted, not deleted) ───
  await prisma.doctorScheduleDay.deleteMany({ where: { schedule: { organizationId } } })
  await prisma.doctorSchedule.deleteMany({ where: org })
  await prisma.doctorLeave.deleteMany({ where: org })
}
