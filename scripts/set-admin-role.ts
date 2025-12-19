import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || []

  if (adminEmails.length === 0) {
    console.log('No ADMIN_EMAILS configured')
    return
  }

  const result = await prisma.user.updateMany({
    where: {
      email: { in: adminEmails }
    },
    data: {
      systemRole: 'ADMIN'
    }
  })

  console.log(`Updated ${result.count} users to ADMIN role`)
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
