---
name: frontend-view
description: Create a new GYM360 frontend view ("*View.tsx") using the shared UI component library. Use this when adding a new protected page that lists, creates, edits or deletes a domain entity.
argument-hint: <domain> (e.g. payments, expenses, groups)
allowed-tools: Read, Write, Glob, Bash
---

# Create frontend view for: $ARGUMENTS

## PRINCIPIO FUNDAMENTAL — UX para usuarios no técnicos

> **CRÍTICO.** El usuario final de GYM360 es el dueño o recepcionista de un gimnasio, no un desarrollador. La interfaz debe ser tan clara que alguien que la usa por primera vez no necesite explicación. Nunca dejes ambigüedades.

### Reglas de usabilidad obligatorias

**Idioma — todo en español**
- Todo texto visible al usuario debe estar en español: labels, botones, placeholders, mensajes de error, tooltips y confirmaciones.
- El `<html>` root debe tener `lang="es"` (`app/layout.tsx`) para que el navegador renderice los widgets nativos (`<input type="date">`, `<input type="time">`, `<input type="number">`, `<input type="month">`) en español. Sin esto, los tooltips de los spinners y los calendarios del navegador aparecen en inglés ("Increment", "Decrement", nombres de meses en inglés).
- Nunca usar "Submit", "OK", "Confirm", "Cancel" ni ninguna palabra en inglés en la UI.

**Textos y etiquetas**
- Toda acción debe tener un label en español claro y en modo imperativo: "Guardar", "Dar de baja", "Inscribir alumno" — nunca íconos solos sin texto.
- Los placeholders de inputs deben mostrar un ejemplo real: `placeholder="Ej: 10"`, `placeholder="Ej: Carlos López"`. Nunca dejar el placeholder vacío.
- Los campos requeridos deben marcarse con ` *` en el label y mostrar el error exacto si se intenta guardar vacío: "El nombre es obligatorio.", no "Required field".
- Los mensajes de estado vacío (`emptyMessage`) deben explicar el contexto: "No hay alumnos activos." no "Sin datos.". Agregar `emptyHint` con la acción a tomar: "Creá el primer alumno con el botón de arriba."

**Feedback de acciones**
- Mientras se envía un formulario, el botón primary debe cambiar su texto: `{submitting ? "Guardando…" : "Guardar"}`. Nunca deshabilitar sin indicar qué está pasando.
- Mientras se ejecuta un delete/deactivate, reemplazar el texto del botón por `"…"` y `disabled={true}`.
- Los errores del servidor deben mostrarse en texto legible, no como JSON ni stack trace. Siempre incluir fallback: `data?.error ?? "Error al guardar. Intentá de nuevo."`.
- Después de una acción exitosa (create/edit/delete), hacer `refetch()` inmediatamente para que la tabla refleje el cambio sin recargar la página.

**Formularios**
- Usar `FormModal` — el formulario de creación se abre en un modal centrado con backdrop, no inline. Esto evita confundir al usuario con formularios que aparecen entre el contenido.
- El botón "Cancelar" siempre limpia el formulario y el error: `setForm(EMPTY_FORM); setFormError(null); setShowForm(false)`.
- Validar en el cliente antes de hacer fetch. Si falta un campo requerido, mostrar el error sin llamar al servidor.
- En inline editing, el formulario reemplaza la fila en la tabla para que el usuario vea exactamente qué está editando.

**Inputs numéricos**
- Los `<input type="number">` NO deben mostrar flechas de incremento/decremento (spinners). Esto ya está resuelto globalmente en `globals.css`. No agregar estilos extra para esto.

**Acciones destructivas**
- "Dar de baja", "Desactivar", "Eliminar", "Desinscribir", "Remover" usan `variant="danger"` (rojo).
- Toda acción destructiva debe pedir confirmación con el componente `<ConfirmDialog>` (nunca `window.confirm()` ni `alert()` — el diálogo del navegador queda muy mal). Patrón:
  ```tsx
  import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
  const [confirmId, setConfirmId] = useState<string | null>(null)
  // Botón:
  <Button variant="danger" onClick={() => setConfirmId(item.id)}>Eliminar</Button>
  // Al final del return:
  <ConfirmDialog
    open={confirmId !== null}
    title="Eliminar elemento"
    message="¿Estás seguro? Esta acción no se puede deshacer."
    confirmLabel="Eliminar"
    onConfirm={() => { const id = confirmId!; setConfirmId(null); handleDelete(id) }}
    onCancel={() => setConfirmId(null)}
  />
  ```
