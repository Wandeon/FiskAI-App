import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

/**
 * Bootstrap script for setting admin role on users.
 *
 * Usage:
 *   npx tsx scripts/set-admin-role.ts user@example.com
 *   npx tsx scripts/set-admin-role.ts user1@example.com user2@example.com
 *
 * This script sets the systemRole to 'ADMIN' for the specified email addresses.
 * Admin access is granted ONLY through database systemRole, not through email allowlists.
 */
async function main() {
  const emailArgs = process.argv.slice(2)

  if (emailArgs.length === 0) {
    console.error('Error: No email addresses provided')
    console.log('')
    console.log('Usage:')
    console.log('  npx tsx scripts/set-admin-role.ts user@example.com')
    console.log('  npx tsx scripts/set-admin-role.ts user1@example.com user2@example.com')
    console.log('')
    console.log('This will set systemRole="ADMIN" in the database for the specified users.')
    process.exit(1)
  }

  console.log(`Setting ADMIN role for: ${emailArgs.join(', ')}`)

  const result = await prisma.user.updateMany({
    where: {
      email: { in: emailArgs.map(e => e.trim().toLowerCase()) }
    },
    data: {
      systemRole: 'ADMIN'
    }
  })

  if (result.count === 0) {
    console.warn('Warning: No users found with the provided email addresses')
    console.log('Make sure the users exist in the database before running this script')
  } else {
    console.log(`Successfully updated ${result.count} user(s) to ADMIN role`)
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
