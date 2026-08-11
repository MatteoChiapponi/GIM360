import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/lib/db", () => import("./mocks/db"))

import {
  gymBelongsToOwner,
  gymBelongsToReceptionist,
  gymBelongsToUser,
  receptionistBelongsToGym,
} from "@/modules/belongs/belongs.service"
import { IDS, seedTwoGyms } from "./helpers"

beforeEach(() => seedTwoGyms())

describe("gymBelongsToReceptionist", () => {
  it("acepta al recepcionista activo de ese gimnasio", async () => {
    await expect(gymBelongsToReceptionist(IDS.gym1, IDS.receptionistUser1)).resolves.toBe(true)
  })

  it("rechaza al recepcionista de otro gimnasio", async () => {
    await expect(gymBelongsToReceptionist(IDS.gym1, IDS.receptionistUser2)).resolves.toBe(false)
    await expect(gymBelongsToReceptionist(IDS.gym2, IDS.receptionistUser1)).resolves.toBe(false)
  })

  it("rechaza al recepcionista desactivado de ese mismo gimnasio", async () => {
    await expect(gymBelongsToReceptionist(IDS.gym1, IDS.receptionistUserInactive)).resolves.toBe(false)
  })

  it("rechaza a un usuario que no es recepcionista", async () => {
    await expect(gymBelongsToReceptionist(IDS.gym1, IDS.ownerUser1)).resolves.toBe(false)
    await expect(gymBelongsToReceptionist(IDS.gym1, IDS.trainerUser1)).resolves.toBe(false)
    await expect(gymBelongsToReceptionist(IDS.gym1, "usuario-inexistente")).resolves.toBe(false)
  })
})

describe("receptionistBelongsToGym", () => {
  it("resuelve por id de recepcionista, sin mirar active", async () => {
    await expect(receptionistBelongsToGym(IDS.receptionist1, IDS.gym1)).resolves.toBe(true)
    // El owner tiene que poder re-activar a uno desactivado.
    await expect(receptionistBelongsToGym(IDS.receptionistInactive, IDS.gym1)).resolves.toBe(true)
  })

  it("rechaza cruces entre gimnasios", async () => {
    await expect(receptionistBelongsToGym(IDS.receptionist2, IDS.gym1)).resolves.toBe(false)
    await expect(receptionistBelongsToGym(IDS.receptionist1, IDS.gym2)).resolves.toBe(false)
  })
})

describe("gymBelongsToUser", () => {
  it("acepta owner, trainer y recepcionista activo del gimnasio", async () => {
    await expect(gymBelongsToUser(IDS.gym1, IDS.ownerUser1)).resolves.toBe(true)
    await expect(gymBelongsToUser(IDS.gym1, IDS.trainerUser1)).resolves.toBe(true)
    await expect(gymBelongsToUser(IDS.gym1, IDS.receptionistUser1)).resolves.toBe(true)
  })

  it("rechaza al recepcionista desactivado", async () => {
    await expect(gymBelongsToUser(IDS.gym1, IDS.receptionistUserInactive)).resolves.toBe(false)
  })

  it("no filtra entre gimnasios", async () => {
    await expect(gymBelongsToUser(IDS.gym2, IDS.ownerUser1)).resolves.toBe(false)
    await expect(gymBelongsToUser(IDS.gym2, IDS.receptionistUser1)).resolves.toBe(false)
    await expect(gymBelongsToUser(IDS.gym2, IDS.trainerUser1)).resolves.toBe(false)
  })

  it("rechaza a un usuario sin vínculo con ningún gimnasio", async () => {
    await expect(gymBelongsToUser(IDS.gym1, "usuario-suelto")).resolves.toBe(false)
  })
})

describe("gymBelongsToOwner sigue siendo estricto", () => {
  it("no acepta recepcionistas ni trainers", async () => {
    await expect(gymBelongsToOwner(IDS.gym1, IDS.ownerUser1)).resolves.toBe(true)
    await expect(gymBelongsToOwner(IDS.gym1, IDS.receptionistUser1)).resolves.toBe(false)
    await expect(gymBelongsToOwner(IDS.gym1, IDS.trainerUser1)).resolves.toBe(false)
  })
})