- Para acciones reversibles (soft-delete, desinscribir) el mensaje debe aclararlo: "Podrás volver a inscribirlo cuando quieras."
- Nunca mostrar un botón destructivo sin que el usuario entienda qué va a pasar.

**Estados de la tabla**
- Estado loading: mostrar "Cargando…" centrado en la tabla, nunca dejar la pantalla en blanco.
- Estado error: mostrar el mensaje en rojo, no ocultar el componente.
- Estado vacío sin búsqueda: mensaje explicativo + hint de cómo crear el primer registro.
- Estado vacío con búsqueda activa: "Sin resultados para esa búsqueda." — nunca mezclar con el estado vacío real.

**Responsive**
- Usar `sm:grid-cols-N` en formularios para que en mobile los campos sean de 1 columna.
- La tabla tiene scroll horizontal (`overflow-x-auto` + `minWidth`), nunca truncar datos.
- El botón principal de acción (`PageHeader action`) en mobile debe estar debajo del título (`self-start`).

---

## Step 1 — Read context

- `app/api/$ARGUMENTS/route.ts` — GET/POST endpoints available and query params required
- `app/api/$ARGUMENTS/[id]/route.ts` — PATCH/DELETE endpoints (if exist)
- `modules/$ARGUMENTS/$ARGUMENTS.service.ts` — returned shape of each entity
- One existing view for reference pattern (e.g. `app/(dashboard)/[gymId]/expenses/ExpensesView.tsx`)

Identify:
- What fields does the entity have?
- Does it support inline editing (PATCH) or just create+delete?
- Does it need filter tabs (active/all)?
- Does it need stat cards?

## Step 2 — Available shared components

All imports from `@/components/ui/*` and `@/hooks/useFetch`.

### Primitives
```tsx
import { Button }     from "@/components/ui/Button"      // variant: "primary"|"secondary"|"danger"|"link"
import { Input }      from "@/components/ui/Input"        // forwardRef wrapper, full InputHTMLAttributes
import { Select }     from "@/components/ui/Select"       // forwardRef wrapper, full SelectHTMLAttributes
import { Label }      from "@/components/ui/Label"        // tiny uppercase label
import { StatusDot }  from "@/components/ui/StatusDot"   // colored dot + text, props: dotColor, textColor, label
```

### Composites
```tsx
import { FormField }      from "@/components/ui/FormField"      // Label + children slot; props: label, required?
import { StatCard }       from "@/components/ui/StatCard"        // KPI card; props: label, value, valueColor?
import { Tabs }           from "@/components/ui/Tabs"            // pill tabs; props: tabs, active, onChange
import { PageHeader }     from "@/components/ui/PageHeader"      // h1 + subtitle + action slot
import { SearchToolbar }  from "@/components/ui/SearchToolbar"   // search input + sort select + dir toggle
import { DataTable }      from "@/components/ui/DataTable"       // generic table with loading/error/empty states
import { FormModal }      from "@/components/ui/FormModal"        // modal form with backdrop for create actions; props: open, title, error, onSubmit, submitting, onCancel, gridCols?, children
```

### Hook
```tsx
import { useFetch } from "@/hooks/useFetch"
// Returns: { data, loading, error, refetch }
// PaymentsView and MetricsView use manual useCallback+useEffect due to special auto-generate logic
```

## Step 3 — View skeleton

