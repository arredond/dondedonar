import { useState, useEffect, useRef } from 'react'
import dayjs from 'dayjs'
import { fetchFixedPoints, fetchMobilePoints } from '../lib/supabase'
import { isPermanentlyClosed } from '../lib/openingHours'

// Permanently closed spots (opening_hours "closed", hand-set in
// etl/utils/opening_hours_fijos.json — so far only some in Madrid) stay in the
// DB but are hidden from the app: they're just visual noise on the map and in
// the list. Drop this filter to bring them back; the map, list and popup still
// know how to render them ("Cerrado permanentemente", greyed-out marker).
const isShown = feature => !isPermanentlyClosed(feature.properties?.opening_hours)

export function useBloodPoints(selectedDate) {
  const [fixedPoints, setFixedPoints] = useState([])
  // The mobile points fetched most recently, tagged with the date they're for.
  const [mobile, setMobile] = useState({ date: null, features: [] })
  // Per-date cache, so going back to a tab already seen this session doesn't
  // refetch (or rebuild every marker with fresh-but-identical objects).
  const mobileCache = useRef(new Map())

  useEffect(() => {
    fetchFixedPoints().then(geojson => {
      const features = geojson?.features ?? []
      // Deduplicate by name — the DB can have duplicate rows from past ETL runs
      const seen = new Set()
      setFixedPoints(
        features.filter(isShown).filter(f => {
          const key = f.properties?.name
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      )
    })
  }, [])

  // Keyed on the calendar date, not the tab: "Abierto ahora" (selectedDate
  // null) and "Hoy" are the same day's points, so switching between them
  // reuses them as-is.
  const date = (selectedDate ?? dayjs()).format('DD/MM/YYYY')

  useEffect(() => {
    const cached = mobileCache.current.get(date)
    if (cached) {
      setMobile({ date, features: cached })
      return
    }
    // Ignore a response that lands after the user has already moved on to
    // another date, so a slow fetch can't overwrite a newer one.
    let cancelled = false
    fetchMobilePoints(date)
      .then(geojson => (geojson?.features ?? []).filter(isShown))
      .catch(error => {
        console.error(`Failed to load mobile points for ${date}`, error)
        return null
      })
      .then(features => {
        if (cancelled) return
        if (features) mobileCache.current.set(date, features)
        setMobile({ date, features: features ?? [] })
      })
    return () => {
      cancelled = true
    }
  }, [date])

  // Only hand out points that belong to the date being shown. Showing the
  // previous date's while the new ones load made them flash: e.g. from
  // "Abierto ahora" to another day, all of today's mobile points — including
  // the closed ones the open-now filter had been hiding — appeared at once,
  // then vanished when that day's points arrived. (App keeps what's already on
  // screen up meanwhile, already filtered — see shownMobilePoints there.)
  const loadingMobile = mobile.date !== date
  const mobilePoints = loadingMobile ? NO_POINTS : mobile.features

  return { fixedPoints, mobilePoints, loadingMobile }
}

// Stable empty array, so MapView's marker effect (keyed on the array) doesn't
// rerun on every render while loading.
const NO_POINTS = []
