import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await prisma.$transaction(async (tx: any) => {
      const reservation = await tx.reservation.findUnique({
        where: { id },
      })

      if (!reservation) throw new Error('NOT_FOUND')
      if (reservation.status !== 'pending') throw new Error('NOT_PENDING')

      await tx.stock.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
        data: {
          reserved: { decrement: reservation.quantity },
        },
      })

      return await tx.reservation.update({
        where: { id },
        data: { status: 'released' },
      })
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }
    if (error.message === 'NOT_PENDING') {
      return NextResponse.json({ error: 'Reservation is not pending' }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to release reservation' }, { status: 500 })
  }
}