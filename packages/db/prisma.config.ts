import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma/schema'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrate: {
    adapter: {
      url: process.env.DATABASE_URL!,
    },
  },
})
