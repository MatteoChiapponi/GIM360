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

  const hashedPassword = await bcrypt.hash(password, 10)

  // Upsert user
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      hashedPassword,
      role: "OWNER",
      owner: { create: { name: "Admin GYM360" } },
    },
    include: { owner: true },
  })

  const owner = user.owner!

  // Seed gyms con distintos estados
  const gyms = [
    { name: "GYM360 Centro",   address: "Av. Corrientes 1234", phone: "011-1111-1111", status: "ACTIVE"    },
    { name: "GYM360 Palermo",  address: "Av. Santa Fe 5678",   phone: "011-2222-2222", status: "SUSPENDED" },
    { name: "GYM360 Belgrano", address: "Cabildo 900",         phone: "011-3333-3333", status: "INACTIVE"  },
  ] as const

  for (const gym of gyms) {
    const existing = await db.gym.findFirst({ where: { ownerId: owner.id, name: gym.name } })
    if (!existing) {
      await db.gym.create({ data: { ...gym, ownerId: owner.id } })
      console.log(`   gym creado: ${gym.name} (${gym.status})`)
    } else {
      console.log(`   gym ya existe: ${gym.name} (${existing.status})`)
    }
  }

  console.log("\nOwner listo:")
  console.log(`   email:    ${email}`)
  console.log(`   password: ${password}`)
  console.log(`   id:       ${user.id}`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
