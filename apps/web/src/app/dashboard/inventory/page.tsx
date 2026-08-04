'use client'

import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  ClipboardList,
  FileText,
  IndianRupee,
  PackageX,
  ReceiptText,
  ShoppingCart,
  Tags,
  Truck,
  Warehouse,
  Wrench,
} from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { getInventoryDashboardStats } from '@/lib/api/inventory'
import { useAuth } from '@/lib/auth/auth-context'

export default function InventoryDashboardPage() {
  const { hasPermission } = useAuth()
  const canManageItems = hasPermission('inventory.items.create')
  const canReadStores = hasPermission('inventory.stores.read')
  const canReadStock = hasPermission('inventory.stock.read')
  const canReadVendors = hasPermission('inventory.vendors.read')
  const canReadProcurement = hasPermission('inventory.procurement.read')
  const canReadRequests = hasPermission('inventory.requests.read')
  const canReadAudit = hasPermission('inventory.audit.read')
  const canReadAssets = hasPermission('inventory.assets.read')

  const statsQuery = useQuery({ queryKey: ['inventory', 'dashboard-stats'], queryFn: getInventoryDashboardStats })
  const stats = statsQuery.data

  const tiles = [
    { key: 'totalItems', label: 'Active items', icon: Boxes, value: stats?.totalItems },
    { key: 'totalStores', label: 'Stores', icon: Warehouse, value: stats?.totalStores },
    {
      key: 'inventoryValue',
      label: 'Inventory value',
      icon: IndianRupee,
      value: stats ? `₹${Number(stats.inventoryValue).toLocaleString('en-IN')}` : undefined,
    },
    { key: 'lowStockCount', label: 'Low stock', icon: AlertTriangle, value: stats?.lowStockCount },
    { key: 'expiringSoonCount', label: 'Expiring soon', icon: CalendarClock, value: stats?.expiringSoonCount },
    { key: 'expiredCount', label: 'Expired', icon: PackageX, value: stats?.expiredCount },
    {
      key: 'pendingPurchaseRequests',
      label: 'Pending purchase requests',
      icon: ClipboardList,
      value: stats?.pendingPurchaseRequests,
    },
    { key: 'pendingPurchaseOrders', label: 'Pending purchase orders', icon: ShoppingCart, value: stats?.pendingPurchaseOrders },
    { key: 'pendingGrns', label: 'Pending goods receipts', icon: Truck, value: stats?.pendingGrns },
    { key: 'pendingRequisitions', label: 'Pending requisitions', icon: ClipboardList, value: stats?.pendingRequisitions },
    { key: 'maintenanceDueCount', label: 'Maintenance due', icon: Wrench, value: stats?.maintenanceDueCount },
    { key: 'assetsInBreakdown', label: 'Assets in breakdown', icon: AlertTriangle, value: stats?.assetsInBreakdown },
  ] as const

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">Equipment, consumables, and supplies — item master, stock, and procurement.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/inventory/items">
              <Boxes className="h-4 w-4" />
              Items
            </Link>
          </Button>
          {canManageItems && (
            <Button asChild variant="outline">
              <Link href="/dashboard/inventory/lookups">
                <Tags className="h-4 w-4" />
                Categories & lookups
              </Link>
            </Button>
          )}
          {canReadStores && (
            <Button asChild variant="outline">
              <Link href="/dashboard/inventory/stores">
                <Warehouse className="h-4 w-4" />
                Stores
              </Link>
            </Button>
          )}
          {canReadStock && (
            <Button asChild variant="outline">
              <Link href="/dashboard/inventory/stock">
                <Boxes className="h-4 w-4" />
                Stock
              </Link>
            </Button>
          )}
          {canReadVendors && (
            <Button asChild variant="outline">
              <Link href="/dashboard/inventory/vendors">
                <Truck className="h-4 w-4" />
                Vendors
              </Link>
            </Button>
          )}
          {canReadProcurement && (
            <>
              <Button asChild variant="outline">
                <Link href="/dashboard/inventory/purchase-requests">
                  <ClipboardList className="h-4 w-4" />
                  Purchase requests
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/inventory/purchase-orders">
                  <ShoppingCart className="h-4 w-4" />
                  Purchase orders
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/inventory/grn">
                  <FileText className="h-4 w-4" />
                  Goods receipt
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/inventory/vendor-invoices">
                  <ReceiptText className="h-4 w-4" />
                  Vendor invoices
                </Link>
              </Button>
            </>
          )}
          {canReadRequests && (
            <Button asChild variant="outline">
              <Link href="/dashboard/inventory/requisitions">
                <ClipboardList className="h-4 w-4" />
                Requisitions
              </Link>
            </Button>
          )}
          {canReadAudit && (
            <Button asChild variant="outline">
              <Link href="/dashboard/inventory/audits">
                <ClipboardList className="h-4 w-4" />
                Stock audits
              </Link>
            </Button>
          )}
          {canReadAssets && (
            <Button asChild variant="outline">
              <Link href="/dashboard/inventory/assets">
                <Wrench className="h-4 w-4" />
                Assets
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <tile.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{statsQuery.isLoading ? '—' : (tile.value ?? 0)}</p>
              <p className="text-xs text-muted-foreground">{tile.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
