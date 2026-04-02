"use client"

import { useState, useEffect } from "react"
import { useFetch } from "@/hooks/useFetch"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { FormField } from "@/components/ui/FormField"
import { NumberInput } from "@/components/ui/NumberInput"
import { Select } from "@/components/ui/Select"
import { StatCard } from "@/components/ui/StatCard"
import { StatusDot } from "@/components/ui/StatusDot"
import { Tabs } from "@/components/ui/Tabs"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchToolbar } from "@/components/ui/SearchToolbar"
import { DataTable } from "@/components/ui/DataTable"
import { FormModal } from "@/components/ui/FormModal"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

// ─── Types ────────────────────────────────────────────────────────────────────

type StudentStatus = "ACTIVE" | "INACTIVE" | "TRIAL"
type StudentFileType = "FICHA" | "APTO_MEDICO"
type PaymentStatus = "PENDING" | "PAID" | "EXPIRED"
type PaymentMethod = "CASH" | "TRANSFER" | "CARD"

type StudentPayment = {
  id: string
  period: string
  amount: string
  status: PaymentStatus
  paymentMethod: PaymentMethod | null
  paidAt: string | null
  verified: boolean
}

type StudentFile = {
  id: string
  fileType: StudentFileType
  fileName: string
  sizeBytes: number
  uploadedAt: string
  signedUrl: string | null
}
type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY"

type Student = {
  id: string; firstName: string; lastName: string
  phone1: string; phone2: string | null
  leftAt: string | null; dueDay: number
  status: StudentStatus
  trialEndsAt: string | null
  files: { fileType: StudentFileType }[]
}

type GroupSchedule = {
  id: string; weekDays: DayOfWeek[]; startTime: string; endTime: string
}

type EnrolledGroup = {
  id: string; enrolledAt: string
  group: { id: string; name: string; monthlyPrice: string; schedules: GroupSchedule[] }
}

