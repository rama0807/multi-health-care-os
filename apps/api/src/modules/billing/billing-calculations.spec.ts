import { computeInvoiceTotals, computeLineItemAmounts } from './billing-calculations'

describe('computeLineItemAmounts', () => {
  it('computes gross, discount, tax and total for a plain item', () => {
    const result = computeLineItemAmounts({ quantity: 2, unitPrice: 500, discountPercent: 0, taxPercent: 18 })
    expect(result.grossAmount).toBe(1000)
    expect(result.discountAmount).toBe(0)
    expect(result.taxAmount).toBe(180)
    expect(result.totalAmount).toBe(1180)
  })

  it('applies discount before computing tax on the discounted base', () => {
    const result = computeLineItemAmounts({ quantity: 1, unitPrice: 1000, discountPercent: 10, taxPercent: 18 })
    expect(result.grossAmount).toBe(1000)
    expect(result.discountAmount).toBe(100)
    expect(result.taxAmount).toBe(162) // (1000 - 100) * 0.18
    expect(result.totalAmount).toBe(1062)
  })

  it('handles zero tax/discount', () => {
    const result = computeLineItemAmounts({ quantity: 3, unitPrice: 100, discountPercent: 0, taxPercent: 0 })
    expect(result).toEqual({ grossAmount: 300, discountAmount: 0, taxAmount: 0, totalAmount: 300 })
  })
})

describe('computeInvoiceTotals', () => {
  it('sums multiple line items with no invoice-level discount', () => {
    const totals = computeInvoiceTotals([
      { quantity: 1, unitPrice: 800, discountPercent: 0, taxPercent: 18 },
      { quantity: 2, unitPrice: 200, discountPercent: 0, taxPercent: 5 },
    ])
    expect(totals.subtotal).toBe(1200)
    expect(totals.itemDiscountAmount).toBe(0)
    expect(totals.taxAmount).toBeCloseTo(800 * 0.18 + 400 * 0.05, 2)
    expect(totals.invoiceDiscountAmount).toBe(0)
    expect(totals.totalAmount).toBe(round(totals.subtotal + totals.taxAmount))
  })

  it('applies a flat invoice-level discount capped at the discountable base', () => {
    const totals = computeInvoiceTotals(
      [{ quantity: 1, unitPrice: 100, discountPercent: 0, taxPercent: 0 }],
      { type: 'FLAT', value: 500 },
    )
    expect(totals.subtotal).toBe(100)
    expect(totals.invoiceDiscountAmount).toBe(100) // capped, can't discount more than the base
    expect(totals.totalAmount).toBe(0)
  })

  it('applies a percentage invoice-level discount on top of item discounts', () => {
    const totals = computeInvoiceTotals(
      [{ quantity: 1, unitPrice: 1000, discountPercent: 10, taxPercent: 18 }],
      { type: 'PERCENTAGE', value: 10 },
    )
    // item discount = 100, discountable base = 900, invoice discount = 90
    expect(totals.itemDiscountAmount).toBe(100)
    expect(totals.invoiceDiscountAmount).toBe(90)
    expect(totals.discountAmount).toBe(190)
    expect(totals.taxAmount).toBe(162)
    expect(totals.totalAmount).toBe(round(1000 - 190 + 162))
  })

  it('returns zeroed totals for an empty item list', () => {
    const totals = computeInvoiceTotals([])
    expect(totals).toEqual({
      subtotal: 0,
      itemDiscountAmount: 0,
      invoiceDiscountAmount: 0,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
    })
  })
})

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
