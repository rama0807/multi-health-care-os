import { InvoiceStatus, PaymentMode } from './enums'

export interface Invoice {
  id: string
  invoiceNumber: string
  patientId: string
  appointmentId: string | null
  organizationId: string
  status: InvoiceStatus
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  balanceDue: number
  currency: string
  notes: string | null
  dueDate: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface InvoiceItem {
  id: string
  invoiceId: string
  itemName: string
  itemCode: string | null
  category: string
  quantity: number
  unitPrice: number
  discountPercent: number
  taxPercent: number
  totalPrice: number
}

export interface Payment {
  id: string
  paymentNumber: string
  invoiceId: string
  patientId: string
  organizationId: string
  amount: number
  paymentMode: PaymentMode
  transactionId: string | null
  referenceNumber: string | null
  status: string
  collectedBy: string | null
  paidAt: Date
  createdAt: Date
}