type StudentDetail = {
  id: string; firstName: string; lastName: string
  phone1: string; phone2: string | null; emergencyContact: string | null; emergencyPhone: string | null
  birthDate: string | null; nationalId: string | null
  joinedAt: string; leftAt: string | null; dueDay: number
  status: StudentStatus
  trialEndsAt: string | null
  groups: EnrolledGroup[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_SHORT: Record<DayOfWeek, string> = {
  MONDAY: "Lun", TUESDAY: "Mar", WEDNESDAY: "Mié",
  THURSDAY: "Jue", FRIDAY: "Vie", SATURDAY: "Sáb", SUNDAY: "Dom",
}

const DAY_ORDER: Record<DayOfWeek, number> = {
  MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-AR")
}

function fmtCurrency(value: string | number) {
  const n = typeof value === "string" ? parseFloat(value) : value
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
}

// ─── Main Component ───────────────────────────────────────────────────────────

type SimpleGroup = { id: string; name: string }

type FilterTab = "ACTIVOS" | "TODOS"
type NewForm = {
  firstName: string; lastName: string; dueDay: string; phone1: string; phone2: string; groupId: string
  fichaFile: File | null; aptoFile: File | null
  isTrial: boolean; trialEndsAt: string
}
type EditForm = { firstName: string; lastName: string; dueDay: string; phone1: string; phone2: string }

const EMPTY_FORM: NewForm = {
  firstName: "", lastName: "", dueDay: "", phone1: "", phone2: "", groupId: "",
  fichaFile: null, aptoFile: null,
  isTrial: false, trialEndsAt: "",
}
const EMPTY_EDIT: EditForm = { firstName: "", lastName: "", dueDay: "", phone1: "", phone2: "" }

export default function StudentsView({ gymId }: { gymId: string }) {
  const { data: students, loading, error, refetch } = useFetch<Student[]>(
    `/api/students?gymId=${gymId}`, [], "No se pudieron cargar los alumnos.",
  )

  const [filter, setFilter] = useState<FilterTab>("ACTIVOS")
  const [search, setSearch] = useState("")
  type SortKey = "lastName" | "firstName" | "dueDay"
  const [sortKey, setSortKey] = useState<SortKey>("lastName")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  // Create modal
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [gymGroups, setGymGroups] = useState<SimpleGroup[]>([])

  useEffect(() => {
    if (!showForm) return
    const controller = new AbortController()
    fetch(`/api/groups?gymId=${gymId}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : [])
      .then((groups) =>
        setGymGroups(groups.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })))
      )
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return
      })
    return () => controller.abort()
  }, [showForm, gymId])

  // Detail panel
  const [panelOpen, setPanelOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<StudentDetail | null>(null)

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Deactivate confirm
  const [confirmId, setConfirmId] = useState<string | null>(null)

  // Reactivate
  const [reactivating, setReactivating] = useState(false)

  // Payment history
  const [studentPayments, setStudentPayments] = useState<StudentPayment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)

  // Files
  const [files, setFiles] = useState<StudentFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)
  const [uploadingType, setUploadingType] = useState<StudentFileType | null>(null)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [confirmFileId, setConfirmFileId] = useState<string | null>(null)

  // ─── Derived counts ────────────────────────────────────────────────────────
  const countActivo = students.filter((s) => s.status === "ACTIVE").length
  const countPrueba = students.filter((s) => s.status === "TRIAL").length
  const countInactivo = students.filter((s) => s.status === "INACTIVE").length

  // ─── Filtering & sorting ───────────────────────────────────────────────────
  const base = filter === "ACTIVOS"
    ? students.filter((s) => s.status !== "INACTIVE")
    : students

  const displayed = base
    .filter((s) =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      s.phone1.includes(search)
    )
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === "lastName") cmp = a.lastName.localeCompare(b.lastName)
      else if (sortKey === "firstName") cmp = a.firstName.localeCompare(b.firstName)
      else if (sortKey === "dueDay") cmp = a.dueDay - b.dueDay
      return sortDir === "asc" ? cmp : -cmp
    })

  async function openDetail(s: Student) {
    setPanelOpen(true)
    setShowEditModal(false)
    setEditError(null)
    setSelectedDetail(null)
    setFiles([])
    setFilesError(null)
    setStudentPayments([])
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/students/${s.id}?gymId=${gymId}`)
      if (res.ok) setSelectedDetail(await res.json())
    } finally {
      setDetailLoading(false)
    }
    await loadFiles(s.id)
    setPaymentsLoading(true)
    fetch(`/api/payments?gymId=${gymId}&studentId=${s.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Error al cargar los pagos.")
        return r.json()
      })
      .then((data) => { if (Array.isArray(data)) setStudentPayments(data) })
      .catch(() => {})
      .finally(() => setPaymentsLoading(false))
  }

  function closeDetail() {
    setPanelOpen(false)
    setSelectedDetail(null)
    setShowEditModal(false)
    setEditError(null)
    setFiles([])
    setFilesError(null)
  }

  async function loadFiles(studentId: string) {
    setFilesLoading(true)
    setFilesError(null)
    try {
      const res = await fetch(`/api/students/${studentId}/files?gymId=${gymId}`)
      if (res.ok) setFiles(await res.json())
      else setFilesError("No se pudieron cargar los archivos.")
    } catch {
      setFilesError("No se pudieron cargar los archivos.")
    } finally {
      setFilesLoading(false)
    }
  }

  async function handleUploadFile(type: StudentFileType, file: File) {
    if (!selectedDetail) return
    setUploadingType(type)
    const fd = new FormData()
    fd.append("gymId", gymId)
    fd.append("fileType", type)
    fd.append("file", file)
    try {
      const res = await fetch(`/api/students/${selectedDetail.id}/files`, { method: "POST", body: fd })
      if (res.ok) { await loadFiles(selectedDetail.id); await refetch() }
      else {
        const d = await res.json().catch(() => ({}))
        setFilesError(d?.error ?? "No se pudo subir el archivo.")
      }
    } catch {
      setFilesError("Error de conexión. Intentá de nuevo.")
    } finally {
      setUploadingType(null)
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!selectedDetail) return
    setDeletingFileId(fileId)
    try {
      const res = await fetch(`/api/students/${selectedDetail.id}/files/${fileId}?gymId=${gymId}`, { method: "DELETE" })
      if (res.ok) { setFiles((prev) => prev.filter((f) => f.id !== fileId)); await refetch() }
    } finally {
      setDeletingFileId(null)
    }
  }

  function startEdit() {
    if (!selectedDetail) return
    setEditForm({
      firstName: selectedDetail.firstName,
      lastName: selectedDetail.lastName,
      dueDay: String(selectedDetail.dueDay),
      phone1: selectedDetail.phone1,
      phone2: selectedDetail.phone2 ?? "",
    })
    setShowEditModal(true)
    setEditError(null)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDetail) return
    setEditError(null)
    if (!editForm.firstName.trim()) { setEditError("El nombre es obligatorio."); return }
    if (!editForm.lastName.trim()) { setEditError("El apellido es obligatorio."); return }
    const day = Number(editForm.dueDay)
    if (isNaN(day) || day < 1 || day > 31) { setEditError("El día de cobro debe ser entre 1 y 31."); return }

    setEditSubmitting(true)
    const res = await fetch(`/api/students/${selectedDetail.id}?gymId=${gymId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: editForm.firstName.trim(), lastName: editForm.lastName.trim(),
        dueDay: day,
        phone1: editForm.phone1.trim(),
        phone2: editForm.phone2.trim() || null,
      }),
    })
    if (res.ok) {
      setShowEditModal(false)
      const [updated] = await Promise.all([
        fetch(`/api/students/${selectedDetail.id}?gymId=${gymId}`).then((r) => r.json()),
        refetch(),
      ])
      setSelectedDetail(updated)
    } else {
      const d = await res.json().catch(() => ({}))
      const err = d?.error
      setEditError(typeof err === "string" ? err : "No se pudo actualizar el alumno.")
    }
    setEditSubmitting(false)
  }

  async function handleDeactivate(id: string) {
    const res = await fetch(`/api/students/${id}?gymId=${gymId}`, { method: "DELETE" })
    if (res.ok) { closeDetail(); await refetch() }
  }

  async function handleReactivate() {
    if (!selectedDetail) return
    setReactivating(true)
    const res = await fetch(`/api/students/${selectedDetail.id}?gymId=${gymId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    })
    if (res.ok) {
      const [updated] = await Promise.all([
        fetch(`/api/students/${selectedDetail.id}?gymId=${gymId}`).then((r) => r.json()),
        refetch(),
      ])
      setSelectedDetail(updated)
    }
    setReactivating(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.firstName.trim()) { setFormError("El nombre es obligatorio."); return }
    if (!form.lastName.trim()) { setFormError("El apellido es obligatorio."); return }
    if (!form.dueDay) { setFormError("El día de cobro es obligatorio."); return }
    const day = Number(form.dueDay)
    if (isNaN(day) || day < 1 || day > 31) { setFormError("El día de cobro debe ser entre 1 y 31."); return }
    if (form.isTrial && !form.trialEndsAt) { setFormError("Ingresá la fecha de fin del período de prueba."); return }
    if (!form.phone1.trim()) { setFormError("El teléfono principal es obligatorio."); return }

    setSubmitting(true)
    const body: Record<string, unknown> = {
      gymId, firstName: form.firstName.trim(), lastName: form.lastName.trim(), dueDay: day,
      phone1: form.phone1.trim(),
    }
    if (form.phone2.trim()) body.phone2 = form.phone2.trim()
    if (form.isTrial) {
      body.status = "TRIAL"
      body.trialEndsAt = new Date(form.trialEndsAt).toISOString()
    }

    const res = await fetch("/api/students", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setFormError(d?.error ?? "No se pudo crear el alumno.")
      setSubmitting(false)
      return
    }

    const created = await res.json()

    // Optional: enroll in group
    if (form.groupId) {
      const enrollRes = await fetch(`/api/groups/${form.groupId}/students?gymId=${gymId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: created.id }),
      })
      if (!enrollRes.ok) {
        setFormError("Alumno creado, pero no se pudo inscribir en el grupo.")
        setSubmitting(false)
        await refetch()
        return
      }
    }

    // Optional: upload files
    const filesToUpload: { fileType: StudentFileType; file: File }[] = []
    if (form.fichaFile) filesToUpload.push({ fileType: "FICHA", file: form.fichaFile })
    if (form.aptoFile) filesToUpload.push({ fileType: "APTO_MEDICO", file: form.aptoFile })
    for (const { fileType, file } of filesToUpload) {
      const fd = new FormData()
      fd.append("gymId", gymId)
      fd.append("fileType", fileType)
      fd.append("file", file)
      const uploadRes = await fetch(`/api/students/${created.id}/files`, { method: "POST", body: fd })
      if (!uploadRes.ok) {
        setFormError("Alumno creado, pero no se pudo subir uno o más archivos.")
        setSubmitting(false)
        await refetch()
        return
      }
    }

    setForm(EMPTY_FORM); setShowForm(false); await refetch()
    setSubmitting(false)
  }

  // ─── Status helpers ────────────────────────────────────────────────────────

  function statusLabel(status: StudentStatus) {
    if (status === "ACTIVE") return "Activo"
    if (status === "TRIAL") return "Prueba"
    return "Baja"
  }

  function statusDotColor(status: StudentStatus) {
    if (status === "ACTIVE") return "bg-emerald-500"
    if (status === "TRIAL") return "bg-amber-500"
    return "bg-red-500"
  }

  function statusTextColor(status: StudentStatus) {
    if (status === "ACTIVE") return "text-emerald-700"
    if (status === "TRIAL") return "text-amber-700"
    return "text-red-700"
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alumnos"
        subtitle="Listado de alumnos del gimnasio"
        action={<Button onClick={() => { setShowForm(true); setFormError(null) }}>+ Nuevo alumno</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Activos" value={countActivo} valueColor="text-emerald-700" />
        <StatCard label="Prueba" value={countPrueba} valueColor="text-amber-700" />
        <StatCard label="Bajas" value={countInactivo} valueColor="text-red-700" />
      </div>

      <Tabs
        tabs={[{ key: "ACTIVOS" as FilterTab, label: "Activos" }, { key: "TODOS" as FilterTab, label: "Todos" }]}
        active={filter}
        onChange={setFilter}
      />

      <SearchToolbar
        search={search} onSearchChange={setSearch} placeholder="Buscar por nombre o teléfono…"
        searchWidth="sm:w-72"
        sortOptions={[
          { value: "lastName", label: "Ordenar por apellido" },
          { value: "firstName", label: "Ordenar por nombre" },
          { value: "dueDay", label: "Ordenar por día de cobro" },
        ]}
        sortKey={sortKey} onSortKeyChange={(k) => setSortKey(k as SortKey)}
        sortDir={sortDir} onSortDirToggle={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
      />

      <FormModal
        open={showForm}
        title="Nuevo alumno"
        error={formError}
        onSubmit={handleCreate}
        submitting={submitting}
        onCancel={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(null) }}
        gridCols="sm:grid-cols-2"
      >
        <FormField label="Nombre" required>
          <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="Ej: María" />
        </FormField>
        <FormField label="Apellido" required>
          <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Ej: García" />
        </FormField>
        <FormField label="Día de cobro" required>
          <NumberInput integer value={form.dueDay} onChange={(e) => setForm((f) => ({ ...f, dueDay: e.target.value }))} placeholder="Ej: 10" />
        </FormField>
        <FormField label="Teléfono principal (WhatsApp)" required>
          <Input value={form.phone1} onChange={(e) => setForm((f) => ({ ...f, phone1: e.target.value }))} placeholder="Ej: 11 1234-5678" />
        </FormField>
        <FormField label="Teléfono secundario">
          <Input value={form.phone2} onChange={(e) => setForm((f) => ({ ...f, phone2: e.target.value }))} placeholder="Ej: 11 8765-4321" />
        </FormField>
        <FormField label="Agregar a grupo">
          <Select value={form.groupId} onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}>
            <option value="">Sin grupo</option>
            {gymGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </FormField>

        {/* Trial period toggle — spans both columns */}
        <div className="col-span-full border-t border-[#F0EFEB] pt-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Estado</p>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              role="checkbox"
              aria-checked={form.isTrial}
              tabIndex={0}
              onClick={() => setForm((f) => ({ ...f, isTrial: !f.isTrial, trialEndsAt: "" }))}
              onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") setForm((f) => ({ ...f, isTrial: !f.isTrial, trialEndsAt: "" })) }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#111110] focus:ring-offset-1 ${form.isTrial ? "bg-amber-500 border-amber-500" : "bg-[#E5E4E0] border-[#E5E4E0]"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${form.isTrial ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm text-[#111110]">Período de prueba</span>
          </label>
          {form.isTrial && (
            <FormField label="Fin del período de prueba" required>
              <input
                type="date"
                value={form.trialEndsAt}
                onChange={(e) => setForm((f) => ({ ...f, trialEndsAt: e.target.value }))}
                className="w-full rounded-lg border border-[#E5E4E0] bg-white px-4 py-3 text-sm text-[#111110] focus:border-[#111110] focus:outline-none transition-colors"
              />
            </FormField>
          )}
        </div>

        {/* File upload section — spans both columns */}
        <div className="col-span-full border-t border-[#F0EFEB] pt-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Documentos</p>
          <p className="text-xs text-[#A5A49D] -mt-2">Formatos: PDF, JPG, PNG, WEBP. Máx. 10 MB</p>

          <FormField label="Ficha de alumno">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[#E5E4E0] bg-white px-3 py-2 text-sm font-medium text-[#68685F] hover:text-[#111110] hover:bg-[#FAFAF9] transition-colors shrink-0">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 7.4 8.1 13.8a3.5 3.5 0 0 1-5-5L9.6 2.4a2.33 2.33 0 0 1 3.3 3.3l-6.4 6.4a1.17 1.17 0 0 1-1.7-1.6l6-6.1"/></svg>
                Adjuntar
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    setForm((prev) => ({ ...prev, fichaFile: f }))
                  }}
                />
              </label>
              <span className="text-sm text-[#A5A49D] truncate min-w-0">
                {form.fichaFile ? form.fichaFile.name : "Ningún archivo seleccionado"}
              </span>
            </div>
          </FormField>

          <FormField label="Apto médico">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[#E5E4E0] bg-white px-3 py-2 text-sm font-medium text-[#68685F] hover:text-[#111110] hover:bg-[#FAFAF9] transition-colors shrink-0">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 7.4 8.1 13.8a3.5 3.5 0 0 1-5-5L9.6 2.4a2.33 2.33 0 0 1 3.3 3.3l-6.4 6.4a1.17 1.17 0 0 1-1.7-1.6l6-6.1"/></svg>
                Adjuntar
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    setForm((prev) => ({ ...prev, aptoFile: f }))
                  }}
                />
              </label>
              <span className="text-sm text-[#A5A49D] truncate min-w-0">
                {form.aptoFile ? form.aptoFile.name : "Ningún archivo seleccionado"}
              </span>
            </div>
          </FormField>
        </div>
      </FormModal>

      <DataTable
        columns={[
          { key: "name", header: "Nombre", render: (s) => (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-medium ${s.status !== "INACTIVE" ? "text-[#111110]" : "text-[#A5A49D]"}`}>
                {s.firstName} {s.lastName}
              </span>
              {s.status === "TRIAL" && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                  Prueba
                </span>
              )}
              {s.status === "INACTIVE" && (
                <span className="text-[10px] uppercase tracking-wider text-[#A5A49D] bg-[#F7F6F3] px-1.5 py-0.5 rounded">
                  Baja
                </span>
              )}
              {s.status === "TRIAL" && s.trialEndsAt && (
                <span className="text-[10px] text-[#A5A49D]">hasta {fmtDate(s.trialEndsAt)}</span>
              )}
            </div>
          )},
          { key: "phone1", header: "Tel.", render: (s) => <span className="text-[#68685F]">{s.phone1}</span> },
          { key: "ficha", header: "Ficha alumno", render: (s) => s.files.some((f) => f.fileType === "FICHA")
            ? <span className="text-xs font-medium text-emerald-700">Cargado</span>
            : <span className="text-xs text-[#A5A49D]">No cargado</span> },
          { key: "apto", header: "Apto médico", render: (s) => s.files.some((f) => f.fileType === "APTO_MEDICO")
            ? <span className="text-xs font-medium text-emerald-700">Cargado</span>
            : <span className="text-xs text-[#A5A49D]">No cargado</span> },
          { key: "dueDay", header: "Día de cobro", align: "right", render: (s) => <span className="font-mono text-[#68685F]">{s.dueDay}</span> },
        ]}
        data={displayed}
        loading={loading}
        error={error}
        emptyMessage={search ? "Sin resultados para esa búsqueda." : filter === "ACTIVOS" ? "No hay alumnos activos." : "No hay alumnos registrados."}
        emptyHint={!search ? "Agregá el primer alumno con el botón de arriba." : undefined}
        minWidth="500px"
        rowKey={(s) => s.id}
        onRowClick={openDetail}
      />

      {/* ─── Detail Panel (slide-over) ──────────────────────────────────────── */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={closeDetail} />

          <div className="relative w-full max-w-md bg-white shadow-xl border-l border-[#E5E4E0] overflow-y-auto animate-in slide-in-from-right duration-200">
            {detailLoading || !selectedDetail ? (
              <div className="px-6 py-5 space-y-3">
                <div className="h-6 w-44 animate-pulse rounded bg-[#F0EFEB]" />
                <div className="h-4 w-28 animate-pulse rounded bg-[#F0EFEB]" />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-6 py-5 border-b border-[#F0EFEB] flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[#111110]">{selectedDetail.firstName} {selectedDetail.lastName}</h2>
                    <p className="text-xs text-[#A5A49D] mt-0.5">
                      {statusLabel(selectedDetail.status)} · {selectedDetail.groups.length} grupo{selectedDetail.groups.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button onClick={closeDetail} className="cursor-pointer text-[#A5A49D] hover:text-[#111110] transition-colors p-1 shrink-0">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l12 12M14 2L2 14" /></svg>
                  </button>
                </div>

                <div className="px-6 py-5 space-y-6">
                  {/* ── Acciones ─────────────────────────────────────────── */}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="secondary" onClick={startEdit}>Editar</Button>
                    {selectedDetail.status !== "INACTIVE" && (
                      <Button variant="danger" onClick={() => setConfirmId(selectedDetail.id)}>Dar de baja</Button>
                    )}
                    {selectedDetail.status === "INACTIVE" && (
                      <Button
                        variant="primary"
                        onClick={handleReactivate}
                        disabled={reactivating}
                      >
                        {reactivating ? "Reactivando…" : "Reactivar"}
                      </Button>
                    )}
                  </div>

                  {/* ── Información ──────────────────────────────────────── */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A5A49D] mb-3">Información</h3>
                    <div className="space-y-2">
                      <div className="rounded-lg border border-[#E5E4E0] bg-[#FAFAF9] px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A5A49D]">Estado</p>
                        <div className="mt-1.5">
                          <StatusDot
                            dotColor={statusDotColor(selectedDetail.status)}
                            textColor={statusTextColor(selectedDetail.status)}
                            label={statusLabel(selectedDetail.status)}
                          />
                        </div>
                        {selectedDetail.status === "TRIAL" && selectedDetail.trialEndsAt && (
                          <p className="mt-1 text-xs text-amber-700">
                            Prueba hasta {fmtDate(selectedDetail.trialEndsAt)}
                          </p>
                        )}
                        {selectedDetail.status === "INACTIVE" && selectedDetail.leftAt && (
                          <p className="mt-1 text-xs text-[#A5A49D]">
                            Baja desde {fmtDate(selectedDetail.leftAt)}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-[#E5E4E0] bg-[#FAFAF9] px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A5A49D]">Día de cobro</p>
                          <p className="mt-1 font-mono text-sm font-semibold text-[#111110]">{selectedDetail.dueDay}</p>
                        </div>
                        <div className="rounded-lg border border-[#E5E4E0] bg-[#FAFAF9] px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A5A49D]">Fecha de ingreso</p>
                          <p className="mt-1 text-sm text-[#111110]">{fmtDate(selectedDetail.joinedAt)}</p>
                        </div>
                      </div>

                      {(selectedDetail.phone1 || selectedDetail.phone2 || selectedDetail.emergencyContact || selectedDetail.emergencyPhone) && (
                        <div className="rounded-lg border border-[#E5E4E0] bg-[#FAFAF9] px-3 py-2.5 space-y-2">
                          {selectedDetail.phone1 && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A5A49D]">Teléfono (WhatsApp)</p>
                              <p className="mt-0.5 text-sm text-[#111110]">{selectedDetail.phone1}</p>
                            </div>
                          )}
                          {selectedDetail.phone2 && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A5A49D]">Teléfono 2</p>
                              <p className="mt-0.5 text-sm text-[#111110]">{selectedDetail.phone2}</p>
                            </div>
                          )}
                          {selectedDetail.emergencyContact && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A5A49D]">Contacto de emergencia</p>
                              <p className="mt-0.5 text-sm text-[#111110]">
                                {selectedDetail.emergencyContact}
                                {selectedDetail.emergencyPhone ? ` · ${selectedDetail.emergencyPhone}` : ""}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {(selectedDetail.nationalId || selectedDetail.birthDate) && (
                        <div className="rounded-lg border border-[#E5E4E0] bg-[#FAFAF9] px-3 py-2.5 space-y-2">
                          {selectedDetail.nationalId && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A5A49D]">DNI</p>
                              <p className="mt-0.5 font-mono text-sm text-[#111110]">{selectedDetail.nationalId}</p>
                            </div>
                          )}
                          {selectedDetail.birthDate && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A5A49D]">Fecha de nacimiento</p>
                              <p className="mt-0.5 text-sm text-[#111110]">{fmtDate(selectedDetail.birthDate)}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Grupos ───────────────────────────────────────────── */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A5A49D] mb-3">Grupos inscriptos</h3>
                    {selectedDetail.groups.length === 0 ? (
                      <p className="text-sm text-[#A5A49D]">No está inscripto en ningún grupo.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedDetail.groups.map((eg) => (
                          <div key={eg.id} className="rounded-lg border border-[#E5E4E0] bg-white p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-[#111110]">{eg.group.name}</span>
                              <span className="font-mono text-sm text-[#111110]">{fmtCurrency(eg.group.monthlyPrice)}/mes</span>
                            </div>
                            {eg.group.schedules.length > 0 && (
                              <div>
                                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Horarios</span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {eg.group.schedules.map((s) =>
                                    [...s.weekDays]
                                      .sort((a, b) => DAY_ORDER[a] - DAY_ORDER[b])
                                      .map((d) => (
                                        <span key={`${s.id}-${d}`} className="inline-block text-xs bg-[#F0EFEB] text-[#68685F] px-2 py-1 rounded">
                                          {DAY_SHORT[d]} {s.startTime}–{s.endTime}
                                        </span>
                                      ))
                                  )}
                                </div>
                              </div>
                            )}
                            <p className="text-[11px] text-[#A5A49D] border-t border-[#F0EFEB] pt-2">
                              Inscripto desde {fmtDate(eg.enrolledAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Cuotas ───────────────────────────────────────────── */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A5A49D] mb-3">Historial de cuotas</h3>
                    {paymentsLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-[#F0EFEB]" />)}
                      </div>
                    ) : studentPayments.length === 0 ? (
                      <p className="text-sm text-[#A5A49D]">No hay cuotas registradas.</p>
                    ) : (
                      <div className="rounded-lg border border-[#E5E4E0] overflow-hidden">
                        {studentPayments.map((p, i) => {
                          const [year, month] = p.period.split("T")[0].split("-")
                          const periodLabel = new Date(Number(year), Number(month) - 1, 1)
                            .toLocaleDateString("es-AR", { month: "long", year: "numeric" })
                          const statusColors: Record<PaymentStatus, string> = {
                            PAID: "text-emerald-700", PENDING: "text-amber-700", EXPIRED: "text-red-700",
                          }
                          const statusLabels: Record<PaymentStatus, string> = {
                            PAID: "Pagado", PENDING: "Pendiente", EXPIRED: "Vencido",
                          }
                          const methodLabels: Record<PaymentMethod, string> = {
                            CASH: "Efectivo", TRANSFER: "Transferencia", CARD: "Tarjeta",
                          }
                          return (
                            <div
                              key={p.id}
                              className={`flex items-center justify-between gap-3 px-3 py-2.5 bg-[#FAFAF9] text-sm ${i > 0 ? "border-t border-[#F0EFEB]" : ""}`}
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-[#111110] capitalize">{periodLabel}</p>
                                <p className="text-xs text-[#A5A49D]">
                                  {p.paymentMethod ? methodLabels[p.paymentMethod] : "—"}
                                  {p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString("es-AR")}` : ""}
                                  {p.verified ? " · ✓" : ""}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-mono font-semibold text-[#111110]">${Number(p.amount).toLocaleString("es-AR")}</p>
                                <p className={`text-xs font-medium ${statusColors[p.status]}`}>{statusLabels[p.status]}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── Archivos ─────────────────────────────────────────── */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A5A49D] mb-3">Archivos</h3>
                    {filesError && <p className="text-sm text-red-600 mb-2">{filesError}</p>}
                    {filesLoading ? (
                      <div className="space-y-2">
                        <div className="h-4 w-32 animate-pulse rounded bg-[#F0EFEB]" />
                        <div className="h-4 w-24 animate-pulse rounded bg-[#F0EFEB]" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(["FICHA", "APTO_MEDICO"] as StudentFileType[]).map((type) => {
                          const typeFiles = files.filter((f) => f.fileType === type)
                          const label = type === "FICHA" ? "Ficha de alumno" : "Apto médico"
                          const inputId = `upload-${type}-${selectedDetail.id}`
                          return (
                            <div key={type} className="rounded-lg border border-[#E5E4E0] bg-[#FAFAF9] p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#68685F]">{label}</span>
                                <label htmlFor={inputId} className={`cursor-pointer inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded border border-[#E5E4E0] bg-white text-[#111110] hover:bg-[#F0EFEB] transition-colors ${uploadingType === type ? "opacity-50 pointer-events-none" : ""}`}>
                                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 7.4 8.1 13.8a3.5 3.5 0 0 1-5-5L9.6 2.4a2.33 2.33 0 0 1 3.3 3.3l-6.4 6.4a1.17 1.17 0 0 1-1.7-1.6l6-6.1"/></svg>
                                  {uploadingType === type ? "Subiendo…" : "Subir"}
                                </label>
                                <input
                                  id={inputId}
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    if (f) { handleUploadFile(type, f); e.target.value = "" }
                                  }}
                                />
                              </div>
                              {typeFiles.length === 0 ? (
                                <p className="text-xs text-[#A5A49D]">Sin archivos cargados.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {typeFiles.map((f) => (
                                    <div key={f.id} className="flex items-center justify-between gap-2 bg-white rounded border border-[#E5E4E0] px-2.5 py-1.5">
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-[#111110] truncate">{f.fileName}</p>
                                        <p className="text-[10px] text-[#A5A49D]">{(f.sizeBytes / 1024).toFixed(0)} KB · {fmtDate(f.uploadedAt)}</p>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <a
                                          href={`/api/students/${selectedDetail.id}/files/${f.id}/download?gymId=${gymId}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="Ver archivo"
                                          className="inline-flex items-center gap-1 text-xs text-[#68685F] hover:text-[#111110] transition-colors"
                                        >
                                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z"/>
                                            <circle cx="8" cy="8" r="2"/>
                                          </svg>
                                          Ver
                                        </a>
                                        <button
                                          onClick={() => setConfirmFileId(f.id)}
                                          disabled={deletingFileId === f.id}
                                          className="cursor-pointer text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                                        >
                                          {deletingFileId === f.id ? "…" : "Eliminar"}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <FormModal
        open={showEditModal}
        title="Editar alumno"
        error={editError}
        onSubmit={handleSaveEdit}
        submitting={editSubmitting}
        onCancel={() => { setShowEditModal(false); setEditError(null) }}
        gridCols="sm:grid-cols-2"
      >
        <FormField label="Nombre" required>
          <Input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="Ej: María" />
        </FormField>
        <FormField label="Apellido" required>
          <Input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Ej: García" />
        </FormField>
        <FormField label="Día de cobro" required>
          <NumberInput integer value={editForm.dueDay} onChange={(e) => setEditForm((f) => ({ ...f, dueDay: e.target.value }))} placeholder="Ej: 10" />
        </FormField>
        <FormField label="Teléfono principal (WhatsApp)" required>
          <Input value={editForm.phone1} onChange={(e) => setEditForm((f) => ({ ...f, phone1: e.target.value }))} placeholder="Ej: 11 1234-5678" />
        </FormField>
        <FormField label="Teléfono secundario">
          <Input value={editForm.phone2} onChange={(e) => setEditForm((f) => ({ ...f, phone2: e.target.value }))} placeholder="Ej: 11 8765-4321" />
        </FormField>
      </FormModal>

      <ConfirmDialog
        open={confirmId !== null}
        title="Dar de baja al alumno"
        message="Se marcará como inactivo y dejará de aparecer en la lista activa. Podés verlo activando 'Todos'."
        confirmLabel="Dar de baja"
        onConfirm={() => { const id = confirmId!; setConfirmId(null); handleDeactivate(id) }}
        onCancel={() => setConfirmId(null)}
      />

      <ConfirmDialog
        open={confirmFileId !== null}
        title="Eliminar archivo"
        message="El archivo se eliminará de forma permanente y no se podrá recuperar."
        confirmLabel="Eliminar"
        onConfirm={() => { const id = confirmFileId!; setConfirmFileId(null); handleDeleteFile(id) }}
        onCancel={() => setConfirmFileId(null)}
      />
    </div>
  )
}
