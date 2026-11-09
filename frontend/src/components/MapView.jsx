import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { isPermanentlyClosed, isTemporarilyClosed } from '../lib/openingHours'

// MapLibre 6 looks for its web worker next to its own module file
// (import.meta.url), which no longer holds once Vite bundles (or pre-bundles,
// in dev) maplibre-gl into our code — the map then fails with "Worker failed
// to load". Pointing it at the worker file Vite emits as an asset fixes both.
maplibregl.setWorkerUrl(maplibreWorkerUrl)

/** @type {[number, number]} */
const MADRID_CENTER = [-3.7, 40.4]
const INITIAL_ZOOM = 10

// The map can't be panned or zoomed out past this box (MapLibre's maxBounds
// keeps the whole viewport inside it). It's deliberately much bigger than
// Spain, because a box hugging Spain stops zooming out as soon as the
// screen's width (or, on a phone, height) fills it, cutting the rest off: the
// Canarias end up out of view. Longitudes as in ~/twiner's basemap extract;
// the extra latitude is for phones, whose zoom-out is limited by the box's
// height: with it, zoomed all the way out, the peninsula, Baleares, Canarias,
// Ceuta and Melilla fit on screen with room to spare (~1.6x Spain's width in
// portrait on a phone, ~2.7x on desktop).
/** @type {[[number, number], [number, number]]} */
const MAP_BOUNDS = [
  [-36.65, 5],
  [27.07, 58],
]

const BUS_PATH =
  'M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z'

// Hospital building: L-shaped outline (tall main section + shorter wing), cross, door
function hospitalSvg(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 22V4h11v6h7v12H3"/>
    <path d="M6.5 9h4M8.5 7v4"/>
    <path d="M7 22v-4h3v4"/>
  </svg>`
}

function busSvg(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="${color}">
    <path d="${BUS_PATH}"/>
  </svg>`
}

const MARKER_SHADOW = '0 1px 4px rgba(0,0,0,.25)'
const HOVER_SHADOW = `0 0 0 4px rgba(220,38,38,.3), ${MARKER_SHADOW}`

function makeMarkerEl(isFixed, isSelected) {
  const el = document.createElement('div')
  const border = isSelected ? '#dc2626' : '#111827'
  const bg = isSelected ? '#dc2626' : '#ffffff'
  const color = isSelected ? '#ffffff' : '#111827'
  el.style.cssText = `
    width:36px;height:36px;border-radius:50%;
    border:2px solid ${border};background:${bg};
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;box-shadow:${MARKER_SHADOW};
    transition:border-color .15s,background .15s,box-shadow .15s;
  `
  el.innerHTML = isFixed ? hospitalSvg(color) : busSvg(color)
  return el
}

// maplibregl.Marker manages `element.style.opacity` itself — its _updateOpacity()
// resets it on every position update (pan, zoom, addTo, setLngLat), silently
// overwriting any opacity we set directly on the element. Driving opacity through
// marker.setOpacity() instead updates the Marker's own internal state, so the
// value survives future position updates. `filter` isn't touched by maplibre, so
// that's still safe to set directly on the element.
//
// isHovered: the point's card is under the mouse in the list — red outline
// and a soft red ring, raised above neighbouring markers. Just restyled in
// place: the map never moves for it, so a hovered point outside the current
// view simply isn't shown. (No scale-up: maplibre owns the element's
// `transform` for positioning.)
function applyMarkerStyle(
  marker,
  isFixed,
  isSelected,
  isClosed,
  isClosedTemporarily,
  isHovered = false
) {
  const el = marker.getElement()
  const highlighted = isSelected || isHovered
  const border = highlighted ? '#dc2626' : isClosedTemporarily ? '#d97706' : '#111827'
  const bg = isSelected ? '#dc2626' : '#ffffff'
  const color = isSelected
    ? '#ffffff'
    : isHovered
      ? '#dc2626'
      : isClosedTemporarily
        ? '#d97706'
        : '#111827'
  el.style.borderColor = border
  el.style.background = bg
  el.style.boxShadow = isHovered ? HOVER_SHADOW : MARKER_SHADOW
  el.style.zIndex = highlighted ? '1' : ''
  el.style.filter = isClosed && !highlighted ? 'grayscale(1)' : 'none'
  const opacity = highlighted ? '1' : isClosed ? '0.45' : isClosedTemporarily ? '0.7' : '1'
  marker.setOpacity(opacity)
  const svg = el.querySelector('svg')
  if (isFixed) {
    svg.setAttribute('stroke', color)
  } else {
    svg.setAttribute('fill', color)
  }
}

// Identifies the same spot across data sets — e.g. a mobile point that's out
// on both of two dates comes back as a different object from each day's fetch
// — so its marker can be kept instead of removed and re-added (which blinks).
// Spots repeated within one set (two sessions at the same place) are told
// apart by their order.
function spotKeys(features) {
  const counts = new Map()
  return features.map(feature => {
    const [lng, lat] = feature.geometry.coordinates
    const base = `${lng},${lat},${feature.properties?.name ?? ''}`
    const n = counts.get(base) ?? 0
    counts.set(base, n + 1)
    return `${base}#${n}`
  })
}

