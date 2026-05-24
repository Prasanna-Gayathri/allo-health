import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id },
      })

      if (!reservation) throw new Error('NOT_FOUND')
      if (reservation.status !== 'pending') throw new Error('NOT_PENDING')
      if (new Date() > reservation.expiresAt) {
        await tx.stock.updateMany({
          where: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
          data: { reserved: { decrement: reservation.quantity } },
        })
        await tx.reservation.update({
          where: { id },
          data: { status: 'released' },
        })
        throw new Error('EXPIRED')
      }

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

      return await tx.reservation.update({
        where: { id },
        data: { status: 'confirmed' },
      })
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }
    if (error.message === 'EXPIRED') {
      return NextResponse.json({ error: 'Reservation has expired' }, { status: 410 })
    }
    if (error.message === 'NOT_PENDING') {
      return NextResponse.json({ error: 'Reservation is no longer pending' }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to confirm reservation' }, { status: 500 })
  }
}