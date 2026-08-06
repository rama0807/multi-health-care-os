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

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
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
    <PageLayout
      title="Inventory"
      description="Equipment, consumables, and supplies - item master, stock, and procurement."
      actions={
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
      }
    >
      <StatCardGrid columns={4}>
        {tiles.map((tile) => (
          <StatCard key={tile.key} icon={tile.icon} label={tile.label} value={tile.value} loading={statsQuery.isLoading} />
        ))}
      </StatCardGrid>
    </PageLayout>
  )
}
