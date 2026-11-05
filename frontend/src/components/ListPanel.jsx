import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import PointCard from './PointCard'
import { getPointInfo } from '../lib/pointHelpers'
import { haversine } from '../lib/geo'

// Accent-insensitive, case-insensitive match against name/address/locality.
function normalize(str) {
  return (str ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function matchesQuery(point, query) {
  if (!query) return true
  const { name, address, locality } = getPointInfo(point)
  const haystack = normalize([name, address, locality].filter(Boolean).join(' '))
  return haystack.includes(normalize(query))
}

function LocationTooltip() {
  const [open, setOpen] = useState(false)
  return (
    <button
      onClick={() => setOpen(v => !v)}
      className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 transition-colors"
      aria-label="Información sobre distancias"
    >
      <span className="relative shrink-0 leading-none">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
        {open && (
          <div className="absolute left-0 top-6 z-30 w-56 bg-gray-900 text-white text-xs font-normal normal-case rounded-xl p-3 shadow-xl leading-relaxed text-left">
            Las distancias se calculan desde el centro del mapa. Para medidas más precisas, comparte
            tu ubicación cuando el navegador te lo solicite.
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45" />
          </div>
        )}
      </span>
      Distancia aproximada
    </button>
  )
}

export default function ListPanel({
  fixedPoints,
  mobilePoints,
  selectedPoint,
  onSelectPoint,
  onHoverPoint,
  onClose,
  refPoint,
  locationGranted,
}) {
  const [query, setQuery] = useState('')
  const scrollRef = useRef(null)
  const selectedRef = useRef(null)

  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      selectedRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [selectedPoint])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [query])

  // useLayoutEffect runs before paint, avoiding scroll-anchoring interference.
  // String key ensures reliable primitive comparison when refPoint object changes.
  const refPointKey = refPoint ? `${refPoint.lat.toFixed(4)},${refPoint.lng.toFixed(4)}` : null
  useLayoutEffect(() => {
    if (!locationGranted && selectedPoint && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [refPointKey])

  const all = [...mobilePoints, ...fixedPoints].filter(point => matchesQuery(point, query))

  const withDistance = all.map(point => {
    const [lng, lat] = point.geometry.coordinates
    const dist = refPoint ? haversine(refPoint.lat, refPoint.lng, lat, lng) : null
    return { point, dist }
  })

  if (refPoint) {
    withDistance.sort((a, b) => a.dist - b.dist)
  }

  return (
    <div className="fixed inset-0 z-40 md:relative md:inset-auto md:z-auto md:w-[var(--list-width,420px)] md:flex-1 md:min-h-0 flex flex-col bg-white overflow-hidden md:rounded-2xl md:shadow-xl">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            {withDistance.length} {withDistance.length === 1 ? 'punto' : 'puntos'}
          </span>
          {!locationGranted && <LocationTooltip />}
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Ocultar lista
        </button>
      </div>
      <div className="px-6 py-3 border-b border-gray-100">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre o dirección"
            className="w-full pl-9 pr-9 py-2 text-sm bg-gray-100 rounded-full outline-none focus:ring-2 focus:ring-gray-300 placeholder:text-gray-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Borrar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div ref={scrollRef} className="overflow-y-auto flex-1 pb-[env(safe-area-inset-bottom)]">
        {withDistance.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-12">
            {query ? 'No se han encontrado puntos.' : 'No hay puntos para esta fecha.'}
          </p>
        )}
        {withDistance.map(({ point, dist }, i) => (
          <PointCard
            key={point.properties.name + i}
            point={point}
            isSelected={point === selectedPoint}
            distanceKm={dist}
            onClick={() => onSelectPoint(point)}
            // Mouse only: a tap on a touch screen also fires enter (with no
            // leave), which would leave its marker stuck highlighted.
            onPointerEnter={e => e.pointerType === 'mouse' && onHoverPoint?.(point)}
            onPointerLeave={e => e.pointerType === 'mouse' && onHoverPoint?.(null)}
            itemRef={point === selectedPoint ? selectedRef : null}
          />
        ))}
      </div>
    </div>
  )
}
