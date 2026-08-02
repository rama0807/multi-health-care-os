/**
 * Pure billing math shared by charge creation and invoice totals — see
 * ADR-0015. Every money value is rounded to 2 decimal places at each step so
 * repeated addition across many line items can't drift by fractions of a
 * paisa.
 */

export interface LineItemInput {
  quantity: number
  unitPrice: number
  discountPercent: number
  taxPercent: number
}

export interface LineItemAmounts {
  grossAmount: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** gross -> item-level discount -> tax on the discounted base -> total. */
export function computeLineItemAmounts(item: LineItemInput): LineItemAmounts {
  const grossAmount = round2(item.quantity * item.unitPrice)
  const discountAmount = round2(grossAmount * (item.discountPercent / 100))
  const taxableBase = round2(grossAmount - discountAmount)
  const taxAmount = round2(taxableBase * (item.taxPercent / 100))
  const totalAmount = round2(taxableBase + taxAmount)
  return { grossAmount, discountAmount, taxAmount, totalAmount }
}

export interface InvoiceLevelDiscount {
  type: 'FLAT' | 'PERCENTAGE'
  value: number
}

export interface InvoiceTotals {
  subtotal: number
  itemDiscountAmount: number
  invoiceDiscountAmount: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
}

/**
 * Aggregates every line item, then applies an optional invoice-level
 * discount (only ever passed in when it's `APPROVED` — see
 * `InvoicesService`) on top of the post-item-discount subtotal, before tax
 * has already been computed per item.
 */
export function computeInvoiceTotals(
  items: LineItemInput[],
  invoiceLevelDiscount?: InvoiceLevelDiscount | null,
): InvoiceTotals {
  let subtotal = 0
  let itemDiscountAmount = 0
  let taxAmount = 0

  for (const item of items) {
    const amounts = computeLineItemAmounts(item)
    subtotal = round2(subtotal + amounts.grossAmount)
    itemDiscountAmount = round2(itemDiscountAmount + amounts.discountAmount)
    taxAmount = round2(taxAmount + amounts.taxAmount)
  }

  const discountableBase = round2(subtotal - itemDiscountAmount)
  let invoiceDiscountAmount = 0
  if (invoiceLevelDiscount) {
    invoiceDiscountAmount =
      invoiceLevelDiscount.type === 'FLAT'
        ? Math.min(invoiceLevelDiscount.value, discountableBase)
        : round2(discountableBase * (invoiceLevelDiscount.value / 100))
  }

  const discountAmount = round2(itemDiscountAmount + invoiceDiscountAmount)
  const totalAmount = round2(subtotal - discountAmount + taxAmount)

  return { subtotal, itemDiscountAmount, invoiceDiscountAmount, discountAmount, taxAmount, totalAmount }
}
