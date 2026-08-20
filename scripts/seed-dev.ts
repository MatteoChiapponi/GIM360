import { config } from "dotenv"
config({ path: ".env.local", override: true })

import bcrypt from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../app/generated/prisma/client"

if (process.env.NODE_ENV === "production") {
  console.error("seed-dev.ts no debe ejecutarse en producción.")
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function firstOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1))
}

function date(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day))
}

const PM = { E: "CASH", T: "TRANSFER", C: "CARD" } as const

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding dev data...\n")

  // ── Owner + Gym ────────────────────────────────────────────────────────────

  const hashedPassword = await bcrypt.hash("admin1234", 12)

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
  console.log(`Owner: ${owner.email}  /  Gym: ${gym.name} (${gym.id})`)

  // ── Cleanup (idempotent re-runs) ───────────────────────────────────────────

  await db.payment.deleteMany({ where: { gymId: gym.id } })
  await db.cashClosing.deleteMany({ where: { gymId: gym.id } })
  await db.studentFile.deleteMany({ where: { gymId: gym.id } })
  await db.studentGroup.deleteMany({ where: { student: { gymId: gym.id } } })
  await db.trainerGroupSchedule.deleteMany({ where: { trainerGroup: { trainer: { gymId: gym.id } } } })
  await db.trainerGroup.deleteMany({ where: { trainer: { gymId: gym.id } } })
  await db.schedule.deleteMany({ where: { group: { gymId: gym.id } } })
  await db.student.deleteMany({ where: { gymId: gym.id } })
  await db.discount.deleteMany({ where: { gymId: gym.id } })
  await db.trainer.deleteMany({ where: { gymId: gym.id } })
  await db.group.deleteMany({ where: { gymId: gym.id } })
  await db.fixedExpense.deleteMany({ where: { gymId: gym.id } })
  // Borrar el User arrastra al Receptionist por cascade
  await db.user.deleteMany({ where: { receptionist: { gymId: gym.id } } })

  console.log("Cleaned up existing gym data")

  // ── Receptionist ───────────────────────────────────────────────────────────

  const receptionistUser = await db.user.create({
    data: {
      email: "recepcion@gym360.com",
      hashedPassword: await bcrypt.hash("recepcion1234", 12),
      role: "RECEPTIONIST",
      receptionist: { create: { gymId: gym.id, name: "Sofia Recepcion" } },
    },
  })

  console.log(`Receptionist: ${receptionistUser.email}`)

  // ── Fixed Expenses ─────────────────────────────────────────────────────────

  await db.fixedExpense.createMany({
    data: [
      { gymId: gym.id, name: "Alquiler", amount: 120000 },
      { gymId: gym.id, name: "Servicios (luz, agua, gas)", amount: 25000 },
      { gymId: gym.id, name: "Internet y telefonia", amount: 8000 },
      { gymId: gym.id, name: "Limpieza y mantenimiento", amount: 15000 },
      { gymId: gym.id, name: "Seguro", amount: 12000 },
    ],
  })

  console.log("Fixed expenses: $180.000/mes")

  // ── Groups ─────────────────────────────────────────────────────────────────

  const [gPrinc, gInter, gAvanz, gCompe, gBaby] = await Promise.all([
    db.group.create({
      data: {
        gymId: gym.id, name: "Principiantes", monthlyPrice: 15000, maxCapacity: 12,
        schedules: {
          create: {
            weekDays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
            startTime: "10:00", endTime: "11:30", startDate: date(2026, 1, 1),
          },
        },
      },
    }),
    db.group.create({
      data: {
        gymId: gym.id, name: "Intermedio", monthlyPrice: 18000, maxCapacity: 10,
        schedules: {
          create: {
            weekDays: ["TUESDAY", "THURSDAY"],
            startTime: "17:00", endTime: "19:00", startDate: date(2026, 1, 1),
          },
        },
      },
    }),
    db.group.create({
      data: {
        gymId: gym.id, name: "Avanzado", monthlyPrice: 22000, maxCapacity: 8,
        schedules: {
          create: {
            weekDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
            startTime: "08:00", endTime: "10:00", startDate: date(2026, 1, 1),
          },
        },
      },
    }),
    db.group.create({
      data: {
        gymId: gym.id, name: "Competicion", monthlyPrice: 28000, maxCapacity: 6,
        schedules: {
          create: {
            weekDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
            startTime: "15:00", endTime: "18:00", startDate: date(2026, 1, 1),
          },
        },
      },
    }),
    db.group.create({
      data: {
        gymId: gym.id, name: "Baby Gym", monthlyPrice: 10000, maxCapacity: 15,
        schedules: {
          create: {
            weekDays: ["SATURDAY"],
            startTime: "09:00", endTime: "10:30", startDate: date(2026, 1, 1),
          },
        },
      },
    }),
  ])

  console.log("Groups: Principiantes, Intermedio, Avanzado, Competicion, Baby Gym")

  // ── Trainers ───────────────────────────────────────────────────────────────

  await db.trainer.create({
    data: {
      gymId: gym.id, name: "Laura Perez",
      groups: {
        create: [
          {
            groupId: gPrinc.id, hourlyRate: 3000,
            schedules: {
              create: [
                { weekDay: "MONDAY", startTime: "10:00", endTime: "11:30" },
                { weekDay: "WEDNESDAY", startTime: "10:00", endTime: "11:30" },
                { weekDay: "FRIDAY", startTime: "10:00", endTime: "11:30" },
              ],
            },
          },
          {
            groupId: gCompe.id, hourlyRate: 4500,
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

  await db.trainer.create({
    data: {
      gymId: gym.id, name: "Marcelo Ruiz",
      groups: {
        create: [
          {
            groupId: gInter.id, hourlyRate: 3500,
            schedules: {
              create: [
                { weekDay: "TUESDAY", startTime: "17:00", endTime: "19:00" },
                { weekDay: "THURSDAY", startTime: "17:00", endTime: "19:00" },
              ],
            },
          },
          {
            groupId: gAvanz.id, hourlyRate: 4000,
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
            groupId: gCompe.id, hourlyRate: 4500,
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

  await db.trainer.create({
    data: {
      gymId: gym.id, name: "Gabriela Diaz",
      groups: {
        create: [
          {
            groupId: gCompe.id, hourlyRate: 3000,
            schedules: {
              create: [
                { weekDay: "MONDAY", startTime: "17:00", endTime: "18:00" },
                { weekDay: "WEDNESDAY", startTime: "17:00", endTime: "18:00" },
                { weekDay: "FRIDAY", startTime: "17:00", endTime: "18:00" },
              ],
            },
          },
          {
            groupId: gBaby.id, hourlyRate: 2500,
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

  await db.trainer.create({
    data: { gymId: gym.id, name: "Nicolas Vega", active: false },
  })

  console.log("Trainers: Laura, Marcelo, Gabriela, Nicolas (inactivo)")

  // ── Students ───────────────────────────────────────────────────────────────

  type StudentSeed = {
    firstName: string; lastName: string; phone1: string; phone2?: string; nationalId?: string
    birthDate?: Date; joinedAt: Date; leftAt?: Date; status?: "ACTIVE" | "INACTIVE" | "TRIAL"
    trialEndsAt?: Date; dueDay: number; groups: string[]
  }

  const studentsData: StudentSeed[] = [
    // Principiantes
    { firstName: "Ana", lastName: "Garcia", phone1: "1123456789", joinedAt: date(2025, 10, 5), dueDay: 5, groups: [gPrinc.id] },
    { firstName: "Carlos", lastName: "Lopez", phone1: "1198765432", joinedAt: date(2025, 11, 12), dueDay: 12, groups: [gPrinc.id] },
    { firstName: "Martina", lastName: "Alvarez", phone1: "1167890123", joinedAt: date(2026, 1, 15), dueDay: 15, groups: [gPrinc.id] },
    // Intermedio
    { firstName: "Sofia", lastName: "Martinez", phone1: "1134567890", nationalId: "38111222", joinedAt: date(2026, 1, 1), dueDay: 1, groups: [gInter.id] },
    { firstName: "Tomas", lastName: "Fernandez", phone1: "1156789012", joinedAt: date(2025, 9, 20), dueDay: 20, groups: [gInter.id] },
    { firstName: "Lautaro", lastName: "Gimenez", phone1: "1101234567", joinedAt: date(2025, 11, 1), dueDay: 1, groups: [gInter.id] },
    // Avanzado
    { firstName: "Valentina", lastName: "Rodriguez", phone1: "1178901234", nationalId: "40333444", joinedAt: date(2025, 8, 15), dueDay: 15, groups: [gAvanz.id] },
    { firstName: "Joaquin", lastName: "Herrera", phone1: "1189012345", nationalId: "41555666", joinedAt: date(2025, 7, 10), dueDay: 10, groups: [gAvanz.id] },
    // Competicion
    { firstName: "Milagros", lastName: "Romero", phone1: "1145671234", nationalId: "39222333", joinedAt: date(2025, 6, 1), dueDay: 1, groups: [gCompe.id] },
    { firstName: "Agustina", lastName: "Cabrera", phone1: "1156782345", nationalId: "40444555", joinedAt: date(2025, 9, 1), dueDay: 1, groups: [gCompe.id] },
    { firstName: "Florencia", lastName: "Molina", phone1: "1167893456", joinedAt: date(2026, 1, 10), dueDay: 10, groups: [gCompe.id] },
    // Baby Gym
    { firstName: "Isabella", lastName: "Paz", phone1: "1178904567", birthDate: date(2021, 3, 15), joinedAt: date(2026, 2, 1), dueDay: 1, groups: [gBaby.id] },
    { firstName: "Mateo", lastName: "Rios", phone1: "1189015678", birthDate: date(2020, 8, 22), joinedAt: date(2026, 2, 1), dueDay: 1, groups: [gBaby.id] },
    // Multi-grupo
    { firstName: "Lucas", lastName: "Sanchez", phone1: "1190123456", joinedAt: date(2026, 2, 3), dueDay: 3, groups: [gPrinc.id, gInter.id] },
    { firstName: "Camila", lastName: "Torres", phone1: "1112345678", joinedAt: date(2025, 12, 8), dueDay: 8, groups: [gPrinc.id, gAvanz.id] },
    { firstName: "Emilia", lastName: "Suarez", phone1: "1123456780", nationalId: "39888999", joinedAt: date(2025, 10, 1), dueDay: 1, groups: [gAvanz.id, gCompe.id] },
    // Inactivo
    { firstName: "Diego", lastName: "Morales", phone1: "1145678901", joinedAt: date(2025, 6, 1), leftAt: date(2026, 1, 31), status: "INACTIVE", dueDay: 1, groups: [gPrinc.id] },
    // Prueba
    { firstName: "Renata", lastName: "Vidal", phone1: "1199887766", joinedAt: date(2026, 3, 10), status: "TRIAL", trialEndsAt: date(2026, 4, 10), dueDay: 10, groups: [gPrinc.id] },
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

  console.log(`Students: ${students.length} (${students.filter(s => s.status === "ACTIVE").length} activos, 1 inactivo, 1 prueba)`)

  // ── Payments ───────────────────────────────────────────────────────────────

  const activeStudents = students.filter((s) => s.status !== "INACTIVE")

  // Compute each student's total monthly fee
  const monthlyAmounts: Record<string, number> = {}
  for (const s of activeStudents) {
    const enrollments = await db.studentGroup.findMany({
      where: { studentId: s.id },
      include: { group: true },
    })
    monthlyAmounts[s.id] = enrollments.reduce((sum, sg) => sum + Number(sg.group.monthlyPrice), 0)
  }

  type PaymentEntry = {
    student: string
    status: "PAID" | "PENDING" | "EXPIRED"
    paidAt: Date | null
    paymentMethod: "CASH" | "TRANSFER" | "CARD" | null
  }

  // January 2026 - closed month, almost all paid
  const january: PaymentEntry[] = [
    { student: "Ana",       status: "PAID",    paidAt: date(2026, 1, 5),  paymentMethod: PM.E },
    { student: "Carlos",    status: "PAID",    paidAt: date(2026, 1, 14), paymentMethod: PM.T },
    { student: "Martina",   status: "PAID",    paidAt: date(2026, 1, 16), paymentMethod: PM.E },
    { student: "Sofia",     status: "PAID",    paidAt: date(2026, 1, 3),  paymentMethod: PM.C },
    { student: "Tomas",     status: "PAID",    paidAt: date(2026, 1, 22), paymentMethod: PM.E },
    { student: "Lautaro",   status: "PAID",    paidAt: date(2026, 1, 5),  paymentMethod: PM.T },
    { student: "Valentina", status: "PAID",    paidAt: date(2026, 1, 16), paymentMethod: PM.E },
    { student: "Joaquin",   status: "PAID",    paidAt: date(2026, 1, 12), paymentMethod: PM.C },
    { student: "Milagros",  status: "PAID",    paidAt: date(2026, 1, 3),  paymentMethod: PM.E },
    { student: "Agustina",  status: "PAID",    paidAt: date(2026, 1, 5),  paymentMethod: PM.T },
    { student: "Florencia", status: "PAID",    paidAt: date(2026, 1, 12), paymentMethod: PM.C },
    { student: "Lucas",     status: "EXPIRED", paidAt: null,              paymentMethod: null },
    { student: "Camila",    status: "PAID",    paidAt: date(2026, 1, 10), paymentMethod: PM.E },
    { student: "Emilia",    status: "PAID",    paidAt: date(2026, 1, 5),  paymentMethod: PM.T },
  ]

  // February 2026 - mix of paid, pending, expired
  const february: PaymentEntry[] = [
    { student: "Ana",       status: "PAID",    paidAt: date(2026, 2, 6),  paymentMethod: PM.T },
    { student: "Carlos",    status: "PAID",    paidAt: date(2026, 2, 14), paymentMethod: PM.E },
    { student: "Martina",   status: "PAID",    paidAt: date(2026, 2, 16), paymentMethod: PM.C },
    { student: "Sofia",     status: "PAID",    paidAt: date(2026, 2, 2),  paymentMethod: PM.E },
    { student: "Tomas",     status: "PAID",    paidAt: date(2026, 2, 21), paymentMethod: PM.T },
    { student: "Lautaro",   status: "EXPIRED", paidAt: null,              paymentMethod: null },
    { student: "Valentina", status: "EXPIRED", paidAt: null,              paymentMethod: null },
    { student: "Joaquin",   status: "PAID",    paidAt: date(2026, 2, 11), paymentMethod: PM.E },
    { student: "Milagros",  status: "PAID",    paidAt: date(2026, 2, 3),  paymentMethod: PM.C },
    { student: "Agustina",  status: "PAID",    paidAt: date(2026, 2, 6),  paymentMethod: PM.E },
    { student: "Florencia", status: "EXPIRED", paidAt: null,              paymentMethod: null },
    { student: "Isabella",  status: "PAID",    paidAt: date(2026, 2, 2),  paymentMethod: PM.E },
    { student: "Mateo",     status: "PAID",    paidAt: date(2026, 2, 3),  paymentMethod: PM.T },
    { student: "Lucas",     status: "PAID",    paidAt: date(2026, 2, 5),  paymentMethod: PM.C },
    { student: "Camila",    status: "EXPIRED", paidAt: null,              paymentMethod: null },
    { student: "Emilia",    status: "PAID",    paidAt: date(2026, 2, 4),  paymentMethod: PM.E },
  ]

  // March 2026 - current month, in-progress
  const march: PaymentEntry[] = [
    { student: "Ana",       status: "PAID",    paidAt: date(2026, 3, 5),  paymentMethod: PM.E },
    { student: "Carlos",    status: "PENDING", paidAt: null,              paymentMethod: null },
    { student: "Martina",   status: "PAID",    paidAt: date(2026, 3, 15), paymentMethod: PM.T },
    { student: "Sofia",     status: "PAID",    paidAt: date(2026, 3, 2),  paymentMethod: PM.C },
    { student: "Tomas",     status: "PENDING", paidAt: null,              paymentMethod: null },
    { student: "Lautaro",   status: "PAID",    paidAt: date(2026, 3, 3),  paymentMethod: PM.E },
    { student: "Valentina", status: "PAID",    paidAt: date(2026, 3, 15), paymentMethod: PM.T },
    { student: "Joaquin",   status: "PENDING", paidAt: null,              paymentMethod: null },
    { student: "Milagros",  status: "PAID",    paidAt: date(2026, 3, 2),  paymentMethod: PM.E },
    { student: "Agustina",  status: "EXPIRED", paidAt: null,              paymentMethod: null },
    { student: "Florencia", status: "PAID",    paidAt: date(2026, 3, 11), paymentMethod: PM.C },
    { student: "Isabella",  status: "PAID",    paidAt: date(2026, 3, 2),  paymentMethod: PM.E },
    { student: "Mateo",     status: "PENDING", paidAt: null,              paymentMethod: null },
    { student: "Lucas",     status: "PAID",    paidAt: date(2026, 3, 4),  paymentMethod: PM.T },
    { student: "Camila",    status: "EXPIRED", paidAt: null,              paymentMethod: null },
    { student: "Emilia",    status: "PAID",    paidAt: date(2026, 3, 3),  paymentMethod: PM.E },
    { student: "Renata",    status: "PENDING", paidAt: null,              paymentMethod: null },
  ]

  let paymentCount = 0
  for (const [period, entries] of [
    [firstOfMonth(2026, 1), january],
    [firstOfMonth(2026, 2), february],
    [firstOfMonth(2026, 3), march],
  ] as const) {
    for (const entry of entries) {
      const student = students.find((s) => s.firstName === entry.student)!
      await db.payment.create({
        data: {
          gymId: gym.id,
          studentId: student.id,
          period,
          baseAmount: monthlyAmounts[student.id],
          amount: monthlyAmounts[student.id],
          status: entry.status,
          paidAt: entry.paidAt,
          paymentMethod: entry.paymentMethod,
        },
      })
      paymentCount++
    }
  }

  console.log(`Payments: ${paymentCount} (Ene + Feb + Mar 2026)`)

  // ── Discounts ──────────────────────────────────────────────────────────────
  //
  // Se asignan a alumnos con la cuota de marzo sin cobrar: al entrar a Cuotas,
  // la resincronización recalcula esas cuotas con el descuento aplicado. Las de
  // enero y febrero, ya pagadas, quedan como se cobraron.

  const [dHermanos, dBeca, dProntoPago] = await Promise.all([
    db.discount.create({
      data: {
        gymId: gym.id,
        name: "Hermanos",
        description: "20% para el segundo hermano en adelante",
        type: "PERCENTAGE",
        value: 20,
      },
    }),
    db.discount.create({
      data: {
        gymId: gym.id,
        name: "Beca deportiva",
        description: "Cuota fija para becadas del equipo de competición",
        type: "FIXED_PRICE",
        value: 15000,
      },
    }),
    db.discount.create({
      data: {
        gymId: gym.id,
        name: "Pronto pago",
        description: "10% si la cuota se paga antes del vencimiento",
        type: "PERCENTAGE",
        value: 10,
        loseOnLatePayment: true,
      },
    }),
    db.discount.create({
      data: {
        gymId: gym.id,
        name: "Pago anual anticipado",
        description: "$5.000 de bonificación (temporada 2025, ya no se usa)",
        type: "FIXED_AMOUNT",
        value: 5000,
        active: false,
      },
    }),
  ])

  const mateo = students.find((s) => s.firstName === "Mateo")!
  const camila = students.find((s) => s.firstName === "Camila")!
  const renata = students.find((s) => s.firstName === "Renata")!

  await db.studentDiscount.createMany({
    data: [
      {
        studentId: mateo.id,
        discountId: dHermanos.id,
        validFrom: firstOfMonth(2026, 3),
        validUntil: null,
        notes: "Hermano de Sofia",
      },
      {
        studentId: camila.id,
        discountId: dBeca.id,
        validFrom: firstOfMonth(2026, 3),
        validUntil: firstOfMonth(2026, 8),
        notes: "Beca hasta fin de temporada",
      },
      {
        // Con la cuota vencida, este descuento se cae solo: sirve para ver el
        // caso "perdió el descuento por pagar fuera de término" en la UI.
        studentId: renata.id,
        discountId: dProntoPago.id,
        validFrom: firstOfMonth(2026, 3),
        validUntil: null,
      },
    ],
  })

  console.log("Discounts: Hermanos (20%), Beca deportiva ($15k fijo), Pronto pago (10%, se pierde si vence), Pago anual (inactivo)")

  console.log(`\n--- GYM360 Central listo ---\n`)

  // ════════════════════════════════════════════════════════════════════════════
  // GYM 2: GYM360 Palermo — gimnasio rentable con márgenes positivos
  // ════════════════════════════════════════════════════════════════════════════

  const gym2 = await db.gym.create({
    data: {
      ownerId: owner.owner!.id,
      name: "GYM360 Palermo",
      address: "Av. Santa Fe 3200, CABA",
      phone: "011-5555-6666",
    },
  })

  console.log(`Gym 2: ${gym2.name} (${gym2.id})`)

  // ── Fixed Expenses (bajos) ──

  await db.fixedExpense.createMany({
    data: [
      { gymId: gym2.id, name: "Alquiler", amount: 80000 },
      { gymId: gym2.id, name: "Servicios", amount: 15000 },
      { gymId: gym2.id, name: "Seguro", amount: 8000 },
    ],
  })

  console.log("Gym2 Fixed expenses: $103.000/mes")

  // ── Groups (precios altos, buena ocupacion) ──

  const [g2Iniciacion, g2Formativo, g2Elite] = await Promise.all([
    db.group.create({
      data: {
        gymId: gym2.id, name: "Iniciacion", monthlyPrice: 25000, maxCapacity: 15,
        schedules: {
          create: {
            weekDays: ["MONDAY", "WEDNESDAY", "FRIDAY"],
            startTime: "09:00", endTime: "10:30", startDate: date(2026, 1, 1),
          },
        },
      },
    }),
    db.group.create({
      data: {
        gymId: gym2.id, name: "Formativo", monthlyPrice: 32000, maxCapacity: 12,
        schedules: {
          create: {
            weekDays: ["TUESDAY", "THURSDAY", "SATURDAY"],
            startTime: "16:00", endTime: "18:00", startDate: date(2026, 1, 1),
          },
        },
      },
    }),
    db.group.create({
      data: {
        gymId: gym2.id, name: "Elite", monthlyPrice: 45000, maxCapacity: 8,
        schedules: {
          create: {
            weekDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
            startTime: "14:00", endTime: "16:00", startDate: date(2026, 1, 1),
          },
        },
      },
    }),
  ])

  console.log("Gym2 Groups: Iniciacion ($25k), Formativo ($32k), Elite ($45k)")

  // ── Trainers (tarifas moderadas) ──

  await db.trainer.create({
    data: {
      gymId: gym2.id, name: "Carolina Mendez",
      groups: {
        create: [
          {
            groupId: g2Iniciacion.id, hourlyRate: 2500,
            schedules: {
              create: [
                { weekDay: "MONDAY", startTime: "09:00", endTime: "10:30" },
                { weekDay: "WEDNESDAY", startTime: "09:00", endTime: "10:30" },
                { weekDay: "FRIDAY", startTime: "09:00", endTime: "10:30" },
              ],
            },
          },
          {
            groupId: g2Formativo.id, hourlyRate: 3000,
            schedules: {
              create: [
                { weekDay: "TUESDAY", startTime: "16:00", endTime: "18:00" },
                { weekDay: "THURSDAY", startTime: "16:00", endTime: "18:00" },
                { weekDay: "SATURDAY", startTime: "16:00", endTime: "18:00" },
              ],
            },
          },
        ],
      },
    },
  })

  await db.trainer.create({
    data: {
      gymId: gym2.id, name: "Federico Arias",
      groups: {
        create: [
          {
            groupId: g2Elite.id, hourlyRate: 3500,
            schedules: {
              create: [
                { weekDay: "MONDAY", startTime: "14:00", endTime: "16:00" },
                { weekDay: "TUESDAY", startTime: "14:00", endTime: "16:00" },
                { weekDay: "WEDNESDAY", startTime: "14:00", endTime: "16:00" },
                { weekDay: "THURSDAY", startTime: "14:00", endTime: "16:00" },
                { weekDay: "FRIDAY", startTime: "14:00", endTime: "16:00" },
              ],
            },
          },
        ],
      },
    },
  })

  console.log("Gym2 Trainers: Carolina (Iniciacion + Formativo), Federico (Elite)")

  // ── Students (muchos, buena ocupacion) ──

  type StudentSeed2 = {
    firstName: string; lastName: string; phone1: string; phone2?: string
    joinedAt: Date; dueDay: number; groups: string[]
  }

  const students2Data: StudentSeed2[] = [
    // Iniciacion (12 de 15 = 80%)
    { firstName: "Paula", lastName: "Rivas", phone1: "1111000001", joinedAt: date(2025, 8, 1), dueDay: 1, groups: [g2Iniciacion.id] },
    { firstName: "Clara", lastName: "Dominguez", phone1: "1111000002", joinedAt: date(2025, 8, 5), dueDay: 5, groups: [g2Iniciacion.id] },
    { firstName: "Lucia", lastName: "Pereyra", phone1: "1111000003", joinedAt: date(2025, 9, 1), dueDay: 1, groups: [g2Iniciacion.id] },
    { firstName: "Maia", lastName: "Acosta", phone1: "1111000004", joinedAt: date(2025, 9, 10), dueDay: 10, groups: [g2Iniciacion.id] },
    { firstName: "Delfina", lastName: "Castro", phone1: "1111000005", joinedAt: date(2025, 10, 1), dueDay: 1, groups: [g2Iniciacion.id] },
    { firstName: "Alma", lastName: "Medina", phone1: "1111000006", joinedAt: date(2025, 10, 15), dueDay: 15, groups: [g2Iniciacion.id] },
    { firstName: "Bianca", lastName: "Rojas", phone1: "1111000007", joinedAt: date(2025, 11, 1), dueDay: 1, groups: [g2Iniciacion.id] },
    { firstName: "Pilar", lastName: "Navarro", phone1: "1111000008", joinedAt: date(2025, 11, 5), dueDay: 5, groups: [g2Iniciacion.id] },
    { firstName: "Juana", lastName: "Ortiz", phone1: "1111000009", joinedAt: date(2025, 12, 1), dueDay: 1, groups: [g2Iniciacion.id] },
    { firstName: "Elena", lastName: "Silva", phone1: "1111000010", joinedAt: date(2026, 1, 1), dueDay: 1, groups: [g2Iniciacion.id] },
    { firstName: "Nina", lastName: "Vargas", phone1: "1111000011", joinedAt: date(2026, 1, 10), dueDay: 10, groups: [g2Iniciacion.id] },
    { firstName: "Zoe", lastName: "Aguirre", phone1: "1111000012", joinedAt: date(2026, 2, 1), dueDay: 1, groups: [g2Iniciacion.id] },
    // Formativo (10 de 12 = 83%)
    { firstName: "Abril", lastName: "Luna", phone1: "1111000013", joinedAt: date(2025, 7, 1), dueDay: 1, groups: [g2Formativo.id] },
    { firstName: "Catalina", lastName: "Flores", phone1: "1111000014", joinedAt: date(2025, 7, 10), dueDay: 10, groups: [g2Formativo.id] },
    { firstName: "Victoria", lastName: "Guerrero", phone1: "1111000015", joinedAt: date(2025, 8, 1), dueDay: 1, groups: [g2Formativo.id] },
    { firstName: "Olivia", lastName: "Sosa", phone1: "1111000016", joinedAt: date(2025, 9, 1), dueDay: 1, groups: [g2Formativo.id] },
    { firstName: "Antonella", lastName: "Campos", phone1: "1111000017", joinedAt: date(2025, 9, 15), dueDay: 15, groups: [g2Formativo.id] },
    { firstName: "Lola", lastName: "Vera", phone1: "1111000018", joinedAt: date(2025, 10, 1), dueDay: 1, groups: [g2Formativo.id] },
    { firstName: "Sara", lastName: "Godoy", phone1: "1111000019", joinedAt: date(2025, 11, 1), dueDay: 1, groups: [g2Formativo.id] },
    { firstName: "Jazmín", lastName: "Ibarra", phone1: "1111000020", joinedAt: date(2025, 11, 10), dueDay: 10, groups: [g2Formativo.id] },
    { firstName: "Rocio", lastName: "Ledesma", phone1: "1111000021", joinedAt: date(2026, 1, 1), dueDay: 1, groups: [g2Formativo.id] },
    { firstName: "Candela", lastName: "Figueroa", phone1: "1111000022", joinedAt: date(2026, 2, 1), dueDay: 1, groups: [g2Formativo.id] },
    // Elite (7 de 8 = 88%)
    { firstName: "Sol", lastName: "Montenegro", phone1: "1111000023", joinedAt: date(2025, 6, 1), dueDay: 1, groups: [g2Elite.id] },
    { firstName: "Luz", lastName: "Villarreal", phone1: "1111000024", joinedAt: date(2025, 7, 1), dueDay: 1, groups: [g2Elite.id] },
    { firstName: "Mila", lastName: "Ponce", phone1: "1111000025", joinedAt: date(2025, 8, 1), dueDay: 1, groups: [g2Elite.id] },
    { firstName: "Uma", lastName: "Quiroga", phone1: "1111000026", joinedAt: date(2025, 9, 1), dueDay: 1, groups: [g2Elite.id] },
    { firstName: "Gala", lastName: "Espinoza", phone1: "1111000027", joinedAt: date(2025, 10, 1), dueDay: 1, groups: [g2Elite.id] },
    { firstName: "Mora", lastName: "Correa", phone1: "1111000028", joinedAt: date(2025, 11, 1), dueDay: 1, groups: [g2Elite.id] },
    { firstName: "India", lastName: "Bustos", phone1: "1111000029", joinedAt: date(2026, 1, 1), dueDay: 1, groups: [g2Elite.id] },
  ]

  const students2 = await Promise.all(
    students2Data.map(({ groups, ...data }) =>
      db.student.create({
        data: {
          gymId: gym2.id,
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

  console.log(`Gym2 Students: ${students2.length} (Iniciacion 12, Formativo 10, Elite 7)`)

  // ── Payments (casi todo pagado = gym rentable) ──

  const monthlyAmounts2: Record<string, number> = {}
  for (const s of students2) {
    const enrollments = await db.studentGroup.findMany({
      where: { studentId: s.id },
      include: { group: true },
    })
    monthlyAmounts2[s.id] = enrollments.reduce((sum, sg) => sum + Number(sg.group.monthlyPrice), 0)
  }

  // March — almost all paid (rentable)
  const gym2March: PaymentEntry[] = [
    // Iniciacion: 11 de 12 pagaron
    { student: "Paula",     status: "PAID",    paidAt: date(2026, 3, 2),  paymentMethod: PM.T },
    { student: "Clara",     status: "PAID",    paidAt: date(2026, 3, 5),  paymentMethod: PM.E },
    { student: "Lucia",     status: "PAID",    paidAt: date(2026, 3, 1),  paymentMethod: PM.T },
    { student: "Maia",      status: "PAID",    paidAt: date(2026, 3, 10), paymentMethod: PM.C },
    { student: "Delfina",   status: "PAID",    paidAt: date(2026, 3, 3),  paymentMethod: PM.E },
    { student: "Alma",      status: "PAID",    paidAt: date(2026, 3, 15), paymentMethod: PM.T },
    { student: "Bianca",    status: "PAID",    paidAt: date(2026, 3, 2),  paymentMethod: PM.E },
    { student: "Pilar",     status: "PAID",    paidAt: date(2026, 3, 6),  paymentMethod: PM.C },
    { student: "Juana",     status: "PAID",    paidAt: date(2026, 3, 1),  paymentMethod: PM.T },
    { student: "Elena",     status: "PAID",    paidAt: date(2026, 3, 3),  paymentMethod: PM.E },
    { student: "Nina",      status: "PAID",    paidAt: date(2026, 3, 11), paymentMethod: PM.T },
    { student: "Zoe",       status: "PENDING", paidAt: null,              paymentMethod: null },
    // Formativo: 9 de 10 pagaron
    { student: "Abril",     status: "PAID",    paidAt: date(2026, 3, 1),  paymentMethod: PM.E },
    { student: "Catalina",  status: "PAID",    paidAt: date(2026, 3, 10), paymentMethod: PM.T },
    { student: "Victoria",  status: "PAID",    paidAt: date(2026, 3, 2),  paymentMethod: PM.C },
    { student: "Olivia",    status: "PAID",    paidAt: date(2026, 3, 3),  paymentMethod: PM.E },
    { student: "Antonella", status: "PAID",    paidAt: date(2026, 3, 15), paymentMethod: PM.T },
    { student: "Lola",      status: "PAID",    paidAt: date(2026, 3, 2),  paymentMethod: PM.E },
    { student: "Sara",      status: "PAID",    paidAt: date(2026, 3, 4),  paymentMethod: PM.C },
    { student: "Jazmín",    status: "PAID",    paidAt: date(2026, 3, 11), paymentMethod: PM.T },
    { student: "Rocio",     status: "PAID",    paidAt: date(2026, 3, 1),  paymentMethod: PM.E },
    { student: "Candela",   status: "PENDING", paidAt: null,              paymentMethod: null },
    // Elite: todos pagaron
    { student: "Sol",       status: "PAID",    paidAt: date(2026, 3, 1),  paymentMethod: PM.T },
    { student: "Luz",       status: "PAID",    paidAt: date(2026, 3, 2),  paymentMethod: PM.E },
    { student: "Mila",      status: "PAID",    paidAt: date(2026, 3, 1),  paymentMethod: PM.C },
    { student: "Uma",       status: "PAID",    paidAt: date(2026, 3, 3),  paymentMethod: PM.T },
    { student: "Gala",      status: "PAID",    paidAt: date(2026, 3, 2),  paymentMethod: PM.E },
    { student: "Mora",      status: "PAID",    paidAt: date(2026, 3, 4),  paymentMethod: PM.T },
    { student: "India",     status: "PAID",    paidAt: date(2026, 3, 1),  paymentMethod: PM.C },
  ]

  let paymentCount2 = 0
  for (const entry of gym2March) {
    const student = students2.find((s) => s.firstName === entry.student)!
    await db.payment.create({
      data: {
        gymId: gym2.id,
        studentId: student.id,
        period: firstOfMonth(2026, 3),
        baseAmount: monthlyAmounts2[student.id],
        amount: monthlyAmounts2[student.id],
        status: entry.status,
        paidAt: entry.paidAt,
        paymentMethod: entry.paymentMethod,
      },
    })
    paymentCount2++
  }

  console.log(`Gym2 Payments: ${paymentCount2} (Mar 2026)`)

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log(`
Resumen GYM360 Central (${gym.id}):
  Grupos: 5 | Alumnos: ${students.length} | Gastos fijos: $180k
  Pagos: ${paymentCount} (Ene-Mar) | Margenes negativos en varios grupos

Resumen GYM360 Palermo (${gym2.id}):
  Grupos: 3 | Alumnos: ${students2.length} | Gastos fijos: $103k
  Pagos: ${paymentCount2} (Mar) | Gym rentable, margenes positivos
  Iniciacion: 12 alumnos x $25k, prof $2.5k/h
  Formativo:  10 alumnos x $32k, prof $3k/h
  Elite:       7 alumnos x $45k, prof $3.5k/h

Login owner:      admin@gym360.com / admin1234
Login recepcion:  recepcion@gym360.com / recepcion1234  (GYM360 Central)
  `)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
