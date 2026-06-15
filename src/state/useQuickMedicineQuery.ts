import { useEffect, useRef } from 'react'
import type { MedicineKind } from '../types'

type QuickMedicineQueryOptions = {
  hasHydrated: boolean
  logMedicine: (kind: MedicineKind) => void
}

export function useQuickMedicineQuery({ hasHydrated, logMedicine }: QuickMedicineQueryOptions) {
  const processedQuickMedicineRef = useRef(false)

  useEffect(() => {
    if (processedQuickMedicineRef.current) return
    if (!hasHydrated) return

    const params = new URLSearchParams(window.location.search)
    const quickMed = params.get('quickMed')
    if (quickMed !== 'tylenol' && quickMed !== 'motrin') return

    processedQuickMedicineRef.current = true
    logMedicine(quickMed)
    params.delete('quickMed')
    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)
  }, [hasHydrated, logMedicine])
}
