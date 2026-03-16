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

  // ── Cleanup (idempotent re-runs) ───────────────────────────────────────────

  await db.payment.deleteMany({ where: { gymId: gym.id } })
  await db.studentGroup.deleteMany({ where: { student: { gymId: gym.id } } })
  await db.trainerGroup.deleteMany({ where: { trainer: { gymId: gym.id } } })
  await db.schedule.deleteMany({ where: { group: { gymId: gym.id } } })
  await db.student.deleteMany({ where: { gymId: gym.id } })
  await db.trainer.deleteMany({ where: { gymId: gym.id } })
  await db.group.deleteMany({ where: { gymId: gym.id } })
  await db.fixedExpense.deleteMany({ where: { gymId: gym.id } })

  console.log("🧹 Cleaned up existing gym data")

  // ── Fixed Expenses ─────────────────────────────────────────────────────────

  await db.fixedExpense.createMany({
    data: [
      { gymId: gym.id, name: "Alquiler", amount: 120000 },
      { gymId: gym.id, name: "Servicios (luz, agua, gas)", amount: 25000 },
      { gymId: gym.id, name: "Internet y telefonía", amount: 8000 },
      { gymId: gym.id, name: "Limpieza y mantenimiento", amount: 15000 },
      { gymId: gym.id, name: "Seguro", amount: 12000 },
    ],
  })

  console.log("✅ Fixed expenses: Alquiler, Servicios, Internet, Limpieza, Seguro ($180.000 total)")

  // ── Groups ─────────────────────────────────────────────────────────────────

  const [groupBeginners, groupIntermediate, groupAdvanced, groupCompetition, groupBaby] = await Promise.all([
    db.group.create({
      data: {
        gymId: gym.id,
        name: "Principiantes",
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
        name: "Intermedio",
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
        name: "Avanzado",
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
    // Grupo Competición: Lun-Vie 15:00-18:00 (3 horas)
    // Caso interesante: 2 entrenadores se dividen las horas
    db.group.create({
      data: {
        gymId: gym.id,
        name: "Competición",
        monthlyPrice: 28000,
        maxCapacity: 6,
        schedules: {
          create: {
            weekDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
            startTime: "15:00",
            endTime: "18:00",
            startDate: date(2026, 1, 1),
          },
        },
      },
    }),
    // Grupo Baby Gym: Sáb 09:00-10:30 (solo sábados, sin cobertura completa para probar indicador)
    db.group.create({
      data: {
        gymId: gym.id,
        name: "Baby Gym",
        monthlyPrice: 10000,
        maxCapacity: 15,
        schedules: {
          create: {
            weekDays: ["SATURDAY"],
            startTime: "09:00",
            endTime: "10:30",
            startDate: date(2026, 1, 1),
          },
        },
      },
    }),
  ])

  console.log(`✅ Groups: ${groupBeginners.name}, ${groupIntermediate.name}, ${groupAdvanced.name}, ${groupCompetition.name}, ${groupBaby.name}`)

  // ── Trainers ───────────────────────────────────────────────────────────────

  // Laura: cubre Principiantes completo (L-M-V) + Competición solo L-M-V primeras 2h
  const trainerLaura = await db.trainer.create({
    data: {
      gymId: gym.id,
      name: "Laura Pérez",
      groups: {
        create: [
          {
            groupId: groupBeginners.id,
            hourlyRate: 3000,
            schedules: {
              create: [
                { weekDay: "MONDAY", startTime: "10:00", endTime: "11:30" },
                { weekDay: "WEDNESDAY", startTime: "10:00", endTime: "11:30" },
                { weekDay: "FRIDAY", startTime: "10:00", endTime: "11:30" },
              ],
            },
          },
          {
            groupId: groupCompetition.id,
            hourlyRate: 4500,
            schedules: {
              create: [
                { weekDay: "MONDAY", startTime: "15:00", endTime: "17:00" },
                { weekDay: "WEDNESDAY", startTime: "15:00", endTime: "17:00" },
                { weekDay: "FRIDAY", startTime: "15:00", endTime: "17:00" },
              ],
            },
          },
        ],
      },
    },
  })

  // Marcelo: cubre Intermedio completo + Avanzado completo + Competición solo Ma-Ju completo
  const trainerMarcelo = await db.trainer.create({
    data: {
      gymId: gym.id,
      name: "Marcelo Ruiz",
      groups: {
        create: [
          {
            groupId: groupIntermediate.id,
            hourlyRate: 3500,
            schedules: {
              create: [
                { weekDay: "TUESDAY", startTime: "17:00", endTime: "19:00" },
                { weekDay: "THURSDAY", startTime: "17:00", endTime: "19:00" },
              ],
            },
          },
          {
            groupId: groupAdvanced.id,
            hourlyRate: 4000,
            schedules: {
              create: [
                { weekDay: "MONDAY", startTime: "08:00", endTime: "10:00" },
                { weekDay: "TUESDAY", startTime: "08:00", endTime: "10:00" },
                { weekDay: "WEDNESDAY", startTime: "08:00", endTime: "10:00" },
                { weekDay: "THURSDAY", startTime: "08:00", endTime: "10:00" },
                { weekDay: "FRIDAY", startTime: "08:00", endTime: "10:00" },
              ],
            },
          },
          {
            groupId: groupCompetition.id,
            hourlyRate: 4500,
            schedules: {
              create: [
                { weekDay: "TUESDAY", startTime: "15:00", endTime: "18:00" },
                { weekDay: "THURSDAY", startTime: "15:00", endTime: "18:00" },
              ],
            },
          },
        ],
      },
    },
  })

  // Gabriela: cubre Competición L-M-V la última hora (17:00-18:00), complementa a Laura
  // También cubre Baby Gym sábado pero solo 45 minutos (cobertura parcial)
  const trainerGabriela = await db.trainer.create({
    data: {
      gymId: gym.id,
      name: "Gabriela Díaz",
      groups: {
        create: [
          {
            groupId: groupCompetition.id,
            hourlyRate: 3000,
            schedules: {
              create: [
                { weekDay: "MONDAY", startTime: "17:00", endTime: "18:00" },
                { weekDay: "WEDNESDAY", startTime: "17:00", endTime: "18:00" },
                { weekDay: "FRIDAY", startTime: "17:00", endTime: "18:00" },
              ],
            },
          },
          {
            groupId: groupBaby.id,
            hourlyRate: 2500,
            schedules: {
              create: [
                { weekDay: "SATURDAY", startTime: "09:00", endTime: "09:45" },
              ],
            },
          },
        ],
      },
    },
  })

  // Nicolás: entrenador inactivo (dado de baja) — para probar soft delete
  const trainerNicolas = await db.trainer.create({
    data: {
      gymId: gym.id,
      name: "Nicolás Vega",
      active: false,
    },
  })

  console.log(`✅ Trainers:`)
  console.log(`   Laura ($3k/h Principiantes, $4.5k/h Competición L-M-V 15-17h)`)
  console.log(`   Marcelo ($3.5k/h Intermedio, $4k/h Avanzado, $4.5k/h Competición Ma-Ju)`)
  console.log(`   Gabriela ($3k/h Competición L-M-V 17-18h, $2.5k/h Baby Gym 09:00-09:45)`)
  console.log(`   Nicolás (INACTIVO)`)

  // ── Students ───────────────────────────────────────────────────────────────
  // Mix of situations:
  //   - Students in one group, some in two groups
  //   - Different dueDays (simulates different join dates)
  //   - One inactive student (leftAt set)

  const studentsData = [
    // Principiantes only
    {
      firstName: "Ana",
      lastName: "García",
      phone: "1123456789",
      joinedAt: date(2025, 10, 5),
      dueDay: 5,
      groups: [groupBeginners.id],
    },
    {
      firstName: "Carlos",
      lastName: "López",
      phone: "1198765432",
      joinedAt: date(2025, 11, 12),
      dueDay: 12,
      groups: [groupBeginners.id],
    },
    {
      firstName: "Martina",
      lastName: "Álvarez",
      phone: "1167890123",
      joinedAt: date(2026, 1, 15),
      dueDay: 15,
      groups: [groupBeginners.id],
    },
    // Intermedio only
    {
      firstName: "Sofía",
      lastName: "Martínez",
      phone: "1134567890",
      nationalId: "38111222",
      joinedAt: date(2026, 1, 1),
      dueDay: 1,
      groups: [groupIntermediate.id],
    },
    {
      firstName: "Tomás",
      lastName: "Fernández",
      phone: "1156789012",
      joinedAt: date(2025, 9, 20),
      dueDay: 20,
      groups: [groupIntermediate.id],
    },
    {
      firstName: "Lautaro",
      lastName: "Giménez",
      phone: "1101234567",
      joinedAt: date(2025, 11, 1),
      dueDay: 1,
      groups: [groupIntermediate.id],
    },
    // Avanzado only
    {
      firstName: "Valentina",
      lastName: "Rodríguez",
      phone: "1178901234",
      nationalId: "40333444",
      joinedAt: date(2025, 8, 15),
      dueDay: 15,
      groups: [groupAdvanced.id],
    },
    {
      firstName: "Joaquín",
      lastName: "Herrera",
      phone: "1189012345",
      nationalId: "41555666",
      joinedAt: date(2025, 7, 10),
      dueDay: 10,
      groups: [groupAdvanced.id],
    },
    // Competición only
    {
      firstName: "Milagros",
      lastName: "Romero",
      phone: "1145671234",
      nationalId: "39222333",
      joinedAt: date(2025, 6, 1),
      dueDay: 1,
      medicalClearance: "APPROVED" as const,
      groups: [groupCompetition.id],
    },
    {
      firstName: "Agustina",
      lastName: "Cabrera",
      phone: "1156782345",
      nationalId: "40444555",
      joinedAt: date(2025, 9, 1),
      dueDay: 1,
      medicalClearance: "APPROVED" as const,
      groups: [groupCompetition.id],
    },
    {
      firstName: "Florencia",
      lastName: "Molina",
      phone: "1167893456",
      joinedAt: date(2026, 1, 10),
      dueDay: 10,
      medicalClearance: "PENDING" as const,
      groups: [groupCompetition.id],
    },
    // Baby Gym
    {
      firstName: "Isabella",
      lastName: "Paz",
      phone: "1178904567",
      birthDate: date(2021, 3, 15),
      joinedAt: date(2026, 2, 1),
      dueDay: 1,
      groups: [groupBaby.id],
    },
    {
      firstName: "Mateo",
      lastName: "Ríos",
      phone: "1189015678",
      birthDate: date(2020, 8, 22),
      joinedAt: date(2026, 2, 1),
      dueDay: 1,
      groups: [groupBaby.id],
    },
    // Multi-grupo
    {
      firstName: "Lucas",
      lastName: "Sánchez",
      phone: "1190123456",
      joinedAt: date(2026, 2, 3),
      dueDay: 3,
      groups: [groupBeginners.id, groupIntermediate.id],
    },
    {
      firstName: "Camila",
      lastName: "Torres",
      phone: "1112345678",
      joinedAt: date(2025, 12, 8),
      dueDay: 8,
      groups: [groupBeginners.id, groupAdvanced.id],
    },
    {
      firstName: "Emilia",
      lastName: "Suárez",
      phone: "1123456780",
      nationalId: "39888999",
      joinedAt: date(2025, 10, 1),
      dueDay: 1,
      medicalClearance: "APPROVED" as const,
      groups: [groupAdvanced.id, groupCompetition.id],
    },
    // Inactive student
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
  // Generates payments for January, February, and March 2026.
  // January: mostly paid (simulates closed month)
  // February: mix of paid and pending
  // March: realistic current state (some paid, some pending, some expired)

  const activeStudents = students.filter((s) => !s.leftAt)

  // Compute each student's total monthly fee (sum of all enrolled groups)
  const monthlyAmounts: Record<string, number> = {}
  for (const s of activeStudents) {
    const studentData = studentsData.find(
      (d) => d.firstName === s.firstName && d.lastName === s.lastName
    )!
    const enrollments = await db.studentGroup.findMany({
      where: { studentId: s.id },
      include: { group: true },
    })
    monthlyAmounts[s.id] = enrollments.reduce((sum, sg) => sum + Number(sg.group.monthlyPrice), 0)
  }

  // January 2026 — closed month, almost all paid
  const januaryPayments = [
    { student: "Ana",       status: "PAID",    paidAt: date(2026, 1, 5)  },
    { student: "Carlos",    status: "PAID",    paidAt: date(2026, 1, 14) },
    { student: "Martina",   status: "PAID",    paidAt: date(2026, 1, 16) },
    { student: "Sofía",     status: "PAID",    paidAt: date(2026, 1, 3)  },
    { student: "Tomás",     status: "PAID",    paidAt: date(2026, 1, 22) },
    { student: "Lautaro",   status: "PAID",    paidAt: date(2026, 1, 5)  },
    { student: "Valentina", status: "PAID",    paidAt: date(2026, 1, 16) },
    { student: "Joaquín",   status: "PAID",    paidAt: date(2026, 1, 12) },
    { student: "Milagros",  status: "PAID",    paidAt: date(2026, 1, 3)  },
    { student: "Agustina",  status: "PAID",    paidAt: date(2026, 1, 5)  },
    { student: "Florencia", status: "PAID",    paidAt: date(2026, 1, 12) },
    { student: "Lucas",     status: "EXPIRED", paidAt: null              },
    { student: "Camila",    status: "PAID",    paidAt: date(2026, 1, 10) },
    { student: "Emilia",    status: "PAID",    paidAt: date(2026, 1, 5)  },
  ] as const

  // February 2026 — past month, mix of paid and pending
  const februaryPayments = [
    { student: "Ana",       status: "PAID",    paidAt: date(2026, 2, 6)  },
    { student: "Carlos",    status: "PAID",    paidAt: date(2026, 2, 14) },
    { student: "Martina",   status: "PAID",    paidAt: date(2026, 2, 16) },
    { student: "Sofía",     status: "PAID",    paidAt: date(2026, 2, 2)  },
    { student: "Tomás",     status: "PAID",    paidAt: date(2026, 2, 21) },
    { student: "Lautaro",   status: "PENDING", paidAt: null              },
    { student: "Valentina", status: "PENDING", paidAt: null              },
    { student: "Joaquín",   status: "PAID",    paidAt: date(2026, 2, 11) },
    { student: "Milagros",  status: "PAID",    paidAt: date(2026, 2, 3)  },
    { student: "Agustina",  status: "PAID",    paidAt: date(2026, 2, 6)  },
    { student: "Florencia", status: "PENDING", paidAt: null              },
    { student: "Isabella",  status: "PAID",    paidAt: date(2026, 2, 2)  },
    { student: "Mateo",     status: "PAID",    paidAt: date(2026, 2, 3)  },
    { student: "Lucas",     status: "PAID",    paidAt: date(2026, 2, 5)  },
    { student: "Camila",    status: "PENDING", paidAt: null              },
    { student: "Emilia",    status: "PAID",    paidAt: date(2026, 2, 4)  },
  ] as const

  // March 2026 — current month, realistic in-progress state
  const marchPayments = [
    { student: "Ana",       status: "PAID",    paidAt: date(2026, 3, 5)  },
    { student: "Carlos",    status: "PENDING", paidAt: null              },
    { student: "Martina",   status: "PAID",    paidAt: date(2026, 3, 15) },
    { student: "Sofía",     status: "PAID",    paidAt: date(2026, 3, 2)  },
    { student: "Tomás",     status: "PENDING", paidAt: null              },
    { student: "Lautaro",   status: "PAID",    paidAt: date(2026, 3, 3)  },
    { student: "Valentina", status: "PAID",    paidAt: date(2026, 3, 15) },
    { student: "Joaquín",   status: "PENDING", paidAt: null              },
    { student: "Milagros",  status: "PAID",    paidAt: date(2026, 3, 2)  },
    { student: "Agustina",  status: "EXPIRED", paidAt: null              },
    { student: "Florencia", status: "PAID",    paidAt: date(2026, 3, 11) },
    { student: "Isabella",  status: "PAID",    paidAt: date(2026, 3, 2)  },
    { student: "Mateo",     status: "PENDING", paidAt: null              },
    { student: "Lucas",     status: "PAID",    paidAt: date(2026, 3, 4)  },
    { student: "Camila",    status: "EXPIRED", paidAt: null              },
    { student: "Emilia",    status: "PAID",    paidAt: date(2026, 3, 3)  },
  ] as const

  for (const [period, entries] of [
    [firstOfMonth(2026, 1), januaryPayments],
    [firstOfMonth(2026, 2), februaryPayments],
    [firstOfMonth(2026, 3), marchPayments],
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

  console.log(`✅ Payments: Enero (14) + Febrero (16) + Marzo (16 registros)`)

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log(`
📋 Resumen
   Gym ID:      ${gym.id}
   Login:       admin@gym360.com / admin1234

   Grupos (5):
     Principiantes ($15k, L-M-V 10:00-11:30)
     Intermedio ($18k, Ma-Ju 17:00-19:00)
     Avanzado ($22k, L-V 08:00-10:00)
     Competición ($28k, L-V 15:00-18:00)
     Baby Gym ($10k, Sáb 09:00-10:30)

   Entrenadores (4):
     Laura: Principiantes completo + Competición L-M-V 15:00-17:00
     Marcelo: Intermedio completo + Avanzado completo + Competición Ma-Ju completo
     Gabriela: Competición L-M-V 17:00-18:00 + Baby Gym Sáb 09:00-09:45 (parcial!)
     Nicolás: INACTIVO

   Cobertura interesante:
     Competición L-M-V: Laura 15-17h + Gabriela 17-18h = cubierto
     Competición Ma-Ju: Marcelo 15-18h = cubierto
     Baby Gym Sáb: Gabriela 09:00-09:45 = parcial (falta 09:45-10:30)

   Alumnos: 16 activos + 1 baja (Diego)
   Gastos fijos: $180.000/mes
   Pagos: Enero · Febrero · Marzo (46 registros)

   👉 Probá las métricas con period=2026-01, 2026-02 o 2026-03
  `)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
