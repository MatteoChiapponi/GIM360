import { DefaultSession } from "next-auth"
import { UserRole } from "@/app/generated/prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
    } & DefaultSession["user"]
  }
}