Create `app/(dashboard)/[gymId]/$ARGUMENTS/${Domain}View.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useFetch } from "@/hooks/useFetch"
import { Button }        from "@/components/ui/Button"
import { Input }         from "@/components/ui/Input"
import { FormField }     from "@/components/ui/FormField"
import { StatCard }      from "@/components/ui/StatCard"
import { PageHeader }    from "@/components/ui/PageHeader"
import { SearchToolbar } from "@/components/ui/SearchToolbar"
import { DataTable }     from "@/components/ui/DataTable"
import { FormModal }     from "@/components/ui/FormModal"

type ${Domain} = { id: string; /* ...fields */ }
type NewForm   = { /* ...fields */ }
const EMPTY_FORM: NewForm = { /* ... */ }

export default function ${Domain}View({ gymId }: { gymId: string }) {
  const { data: items, loading, error, refetch } = useFetch<${Domain}[]>(
    `/api/$ARGUMENTS?gymId=${gymId}`, [], "No se pudieron cargar los $ARGUMENTS.",
  )
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState<NewForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [search, setSearch]       = useState("")
  const [sortKey, setSortKey]     = useState("name")
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("asc")

  const displayed = items
    .filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
    .sort(/* ... */)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    // validate...
    setSubmitting(true)
    const res = await fetch("/api/$ARGUMENTS", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gymId, ...form }),
    })
    if (res.ok) { setForm(EMPTY_FORM); setShowForm(false); await refetch() }
    else { const d = await res.json().catch(() => ({})); setFormError(d?.error ?? "Error al crear.") }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="${Domain}s"
        subtitle="..."
        action={<Button onClick={() => { setShowForm(true); setFormError(null) }}>+ Nuevo</Button>}
      />

      {/* Optional stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total" value={items.length} />
      </div>

      {/* Optional filter tabs */}
      {/* <Tabs tabs={[...]} active={filter} onChange={setFilter} /> */}

      <SearchToolbar
        search={search} onSearchChange={setSearch} placeholder="Buscar…"
        sortOptions={[{ value: "name", label: "Ordenar por nombre" }]}
        sortKey={sortKey} onSortKeyChange={setSortKey}
        sortDir={sortDir} onSortDirToggle={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
      />

      <FormModal
        open={showForm}
        title="Nuevo"
        error={formError}
        onSubmit={handleCreate}
        submitting={submitting}
        onCancel={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(null) }}
      >
        <FormField label="Nombre" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: …" />
        </FormField>
        {/* more fields */}
      </FormModal>

      <DataTable
        columns={[
          { key: "name", header: "Nombre", render: (item) => <span className="font-medium text-[#111110]">{item.name}</span> },
          { key: "actions", header: "", align: "right", render: (item) => (
            <Button variant="link" onClick={() => {}}>Editar</Button>
          )},
        ]}
        data={displayed}
        loading={loading}
        error={error}
        emptyMessage={search ? "Sin resultados." : "No hay registros."}
        emptyHint={!search ? "Creá el primero con el botón de arriba." : undefined}
        minWidth="400px"
        rowKey={(item) => item.id}
        {/* renderRow prop for inline editing — see Step 4 */}
      />
    </div>
  )
}
```

## Step 4 — Inline editing pattern (when PATCH exists)

Add state: `editingId`, `editForm`, `editSubmitting`, `editError`.

Pass `renderRow` to `<DataTable>` as an escape hatch:

```tsx
renderRow={(item, i, defaultRow) => {
  if (editingId !== item.id) return defaultRow
  return (
    <tr key={item.id} className={`hover:bg-[#FAFAF9] transition-colors ${i > 0 ? "border-t border-[#F7F6F3]" : ""}`}>
      <td className="px-5 py-3" colSpan={TOTAL_COLUMNS}>
        <div className="space-y-3">
          {editError && <p className="text-sm text-red-600">{editError}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label>Campo *</Label>
              <Input value={editForm.field} onChange={(e) => setEditForm((f) => ({ ...f, field: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => handleSaveEdit(item.id)} disabled={editSubmitting}>
              {editSubmitting ? "Guardando…" : "Guardar"}
            </Button>
            <Button variant="secondary" onClick={() => { setEditingId(null); setEditError(null) }}>Cancelar</Button>
          </div>
        </div>
      </td>
    </tr>
  )
}}
```

## Step 5 — Create the page file

Create `app/(dashboard)/[gymId]/$ARGUMENTS/page.tsx`:

```tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import ${Domain}View from "./${Domain}View"

export default async function ${Domain}Page({ params }: { params: Promise<{ gymId: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const { gymId } = await params
  return <${Domain}View gymId={gymId} />
}
```

Also add the route to the sidebar navigation in `components/layout/NavLinks.tsx` if needed.

## Step 6 — Verify

```bash
npx tsc --noEmit
```

Fix any type errors. Report:
- File created: `app/(dashboard)/[gymId]/$ARGUMENTS/${Domain}View.tsx`
- File created: `app/(dashboard)/[gymId]/$ARGUMENTS/page.tsx`
- Whether inline editing was included
- Whether stat cards / filter tabs were included
