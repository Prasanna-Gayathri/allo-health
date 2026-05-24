import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    })
    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }
    return NextResponse.json(reservation)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch reservation' }, { status: 500 })
  }
}