// Brings a marker set in line with `features`: markers for spots still there
// are kept (just pointed at the new feature object and restyled), the rest
// removed, and new ones added. Returns the new entries.
function syncMarkers(entries, features, isFixed, map, onSelect, selectedPoint, hoveredPoint) {
  const previous = new Map(entries.map(entry => [entry.key, entry]))
  const keys = spotKeys(features)
  const next = features.map((feature, i) => {
    const key = keys[i]
    const isClosed = isPermanentlyClosed(feature.properties?.opening_hours)
    const isClosedTemporarily = isTemporarilyClosed(feature.properties?.opening_hours)
    let entry = previous.get(key)
    if (entry) {
      previous.delete(key)
      Object.assign(entry, { feature, isClosed, isClosedTemporarily })
    } else {
      const el = makeMarkerEl(isFixed, false)
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(feature.geometry.coordinates)
        .addTo(map)
      const created = { key, marker, feature, el, isFixed, isClosed, isClosedTemporarily }
      // Reads the entry at click time, since a kept marker's feature changes.
      el.addEventListener('click', e => {
        e.stopPropagation()
        onSelect(created.feature)
      })
      entry = created
    }
    // Respect the current selection/hover when syncing — e.g. after a data
    // refetch — so it never silently drops the selected marker's style.
    applyMarkerStyle(
      entry.marker,
      isFixed,
      feature === selectedPoint,
      isClosed,
      isClosedTemporarily,
      feature === hoveredPoint
    )
    return entry
  })
  previous.forEach(({ marker }) => marker.remove())
  return next
}

const MapView = forwardRef(function MapView(
  /** @type {Record<string, any>} */ {
    fixedPoints,
    mobilePoints,
    selectedPoint,
    hoveredPoint,
    onSelectPoint,
    onUserLocation,
    onCenterChange,
  },
  ref
) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const fixedRef = useRef([])
  const mobileRef = useRef([])

  // Exposed so App can zoom/pan the map to a set of coordinates from outside —
  // e.g. fitting the viewport to the points left over after a donation-type
  // filter, which can otherwise sit outside the current view unnoticed.
  useImperativeHandle(ref, () => ({
    fitToCoords(coords, options = {}) {
      const map = mapRef.current
      if (!map || coords.length === 0) return
      if (coords.length === 1) {
        map.flyTo({ center: coords[0], zoom: options.maxZoom ?? 14, duration: 600 })
        return
      }
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      )
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 600, ...options })
    },
  }))

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      // OpenFreeMap (https://openfreemap.org): free, no API key, no usage limits.
      style: 'https://tiles.openfreemap.org/styles/bright',
      center: MADRID_CENTER,
      zoom: INITIAL_ZOOM,
      maxBounds: MAP_BOUNDS,
    })
    // Zoom +/- (and the compass) are skipped on mobile: pinch-to-zoom already
    // covers it there, and the buttons only add to an already-tight top-right
    // corner shared with the date tabs. Geolocate stays — it's the only way to
    // trigger it, there's no touch-gesture equivalent.
    if (window.innerWidth >= 768) {
      map.addControl(new maplibregl.NavigationControl(), 'top-right')
    }
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true,
      fitBoundsOptions: { maxZoom: 12 },
    })
    map.addControl(geolocate, 'top-right')

    geolocate.on('geolocate', e => {
      onUserLocation?.({ lat: e.coords.latitude, lng: e.coords.longitude })
    })

    map.on('load', async () => {
      // Locate the user on open: centers the map on them if permission was
      // already granted, or asks for it on a first visit. Skipped only when
      // they've already denied it (re-asking can't show a prompt then — the
      // geolocate button stays for that). Browsers without the Permissions
      // API, or without 'geolocation' in it, just get the request.
      let state = 'prompt'
      try {
        state = (await navigator.permissions?.query({ name: 'geolocation' }))?.state ?? state
      } catch {}
      if (state !== 'denied') geolocate.trigger()
    })

    map.on('click', () => onSelectPoint(null))
    map.on('moveend', () => {
      const { lat, lng } = map.getCenter()
      onCenterChange?.({ lat, lng })
    })
    mapRef.current = map
    onCenterChange?.({ lat: MADRID_CENTER[1], lng: MADRID_CENTER[0] })
    return () => map.remove()
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    fixedRef.current = syncMarkers(
      fixedRef.current,
      fixedPoints,
      true,
      mapRef.current,
      onSelectPoint,
      selectedPoint,
      hoveredPoint
    )
  }, [fixedPoints])

  useEffect(() => {
    if (!mapRef.current) return
    mobileRef.current = syncMarkers(
      mobileRef.current,
      mobilePoints,
      false,
      mapRef.current,
      onSelectPoint,
      selectedPoint,
      hoveredPoint
    )
  }, [mobilePoints])

  // Update marker styles when the selection or the hovered list card changes,
  // without recreating markers.
  useEffect(() => {
    const all = [...fixedRef.current, ...mobileRef.current]
    all.forEach(({ feature, marker, isFixed, isClosed, isClosedTemporarily }) => {
      applyMarkerStyle(
        marker,
        isFixed,
        feature === selectedPoint,
        isClosed,
        isClosedTemporarily,
        feature === hoveredPoint
      )
    })
  }, [selectedPoint, hoveredPoint])

  // Selecting a point (not hovering one) centers the map on it.
  useEffect(() => {
    if (!selectedPoint || !mapRef.current) return
    const [lng, lat] = selectedPoint.geometry.coordinates
    mapRef.current.flyTo({ center: [lng, lat], zoom: 14, offset: [0, 80], duration: 500 })
  }, [selectedPoint])

  return <div ref={containerRef} className="w-full h-full" />
})

export default MapView
