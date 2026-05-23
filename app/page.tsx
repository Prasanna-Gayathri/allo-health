'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Toaster } from '@/components/ui/sonner'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface Stock {
  warehouseId: string
  warehouseName: string
  warehouseLocation: string
  total: number
  reserved: number
  available: number
}

interface Product {
  id: string
  name: string
  description: string
  imageUrl: string
  stocks: Stock[]
}

export default function Home() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [reserving, setReserving] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        setProducts(data)
        setLoading(false)
      })
      .catch(() => {
        toast.error('Failed to load products')
        setLoading(false)
      })
  }, [])

  const handleReserve = async (productId: string, warehouseId: string) => {
    setReserving(`${productId}-${warehouseId}`)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      })

      const data = await res.json()

      if (res.status === 409) {
        toast.error('Not enough stock available!')
        return
      }

      if (!res.ok) {
        toast.error(data.error || 'Failed to reserve')
        return
      }

      toast.success('Reserved! Redirecting to checkout...')
      router.push(`/reservation/${data.id}`)
    } catch (error) {
      toast.error('Something went wrong')
    } finally {
      setReserving(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading products...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <Toaster />
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Allo Inventory</h1>
        <p className="text-gray-500 mb-8">Browse and reserve products from our warehouses</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-48 object-cover"
                />
              )}
              <CardHeader>
                <CardTitle>{product.name}</CardTitle>
                <p className="text-sm text-gray-500">{product.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {product.stocks.map((stock) => (
                  <div
                    key={stock.warehouseId}
                    className="flex items-center justify-between border rounded-lg p-3"
                  >
                    <div>
                      <p className="font-medium text-sm">{stock.warehouseName}</p>
                      <p className="text-xs text-gray-400">{stock.warehouseLocation}</p>
                      <Badge
                        className="mt-1"
                        variant={stock.available > 0 ? 'default' : 'destructive'}
                      >
                        {stock.available > 0 ? `${stock.available} available` : 'Out of stock'}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      disabled={stock.available === 0 || reserving === `${product.id}-${stock.warehouseId}`}
                      onClick={() => handleReserve(product.id, stock.warehouseId)}
                    >
                      {reserving === `${product.id}-${stock.warehouseId}` ? 'Reserving...' : 'Reserve'}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}