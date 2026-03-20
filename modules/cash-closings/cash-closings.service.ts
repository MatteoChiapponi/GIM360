import { db } from "@/lib/db"

interface CreateCashClosingInput {
  gymId: string
  notes?: string
}

/**
 * Creates a cash closing for a gym.
 * Captures ALL unverified PAID payments (any period).
 * Stores totals and breakdown by payment method.
 */
export async function createCashClosing(input: CreateCashClosingInput) {
  return db.$transaction(async (tx) => {
    const paidPayments = await tx.payment.findMany({
      where: { gymId: input.gymId, verified: false, status: "PAID" },
      orderBy: { paidAt: "asc" },
    })

    if (paidPayments.length === 0) {
      throw new Error("No hay pagos cobrados sin verificar")
    }

    const totalCollected = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0)

    let efectivoCount = 0, efectivoTotal = 0
    let transferenciaCount = 0, transferenciaTotal = 0
    let tarjetaCount = 0, tarjetaTotal = 0

    for (const p of paidPayments) {
      const amount = Number(p.amount)
      switch (p.paymentMethod) {
        case "EFECTIVO":
          efectivoCount++; efectivoTotal += amount; break
        case "TRANSFERENCIA":
          transferenciaCount++; transferenciaTotal += amount; break
        case "TARJETA":
          tarjetaCount++; tarjetaTotal += amount; break
      }
    }

    const fromDate = paidPayments[0].paidAt!
    const toDate = paidPayments[paidPayments.length - 1].paidAt!

    const closing = await tx.cashClosing.create({
      data: {
        gymId: input.gymId,
        fromDate,
        toDate,
        totalCollected,
        paidCount: paidPayments.length,
        efectivoCount,
        efectivoTotal,
        transferenciaCount,
        transferenciaTotal,
        tarjetaCount,
        tarjetaTotal,
        notes: input.notes,
      },
    })

    await tx.payment.updateMany({
      where: { id: { in: paidPayments.map((p) => p.id) } },
      data: { verified: true, cashClosingId: closing.id },
    })

    return closing
  })
}

/** Lists all cash closings for a gym, newest first */
export async function getCashClosingsByGym(gymId: string) {
  return db.cashClosing.findMany({
    where: { gymId },
    orderBy: { closedAt: "desc" },
  })
}

/** Gets a single cash closing with its linked payments */
export async function getCashClosingById(id: string) {
  return db.cashClosing.findFirst({
    where: { id },
    include: {
      payments: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
}
