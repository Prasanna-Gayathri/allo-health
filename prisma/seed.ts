import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const warehouse1 = await prisma.warehouse.create({
    data: { name: 'Mumbai Central', location: 'Mumbai, Maharashtra' },
  })
  const warehouse2 = await prisma.warehouse.create({
    data: { name: 'Delhi North', location: 'Delhi, NCR' },
  })
  const product1 = await prisma.product.create({
    data: {
      name: 'Wireless Headphones',
      description: 'Premium noise cancelling headphones',
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
    },
  })
  const product2 = await prisma.product.create({
    data: {
      name: 'Mechanical Keyboard',
      description: 'RGB backlit mechanical keyboard',
      imageUrl: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=400',
    },
  })
  const product3 = await prisma.product.create({
    data: {
      name: 'USB-C Hub',
      description: '7-in-1 multiport USB-C hub',
      imageUrl: 'https://images.unsplash.com/photo-1625895197185-efcec01cffe0?w=400',
    },
  })
  await prisma.stock.createMany({
    data: [
      { productId: product1.id, warehouseId: warehouse1.id, total: 10, reserved: 0 },
      { productId: product1.id, warehouseId: warehouse2.id, total: 5, reserved: 0 },
      { productId: product2.id, warehouseId: warehouse1.id, total: 3, reserved: 0 },
      { productId: product2.id, warehouseId: warehouse2.id, total: 8, reserved: 0 },
      { productId: product3.id, warehouseId: warehouse1.id, total: 1, reserved: 0 },
      { productId: product3.id, warehouseId: warehouse2.id, total: 4, reserved: 0 },
    ],
  })
  console.log('✅ Database seeded successfully!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })