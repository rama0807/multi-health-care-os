import { Prisma } from '@prisma/client'

/**
 * Sequential document numbering shared by every inventory sub-workflow
 * (transfers, PR, PO, GRN, vendor returns, requisitions, audits) - same
 * advisory-lock + year-counter idiom as `DispenseOrder`/`Appointment`/
 * `LabTest` numbering elsewhere in this codebase.
 */
export async function generateInventoryNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
  lockKey: string,
  prefix: string,
  countQuery: () => Promise<number>,
): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId} || ${':' + lockKey})::bigint)`
  const year = new Date().getFullYear()
  const count = await countQuery()
  return `${prefix}-${year}-${String(count + 1).padStart(6, '0')}`
}

export function yearStart(): Date {
  return new Date(Date.UTC(new Date().getFullYear(), 0, 1))
}
