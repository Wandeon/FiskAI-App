import { DefaultSession } from "next-auth"
import { SystemRole } from "@/lib/auth/system-role"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      systemRole: SystemRole
    } & DefaultSession["user"]
  }

  interface User {
    systemRole?: SystemRole
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    systemRole?: SystemRole
  }
}
