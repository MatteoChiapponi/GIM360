import { db } from "@/lib/db"

interface CreateCashClosingInput {
  gymId: string
  notes?: string
  excludedPaymentIds?: string[]
}

/**
 * Creates a cash closing for a gym.
 * Captures ALL unverified PAID payments (any period).
 * Stores totals and breakdown by payment method.
 */
export async function createCashClosing(input: CreateCashClosingInput) {
  return db.$transaction(async (tx) => {
    const paidPayments = await tx.payment.findMany({
      where: {
        gymId: input.gymId,
        verified: false,
        status: "PAID",
        ...(input.excludedPaymentIds?.length ? { id: { notIn: input.excludedPaymentIds } } : {}),
      },
      orderBy: { paidAt: "asc" },
    })

    if (paidPayments.length === 0) {
      throw new Error("No hay pagos cobrados sin verificar")
    }

    const round2 = (n: number) => Math.round(n * 100) / 100

    const totalCollected = round2(paidPayments.reduce((sum, p) => sum + Number(p.amount), 0))

    let cashCount = 0, cashTotal = 0
    let transferCount = 0, transferTotal = 0
    let cardCount = 0, cardTotal = 0

    for (const p of paidPayments) {
      const amount = Number(p.amount)
      switch (p.paymentMethod) {
        case "CASH":
          cashCount++; cashTotal += amount; break
        case "TRANSFER":
          transferCount++; transferTotal += amount; break
        case "CARD":
          cardCount++; cardTotal += amount; break
      }
    }

    cashTotal = round2(cashTotal)
    transferTotal = round2(transferTotal)
    cardTotal = round2(cardTotal)

    const fromDate = paidPayments[0].paidAt!
    const toDate = paidPayments[paidPayments.length - 1].paidAt!

    const closing = await tx.cashClosing.create({
      data: {
        gymId: input.gymId,
        fromDate,
        toDate,
        totalCollected,
        paidCount: paidPayments.length,
        cashCount,
        cashTotal,
        transferCount,
        transferTotal,
        cardCount,
        cardTotal,
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

/**
 * Undoes the most recent cash closing for a gym.
 * Removes the closing record and resets all its payments to unverified (cashClosingId = null, verified = false).
 */
export async function undoLastCashClosing(gymId: string) {
  return db.$transaction(async (tx) => {
    const lastClosing = await tx.cashClosing.findFirst({
      where: { gymId },
      orderBy: { closedAt: "desc" },
    })

    if (!lastClosing) {
      throw new Error("No hay cierres de caja para deshacer")
    }

    await tx.payment.updateMany({
      where: { cashClosingId: lastClosing.id },
      data: { verified: false, cashClosingId: null },
    })

    await tx.cashClosing.delete({ where: { id: lastClosing.id } })

    return lastClosing
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
