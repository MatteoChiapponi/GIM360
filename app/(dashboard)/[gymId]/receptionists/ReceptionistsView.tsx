"use client"

import { useState } from "react"
import { useFetch } from "@/hooks/useFetch"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { FormField } from "@/components/ui/FormField"
import { PageHeader } from "@/components/ui/PageHeader"
import { DataTable } from "@/components/ui/DataTable"
import { FormModal } from "@/components/ui/FormModal"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { StatusDot } from "@/components/ui/StatusDot"

// ─── Types ──────────────────────────────────────────────────────────────────

type Receptionist = {
  id: string
  name: string
  active: boolean
  createdAt: string
  user: { email: string }
}

const EMPTY_FORM = { name: "", email: "", password: "", confirmPassword: "" }

// ─── Component ──────────────────────────────────────────────────────────────

export default function ReceptionistsView({ gymId }: { gymId: string }) {
  const { data: receptionists, loading, error, refetch } = useFetch<Receptionist[]>(
    `/api/receptionists?gymId=${gymId}`, [], "No se pudieron cargar los recepcionistas.",
  )

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const [resetForId, setResetForId] = useState<string | null>(null)
  const [resetForm, setResetForm] = useState({ password: "", confirmPassword: "" })
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSubmitting, setResetSubmitting] = useState(false)

  const pendingDelete = receptionists.find((r) => r.id === confirmDeleteId)
  const pendingReset = receptionists.find((r) => r.id === resetForId)

  function openForm() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowForm(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (form.password !== form.confirmPassword) {
      setFormError("Las contraseñas no coinciden.")
      return
    }
    if (form.password.length < 8) {
      setFormError("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/receptionists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId,
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setFormError(typeof body?.error === "string" ? body.error : "No se pudo crear el recepcionista.")
        return
      }

      setShowForm(false)
      setForm(EMPTY_FORM)
      await refetch()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(r: Receptionist) {
    setMutationError(null)
    const res = await fetch(`/api/receptionists/${r.id}?gymId=${gymId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !r.active }),
    })
    if (!res.ok) {
      setMutationError("No se pudo actualizar el acceso.")
      return
    }
    await refetch()
  }

  async function handleDelete() {
    if (!confirmDeleteId) return
    setMutationError(null)
    const res = await fetch(`/api/receptionists/${confirmDeleteId}?gymId=${gymId}`, { method: "DELETE" })
    setConfirmDeleteId(null)
    if (!res.ok) {
      setMutationError("No se pudo eliminar el recepcionista.")
      return
    }
    await refetch()
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetForId) return
    setResetError(null)

    if (resetForm.password !== resetForm.confirmPassword) {
      setResetError("Las contraseñas no coinciden.")
      return
    }
    if (resetForm.password.length < 8) {
      setResetError("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    setResetSubmitting(true)
    try {
      const res = await fetch(`/api/receptionists/${resetForId}/password?gymId=${gymId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetForm.password }),
      })
      if (!res.ok) {
        setResetError("No se pudo cambiar la contraseña.")
        return
      }
      setResetForId(null)
      setResetForm({ password: "", confirmPassword: "" })
    } finally {
      setResetSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recepción"
        subtitle="Accesos de recepción: alumnos, asistencias y cuotas"
        action={<Button onClick={openForm}>Nuevo recepcionista</Button>}
      />

      {mutationError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {mutationError}
        </div>
      )}

      <DataTable
        columns={[
          {
            key: "name",
            header: "Nombre",
            render: (r: Receptionist) => (
              <span className="font-medium text-[#111110]">{r.name}</span>
            ),
          },
          {
            key: "email",
            header: "Email",
            render: (r: Receptionist) => (
              <span className="text-sm text-[#68685F]">{r.user.email}</span>
            ),
          },
          {
            key: "status",
            header: "Acceso",
            render: (r: Receptionist) =>
              r.active ? (
                <StatusDot dotColor="bg-emerald-500" textColor="text-emerald-700" label="Activo" />
              ) : (
                <StatusDot dotColor="bg-[#C8C7C3]" textColor="text-[#A5A49D]" label="Desactivado" />
              ),
          },
          {
            key: "actions",
            header: "",
            align: "right",
            render: (r: Receptionist) => (
              <div className="flex justify-end gap-2">
                <Button variant="link" onClick={() => { setResetForId(r.id); setResetForm({ password: "", confirmPassword: "" }); setResetError(null) }}>
                  Contraseña
                </Button>
                <Button variant="link" onClick={() => handleToggleActive(r)}>
                  {r.active ? "Desactivar" : "Activar"}
                </Button>
                <Button variant="link" onClick={() => setConfirmDeleteId(r.id)}>
                  Eliminar
                </Button>
              </div>
            ),
          },
        ]}
        data={receptionists}
        loading={loading}
        error={error}
        emptyMessage="Todavía no hay recepcionistas"
        emptyHint="Creá un acceso de recepción para que puedan gestionar alumnos, asistencias y cuotas."
        rowKey={(r: Receptionist) => r.id}
      />

      <FormModal
        open={showForm}
        title="Nuevo recepcionista"
        error={formError}
        onSubmit={handleCreate}
        submitting={submitting}
        onCancel={() => setShowForm(false)}
        submitLabel="Crear acceso"
      >
        <FormField label="Nombre" required>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </FormField>
        <FormField label="Email" required>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </FormField>
        <FormField label="Contraseña" required>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={8}
            required
          />
        </FormField>
        <FormField label="Repetir contraseña" required>
          <Input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            minLength={8}
            required
          />
        </FormField>
      </FormModal>

      <FormModal
        open={!!resetForId}
        title={`Nueva contraseña${pendingReset ? ` — ${pendingReset.name}` : ""}`}
        error={resetError}
        onSubmit={handleResetPassword}
        submitting={resetSubmitting}
        onCancel={() => setResetForId(null)}
        submitLabel="Cambiar contraseña"
      >
        <FormField label="Contraseña" required>
          <Input
            type="password"
            value={resetForm.password}
            onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })}
            minLength={8}
            required
          />
        </FormField>
        <FormField label="Repetir contraseña" required>
          <Input
            type="password"
            value={resetForm.confirmPassword}
            onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
            minLength={8}
            required
          />
        </FormField>
      </FormModal>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Eliminar recepcionista"
        message={
          <>
            Se elimina el acceso de <span className="font-semibold">{pendingDelete?.name}</span> y su
            usuario para iniciar sesión. Esta acción no se puede deshacer.
          </>
        }
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
