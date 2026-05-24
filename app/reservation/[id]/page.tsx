'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Toaster } from '@/components/ui/sonner'
import { useRouter } from 'next/navigation'
import { use, useEffect, useState } from 'react'
import { toast } from 'sonner'

interface Reservation {
  id: string
  productId: string
  warehouseId: string
  quantity: number
  status: string
  expiresAt: string
}

function useCountdown(expiresAt: string) {
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      setTimeLeft(Math.max(0, diff))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  const minutes = Math.floor(timeLeft / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)
  const expired = timeLeft === 0

  return { minutes, seconds, expired }
}

export default function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    fetch(`/api/reservations/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setReservation(data)
        setLoading(false)
      })
      .catch(() => {
        toast.error('Failed to load reservation')
        setLoading(false)
      })
  }, [id])

  const { minutes, seconds, expired } = useCountdown(
    reservation?.expiresAt ?? new Date(Date.now() + 600000).toISOString()
  )

  const handleConfirm = async () => {
    setActing(true)
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, { method: 'POST' })
      const data = await res.json()
      if (res.status === 410) {
        toast.error('Reservation has expired!')
        setReservation((prev) => prev ? { ...prev, status: 'released' } : prev)
        return
      }
      if (!res.ok) { toast.error(data.error || 'Failed to confirm'); return }
      toast.success('Purchase confirmed! 🎉')
      setReservation((prev) => prev ? { ...prev, status: 'confirmed' } : prev)
    } catch { toast.error('Something went wrong') }
    finally { setActing(false) }
  }

  const handleCancel = async () => {
    setActing(true)
    try {
      const res = await fetch(`/api/reservations/${id}/release`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to cancel'); return }
      toast.success('Reservation cancelled')
      setReservation((prev) => prev ? { ...prev, status: 'released' } : prev)
    } catch { toast.error('Something went wrong') }
    finally { setActing(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 text-lg">Loading reservation...</p>
    </div>
  )

  if (!reservation) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-red-500 text-lg">Reservation not found</p>
    </div>
  )

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <Toaster />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reservation Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Status</span>
            <Badge variant={reservation.status === 'confirmed' ? 'default' : reservation.status === 'released' ? 'destructive' : 'secondary'}>
              {reservation.status.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Reservation ID</span>
            <span className="text-sm font-mono">{reservation.id.slice(0, 8)}...</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Quantity</span>
            <span className="font-medium">{reservation.quantity}</span>
          </div>

          {reservation.status === 'pending' && (
            <div className="bg-gray-100 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Time remaining</p>
              {expired ? (
                <p className="text-2xl font-bold text-red-500">Expired!</p>
              ) : (
                <p className="text-4xl font-bold text-gray-900">
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </p>
              )}
            </div>
          )}

          {reservation.status === 'confirmed' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-green-700 font-medium">✅ Purchase Confirmed!</p>
              <p className="text-green-600 text-sm mt-1">Your order has been placed successfully.</p>
            </div>
          )}

          {reservation.status === 'released' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-700 font-medium">❌ Reservation Cancelled</p>
              <p className="text-red-600 text-sm mt-1">This reservation has been released.</p>
            </div>
          )}

          {reservation.status === 'pending' && (
            <div className="flex gap-3">
              <Button className="flex-1" onClick={handleConfirm} disabled={acting || expired}>
                {acting ? 'Processing...' : 'Confirm Purchase'}
              </Button>
              <Button className="flex-1" variant="outline" onClick={handleCancel} disabled={acting}>
                Cancel
              </Button>
            </div>
          )}

          <Button variant="ghost" className="w-full" onClick={() => router.push('/')}>
            ← Back to Products
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}