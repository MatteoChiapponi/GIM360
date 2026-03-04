import { auth, signOut } from "@/lib/auth"

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Dashboard</h1>

        <div className="mb-6 flex flex-col gap-1 text-sm text-gray-600">
          <p><span className="font-medium">Email:</span> {session?.user?.email}</p>
          <p><span className="font-medium">ID:</span> {session?.user?.id}</p>
          <p><span className="font-medium">Rol:</span> {session?.user?.role ?? "—"}</p>
        </div>

        <form
          action={async () => {
            "use server"
            await signOut({ redirectTo: "/login" })
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )
}
