import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const result = await prisma.$transaction(async (tx) => {
      // Find the reservation
      const reservation = await tx.reservation.findUnique({
        where: { id },
      })

      if (!reservation) {
        throw new Error('NOT_FOUND')
      }

      if (reservation.status !== 'pending') {
        throw new Error('NOT_PENDING')
      }

      // Check if reservation has expired
      if (new Date() > reservation.expiresAt) {
        // Auto release the stock
        await tx.stock.updateMany({
          where: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
          data: { reserved: { decrement: reservation.quantity } },
        })

        // Mark as released
        await tx.reservation.update({
          where: { id },
          data: { status: 'released' },
        })

        throw new Error('EXPIRED')
      }

      // Confirm — decrement total stock and reserved
      await tx.stock.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
        data: {
          total: { decrement: reservation.quantity },
          reserved: { decrement: reservation.quantity },
        },
      })

      // Update reservation status
      const confirmed = await tx.reservation.update({
        where: { id },
        data: { status: 'confirmed' },
      })

      return confirmed
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      )
    }
    if (error.message === 'EXPIRED') {
      return NextResponse.json(
        { error: 'Reservation has expired' },
        { status: 410 }
      )
    }
    if (error.message === 'NOT_PENDING') {
      return NextResponse.json(
        { error: 'Reservation is no longer pending' },
        { status: 400 }
      )
    }
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to confirm reservation' },
      { status: 500 }
    )
  }
}