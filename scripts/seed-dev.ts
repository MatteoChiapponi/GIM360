import { config } from "dotenv"
config({ path: ".env.local", override: true })

import bcrypt from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../app/generated/prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function firstOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1))
}

function date(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding dev data...\n")

  // ── Owner + Gym ────────────────────────────────────────────────────────────

  const hashedPassword = await bcrypt.hash("admin1234", 10)

  const owner = await db.user.upsert({
    where: { email: "admin@gym360.com" },
    update: {},
    create: {
      email: "admin@gym360.com",
      hashedPassword,
      role: "OWNER",
      owner: {
        create: {
          name: "Admin GYM360",
          gyms: {
            create: {
              name: "GYM360 Central",
              address: "Av. Corrientes 1234, CABA",
              phone: "011-4567-8910",
            },
          },
        },
      },
    },
    include: { owner: { include: { gyms: true } } },
  })

  const gym = owner.owner!.gyms[0]
  console.log(`✅ Owner: ${owner.email}  /  Gym: ${gym.name} (${gym.id})`)

  // ── Groups ─────────────────────────────────────────────────────────────────

  const [groupBeginners, groupIntermediate, groupAdvanced] = await Promise.all([
    db.group.create({
      data: {
        gymId: gym.id,
        name: "Beginners",
        monthlyPrice: 15000,
        maxCapacity: 12,
        schedules: {
          create: {
            weekDays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
            startTime: "10:00",
            endTime: "11:30",
            startDate: date(2026, 1, 1),
          },
        },
      },
    }),
    db.group.create({
      data: {
        gymId: gym.id,
        name: "Intermediate",
        monthlyPrice: 18000,
        maxCapacity: 10,
        schedules: {
          create: {
            weekDays: ["TUESDAY", "THURSDAY"],
            startTime: "17:00",
            endTime: "19:00",
            startDate: date(2026, 1, 1),
          },
        },
      },
    }),
    db.group.create({
      data: {
        gymId: gym.id,
        name: "Advanced",
        monthlyPrice: 22000,
        maxCapacity: 8,
        schedules: {
          create: {
            weekDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
            startTime: "08:00",
            endTime: "10:00",
            startDate: date(2026, 1, 1),
          },
        },
      },
    }),
  ])

  console.log(`✅ Groups: ${groupBeginners.name}, ${groupIntermediate.name}, ${groupAdvanced.name}`)

  // ── Trainers ───────────────────────────────────────────────────────────────

  const [trainerLaura, trainerMarcelo] = await Promise.all([
    db.trainer.create({
      data: {
        gymId: gym.id,
        name: "Laura Pérez",
        contractType: "MONTHLY",
        groups: { create: { groupId: groupBeginners.id } },
      },
    }),
    db.trainer.create({
      data: {
        gymId: gym.id,
        name: "Marcelo Ruiz",
        contractType: "HOURLY",
        groups: {
          create: [
            { groupId: groupIntermediate.id, hourlyRate: 3500 },
            { groupId: groupAdvanced.id, hourlyRate: 4000 },
          ],
        },
      },
    }),
  ])

  console.log(`✅ Trainers: ${trainerLaura.name}, ${trainerMarcelo.name}`)

  // ── Students ───────────────────────────────────────────────────────────────
  // Mix of situations:
  //   - Students in one group, some in two groups
  //   - Different dueDays (simulates different join dates)
  //   - One inactive student (leftAt set)

  const studentsData = [
    // Beginners only — pays on the 5th
    {
      firstName: "Ana",
      lastName: "García",
      phone: "1123456789",
      joinedAt: date(2025, 10, 5),
      dueDay: 5,
      groups: [groupBeginners.id],
    },
    // Beginners only — pays on the 12th
    {
      firstName: "Carlos",
      lastName: "López",
      phone: "1198765432",
      joinedAt: date(2025, 11, 12),
      dueDay: 12,
      groups: [groupBeginners.id],
    },
    // Intermediate only — pays on the 1st
    {
      firstName: "Sofía",
      lastName: "Martínez",
      phone: "1134567890",
      nationalId: "38111222",
      joinedAt: date(2026, 1, 1),
      dueDay: 1,
      groups: [groupIntermediate.id],
    },
    // Intermediate only — pays on the 20th
    {
      firstName: "Tomás",
      lastName: "Fernández",
      phone: "1156789012",
      joinedAt: date(2025, 9, 20),
      dueDay: 20,
      groups: [groupIntermediate.id],
    },
    // Advanced only — pays on the 15th
    {
      firstName: "Valentina",
      lastName: "Rodríguez",
      phone: "1178901234",
      nationalId: "40333444",
      joinedAt: date(2025, 8, 15),
      dueDay: 15,
      groups: [groupAdvanced.id],
    },
    // Beginners + Intermediate (two groups) — pays on the 3rd
    {
      firstName: "Lucas",
      lastName: "Sánchez",
      phone: "1190123456",
      joinedAt: date(2026, 2, 3),
      dueDay: 3,
      groups: [groupBeginners.id, groupIntermediate.id],
    },
    // Beginners + Advanced (two groups) — pays on the 8th
    {
      firstName: "Camila",
      lastName: "Torres",
      phone: "1112345678",
      joinedAt: date(2025, 12, 8),
      dueDay: 8,
      groups: [groupBeginners.id, groupAdvanced.id],
    },
    // Inactive student (leftAt set) — should NOT appear in generated payments
    {
      firstName: "Diego",
      lastName: "Morales",
      phone: "1145678901",
      joinedAt: date(2025, 6, 1),
      leftAt: date(2026, 1, 31),
      dueDay: 1,
      groups: [groupBeginners.id],
    },
  ]

  const students = await Promise.all(
    studentsData.map(({ groups, ...data }) =>
      db.student.create({
        data: {
          gymId: gym.id,
          ...data,
          groups: {
            create: groups.map((groupId) => ({
              groupId,
              enrolledAt: data.joinedAt,
            })),
          },
        },
      })
    )
  )

  console.log(`✅ Students: ${students.map((s) => s.firstName).join(", ")}`)

  // ── Payments ───────────────────────────────────────────────────────────────
  // Generate payments for January and February 2026.
  // Manually set a mix of statuses to simulate real state:
  //   January: most paid, a couple pending/expired
  //   February: mix of paid and pending
  //   March: not generated yet (to test lazy generation)

  const activeStudents = students.filter((s) => !s.leftAt)

  const monthlyAmounts: Record<string, number> = {}
  for (const s of activeStudents) {
    const studentData = studentsData.find(
      (d) => d.firstName === s.firstName && d.lastName === s.lastName
    )!
    const total = await db.studentGroup.findMany({
      where: { studentId: s.id },
      include: { group: true },
    })
    monthlyAmounts[s.id] = total.reduce((sum, sg) => sum + Number(sg.group.monthlyPrice), 0)
  }

  // January 2026
  const januaryPayments = [
    { student: "Ana",       status: "PAID",    paidAt: date(2026, 1, 5)  },
    { student: "Carlos",    status: "PAID",    paidAt: date(2026, 1, 14) },
    { student: "Sofía",     status: "PAID",    paidAt: date(2026, 1, 3)  },
    { student: "Tomás",     status: "PAID",    paidAt: date(2026, 1, 22) },
    { student: "Valentina", status: "PAID",    paidAt: date(2026, 1, 16) },
    { student: "Lucas",     status: "EXPIRED", paidAt: null              },
    { student: "Camila",    status: "PAID",    paidAt: date(2026, 1, 10) },
  ] as const

  // February 2026
  const februaryPayments = [
    { student: "Ana",       status: "PAID",    paidAt: date(2026, 2, 6)  },
    { student: "Carlos",    status: "PENDING", paidAt: null              },
    { student: "Sofía",     status: "PAID",    paidAt: date(2026, 2, 2)  },
    { student: "Tomás",     status: "PAID",    paidAt: date(2026, 2, 21) },
    { student: "Valentina", status: "PENDING", paidAt: null              },
    { student: "Lucas",     status: "PAID",    paidAt: date(2026, 2, 5)  },
    { student: "Camila",    status: "PENDING", paidAt: null              },
  ] as const

  for (const [period, entries] of [
    [firstOfMonth(2026, 1), januaryPayments],
    [firstOfMonth(2026, 2), februaryPayments],
  ] as const) {
    for (const entry of entries) {
      const student = students.find((s) => s.firstName === entry.student)!
      await db.payment.create({
        data: {
          gymId: gym.id,
          studentId: student.id,
          period,
          amount: monthlyAmounts[student.id],
          status: entry.status,
          paidAt: entry.paidAt ?? null,
        },
      })
    }
  }

  console.log(`✅ Payments: January (7 records) + February (7 records)`)
  console.log(`\n📋 Summary`)
  console.log(`   Gym ID:      ${gym.id}`)
  console.log(`   Login:       admin@gym360.com / admin1234`)
  console.log(`   Groups:      Beginners ($15k), Intermediate ($18k), Advanced ($22k)`)
  console.log(`   Students:    7 active + 1 inactive (Diego)`)
  console.log(`   March:       no payments generated yet — test lazy generation via POST /api/payments`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
