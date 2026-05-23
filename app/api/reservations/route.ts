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

    // This is the race condition fix
    // We use a transaction + raw SQL SELECT FOR UPDATE
    // This locks the stock row so only one request can proceed at a time
    const reservation = await prisma.$transaction(async (tx) => {
      // Lock the stock row for this product+warehouse
      const stocks = await tx.$queryRaw
        { id: string; total: number; reserved: number }[]
      >`
        SELECT id, total, reserved 
        FROM "Stock" 
        WHERE "productId" = ${productId} 
        AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `

      const stock = stocks[0]

      if (!stock) {
        throw new Error('STOCK_NOT_FOUND')
      }

      const available = stock.total - stock.reserved

      if (available < quantity) {
        throw new Error('INSUFFICIENT_STOCK')
      }

      // Increment reserved count
      await tx.stock.update({
        where: { id: stock.id },
        data: { reserved: { increment: quantity } },
      })

      // Create reservation with 10 min expiry
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

      const newReservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: 'pending',
          expiresAt,
        },
      })

      return newReservation
    })

    return NextResponse.json(reservation, { status: 201 })
  } catch (error: any) {
    if (error.message === 'INSUFFICIENT_STOCK') {
      return NextResponse.json(
        { error: 'Not enough stock available' },
        { status: 409 }
      )
    }
    if (error.message === 'STOCK_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Stock not found for this product and warehouse' },
        { status: 404 }
      )
    }
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to create reservation' },
      { status: 500 }
    )
  }
}