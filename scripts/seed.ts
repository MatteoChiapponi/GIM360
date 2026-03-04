import { config } from "dotenv"
config({ path: ".env.local", override: true })

import bcrypt from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../app/generated/prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  const email = "admin@gym360.com"
  const password = "admin1234"

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    console.log("⚠️  Ya existe un usuario con ese email, nada que hacer.")
    return
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await db.user.create({
    data: {
      email,
      hashedPassword,
      role: "OWNER",
      owner: {
        create: {
          nombre: "Admin GYM360",
          gyms: {
            create: {
              nombre: "Gimnasio Demo",
              direccion: "Av. Siempreviva 742",
              telefono: "011-1234-5678",
            },
          },
        },
      },
    },
  })

  console.log("✅ Usuario creado:")
  console.log(`   email:    ${email}`)
  console.log(`   password: ${password}`)
  console.log(`   id:       ${user.id}`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
