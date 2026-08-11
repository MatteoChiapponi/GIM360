import { describe, it, expect, beforeEach, vi } from "vitest"
import bcrypt from "bcryptjs"

vi.mock("@/lib/db", () => import("./mocks/db"))

import { db, seed } from "./mocks/db"
import {
  createReceptionistWithUser,
  deleteReceptionist,
  resetReceptionistPassword,
} from "@/modules/receptionists/receptionists.service"
import { IDS, seedTwoGyms } from "./helpers"

beforeEach(() => {
  seedTwoGyms()
  seed("user", [{ id: IDS.receptionistUser1, email: "ocupado@gym360.com" }])
  db.user.create.mockResolvedValue({ id: "nuevo-user" })
  db.receptionist.create.mockResolvedValue({ id: "nuevo-recep" })
})

describe("createReceptionistWithUser", () => {
  const input = {
    gymId: IDS.gym1,
    name: "Sofia",
    email: "sofia@gym360.com",
    password: "unaClave123",
  }

  it("crea el User con rol RECEPTIONIST y lo liga al gimnasio", async () => {
    await createReceptionistWithUser(input)

    expect(db.user.create).toHaveBeenCalledTimes(1)
    const userArgs = db.user.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(userArgs.data.email).toBe(input.email)
    expect(userArgs.data.role).toBe("RECEPTIONIST")

    expect(db.receptionist.create).toHaveBeenCalledTimes(1)
    const recepArgs = db.receptionist.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(recepArgs.data).toMatchObject({ gymId: IDS.gym1, name: "Sofia", userId: "nuevo-user" })
  })

  it("nunca guarda la contraseña en texto plano", async () => {
    await createReceptionistWithUser(input)

    const { data } = db.user.create.mock.calls[0][0] as { data: { hashedPassword: string } }
    expect(data.hashedPassword).not.toBe(input.password)
    expect(data.hashedPassword).not.toContain(input.password)
    await expect(bcrypt.compare(input.password, data.hashedPassword)).resolves.toBe(true)
  })

  it("corre dentro de una transacción, para no dejar un User huérfano", async () => {
    await createReceptionistWithUser(input)
    expect(db.$transaction).toHaveBeenCalledTimes(1)
  })

  it("rechaza un email ya registrado y no toca la DB", async () => {
    await expect(
      createReceptionistWithUser({ ...input, email: "ocupado@gym360.com" }),
    ).rejects.toThrow("EMAIL_TAKEN")

    expect(db.user.create).not.toHaveBeenCalled()
    expect(db.receptionist.create).not.toHaveBeenCalled()
  })
})

describe("deleteReceptionist", () => {
  it("borra el User — el Receptionist se va por cascade", async () => {
    await deleteReceptionist(IDS.receptionist1)

    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: IDS.receptionistUser1 } })
    // No borra la fila de Receptionist a mano: la FK tiene onDelete: Cascade.
    expect(db.receptionist.delete).not.toHaveBeenCalled()
  })

  it("falla con NOT_FOUND si el recepcionista no existe", async () => {
    await expect(deleteReceptionist("no-existe")).rejects.toThrow("NOT_FOUND")
    expect(db.user.delete).not.toHaveBeenCalled()
  })
})

describe("resetReceptionistPassword", () => {
  it("actualiza el hash del User dueño del perfil", async () => {
    await resetReceptionistPassword(IDS.receptionist1, "otraClave456")

    expect(db.user.update).toHaveBeenCalledTimes(1)
    const args = db.user.update.mock.calls[0][0] as {
      where: { id: string }
      data: { hashedPassword: string }
    }
    expect(args.where.id).toBe(IDS.receptionistUser1)
    await expect(bcrypt.compare("otraClave456", args.data.hashedPassword)).resolves.toBe(true)
  })

  it("falla con NOT_FOUND si el recepcionista no existe", async () => {
    await expect(resetReceptionistPassword("no-existe", "otraClave456")).rejects.toThrow("NOT_FOUND")
    expect(db.user.update).not.toHaveBeenCalled()
  })
})
