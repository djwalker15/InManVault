import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tracks ids for a short TTL after they're added — used to flash a transient
 * "just created" treatment on new rows/cards. Multiple ids can be live at
 * once (bulk adds); each expires independently.
 */
export function useRecentIds(ttlMs = 1600) {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const t of pending) clearTimeout(t)
    }
  }, [])

  const add = useCallback(
    (id: string) => {
      setIds((prev) => new Set(prev).add(id))
      const t = setTimeout(() => {
        timers.current.delete(t)
        setIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, ttlMs)
      timers.current.add(t)
    },
    [ttlMs],
  )

  return { ids, add }
}
