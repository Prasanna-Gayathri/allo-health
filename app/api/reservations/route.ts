import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const ReserveSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number().int().positive(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = ReserveSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { productId, warehouseId, quantity } = parsed.data

    const reservation = await prisma.$transaction(async (tx) => {
      const stocks = await tx.$queryRawUnsafe(
        `SELECT id, total, reserved FROM "Stock" WHERE "productId" = $1 AND "warehouseId" = $2 FOR UPDATE`,
        productId,
        warehouseId
      ) as { id: string; total: number; reserved: number }[]

      const stock = stocks[0]
      if (!stock) throw new Error('STOCK_NOT_FOUND')

      const available = stock.total - stock.reserved
      if (available < quantity) throw new Error('INSUFFICIENT_STOCK')

      await tx.stock.update({
        where: { id: stock.id },
        data: { reserved: { increment: quantity } },
      })

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

      return await tx.reservation.create({
        data: { productId, warehouseId, quantity, status: 'pending', expiresAt },
      })
    })

    return NextResponse.json(reservation, { status: 201 })
  } catch (error: any) {
    if (error.message === 'INSUFFICIENT_STOCK') {
      return NextResponse.json({ error: 'Not enough stock available' }, { status: 409 })
    }
    if (error.message === 'STOCK_NOT_FOUND') {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 })
  }
}