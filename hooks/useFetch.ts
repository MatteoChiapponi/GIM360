import { useState, useEffect, useCallback } from "react"

export function useFetch<T>(
  url: string | null,
  initialData: T,
  errorMsg: string,
): {
  data: T
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
} {
  const [data, setData] = useState<T>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!url) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url)
      if (res.ok) {
        setData(await res.json())
      } else {
        setError(errorMsg)
      }
    } catch {
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [url, errorMsg])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
