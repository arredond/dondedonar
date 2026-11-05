import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import Header from './components/Header'
import DateNav from './components/DateNav'
import MapView from './components/MapView'
import ListPanel from './components/ListPanel'
import Popup from './components/Popup'
import MedulaInfoCard from './components/MedulaInfoCard'
import { useBloodPoints } from './hooks/useBloodPoints'
import { useNowTick } from './hooks/useNowTick'
import { getOpenStatus } from './lib/openingHours'
import { regionAt, nearestCoveredRegion } from './lib/regions'
import { medulaInfo, takesMedula } from './lib/medula'

dayjs.locale('es')

export default function App() {
  // Defaults: the date tab depends on the local time (see defaultSelectedDate)
  // and "sangre" is the donation type (picked from the header title).
  const [selectedDate, setSelectedDate] = useState(defaultSelectedDate)
  const [selectedPoint, setSelectedPoint] = useState(null)
  // The list card under the mouse, highlighted on the map (see MapView).
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [showList, setShowList] = useState(false)
  // Single-select, not independent toggles: every point takes whole blood, but
  // plasma/médula are only taken at a handful of points, so showing "sangre OR
  // plasma OR médula" together read as noise in practice. One donation type is
  // active at a time, radio-style.
  const [donationType, setDonationType] = useState('sangre')
  const [userLocation, setUserLocation] = useState(null)
  const [mapCenter, setMapCenter] = useState({ lat: 40.4, lng: -3.7 })

  const { fixedPoints, mobilePoints, loadingMobile } = useBloodPoints(selectedDate)
  const now = useNowTick()

  // The list panel should match DateNav's own (content-driven) width — measured
  // rather than duplicated as a literal, since ListPanel's own content (long
  // addresses, buttons, ...) is wide enough that giving it a relative/auto width
  // instead would make IT dictate the shared column's width. See ListPanel.jsx.
  const dateNavRef = useRef(null)
  const mapViewRef = useRef(null)
  const [listWidth, setListWidth] = useState(null)
  useLayoutEffect(() => {
    const el = dateNavRef.current
    if (!el) return
    // getBoundingClientRect (border-box) rather than entry.contentRect (which
    // excludes DateNav's own padding, undershooting the width to match).
    const observer = new ResizeObserver(() => setListWidth(el.getBoundingClientRect().width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The "Abierto ahora" tab selects selectedDate = null (see DateNav) — when
  // active, only show points that are actually open right now.
  const showOnlyOpenNow = selectedDate === null
  const filterByOpenNow = features =>
    showOnlyOpenNow
      ? features.filter(
          f =>
            getOpenStatus(f.properties?.opening_hours, now, f.properties?.region)?.isOpen === true
        )
      : features

  // Every point takes "sangre" (whole blood) by default; plasma is only taken
  // where its flag is set, and médula wherever the point's region's rule says
  // (see takesMedula in lib/medula.js) — see getPointInfo in lib/pointHelpers.js.
  // "sangre" is the one type a point can explicitly opt *out* of rather than
  // into: Castilla-La Mancha's mobile points mark plasma-only stops with
  // sangre: false (every other point simply never sets the field, so the
  // default stays permissive there).
  const filterByDonationType = features => {
    if (donationType === 'sangre') return features.filter(f => f.properties?.sangre !== false)
    if (donationType === 'medula') return features.filter(takesMedula)
    return features.filter(f => Boolean(f.properties?.[donationType]))
  }

  // Bucketed to the minute, and only ticking at all while "Abierto ahora" is
  // active, so the memos below don't get invalidated by the clock when the
  // open-now filter isn't even in play.
  const openNowMinute = showOnlyOpenNow ? Math.floor(now.getTime() / 60_000) : null

  // Everything below the date filter but above the donation-type filter.
  const openNowFixedPoints = useMemo(
    () => filterByOpenNow(fixedPoints),
    [fixedPoints, showOnlyOpenNow, openNowMinute]
  )
  const openNowMobilePoints = useMemo(
    () => filterByOpenNow(mobilePoints),
    [mobilePoints, showOnlyOpenNow, openNowMinute]
  )

  // Memoized so MapView's marker-rebuild effects (keyed on these arrays) don't fire
  // on every render — e.g. after a flyTo's moveend updates mapCenter — which was
  // resetting the selected marker's red highlight before its own effect could reapply it.
  const visibleFixedPoints = useMemo(
    () => filterByDonationType(openNowFixedPoints),
    [openNowFixedPoints, donationType]
  )
  const visibleMobilePoints = useMemo(
    () => filterByDonationType(openNowMobilePoints),
    [openNowMobilePoints, donationType]
  )

  // While a newly picked date's mobile points load, keep showing the ones
  // already on screen (as filtered then) rather than none, and swap in the new
  // set only once it's there: emptying the map in between made every mobile
  // marker blink out and back, even spots open on both days (MapView keeps
  // those in place across the swap). Assigned during render on purpose: it's
  // idempotent, and an effect would show the stale value for a frame.
  const shownMobilePointsRef = useRef(visibleMobilePoints)
  if (!loadingMobile) shownMobilePointsRef.current = visibleMobilePoints
  const shownMobilePoints = shownMobilePointsRef.current

  // The region named in the header title (and driving which region's blood
  // levels are fetched) — whichever region's real boundary the map center
  // currently falls inside (see regionAt in lib/regions.js), falling back to
  // the nearest covered region's fixed point when it's outside both (e.g.
  // panned elsewhere in Spain), using every fixed point regardless of
  // filters so that fallback never goes stale just because a filter hides
  // them all.
  const currentRegion = useMemo(
    () => regionAt(mapCenter) ?? nearestCoveredRegion(fixedPoints, mapCenter),
    [fixedPoints, mapCenter]
  )

  // Selecting a region from the header's dropdown jumps the map there instead
  // of tracking a separately-held "selected region" — nearestRegion then picks
  // it back up on its own once the map settles (moveend), same as panning
  // there by hand would.
  // In regions where bone marrow sign-up starts with a phone call or a form,
  // the map rightly shows no points for it; MedulaInfoCard explains that, so
  // the "nothing open right now" overlay below would only contradict it.
  const medulaHasNoPoints = donationType === 'medula' && medulaInfo(currentRegion).where === 'none'

  const handleSelectRegion = region => {
    const coords = fixedPoints
      .filter(f => f.properties?.region === region)
      .map(f => f.geometry.coordinates)
    mapViewRef.current?.fitToCoords(coords)
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <Header
        hideOnMobile={showList}
        donationType={donationType}
        onSelectDonationType={setDonationType}
        region={currentRegion}
        onSelectRegion={handleSelectRegion}
      />
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 relative">
          <MapView
            ref={mapViewRef}
            fixedPoints={visibleFixedPoints}
            mobilePoints={shownMobilePoints}
            selectedPoint={selectedPoint}
            hoveredPoint={hoveredPoint}
            onSelectPoint={setSelectedPoint}
            onUserLocation={setUserLocation}
            onCenterChange={setMapCenter}
          />
          {selectedPoint && <Popup point={selectedPoint} onClose={() => setSelectedPoint(null)} />}
          {/* An empty "Abierto ahora" map (e.g. late at night) otherwise looks
              exactly like a broken one — say so, and offer today's full list.
              Only once both point sets have loaded, so it doesn't flash. */}
          {showOnlyOpenNow &&
            !medulaHasNoPoints &&
            fixedPoints.length > 0 &&
            !loadingMobile &&
            visibleFixedPoints.length + visibleMobilePoints.length === 0 && (
              <div className="absolute inset-0 z-10 flex items-center justify-center p-4 pointer-events-none">
                <div className="pointer-events-auto bg-white rounded-2xl shadow-md px-5 py-4 max-w-xs text-center">
                  <p className="text-sm font-semibold text-gray-900">
                    Ahora mismo no hay ningún punto abierto
                  </p>
                  <button
                    onClick={() => setSelectedDate(dayjs())}
                    className="mt-3 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                  >
                    Ver los puntos de hoy
                  </button>
                </div>
              </div>
            )}
        </div>

        {/* Floating controls: date tabs + list on the left, the médula info
            card on the right — all overlaid on top of the full-width map. */}
        <div className="absolute inset-4 z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-3 pointer-events-none">
          <div
            // max-w leaves clearance on mobile for the map's own geolocate button,
            // which sits in the same top-right corner (see MapView.jsx) — DateNav's
            // own overflow-x-auto lets its tabs scroll instead of running under it.
            // md:h-full only while the list is open (so it can fill the column via
            // its own flex-1) — applied unconditionally, this div's pointer-events:
            // auto box would stretch to the full map height even when collapsed to
            // just DateNav + the "Mostrar lista" button, silently blocking clicks
            // on the map underneath the empty space below them.
            className={`flex flex-col gap-3 pointer-events-auto min-w-0 max-w-[calc(100%-3.5rem)] md:max-w-none ${showList ? 'md:h-full' : ''}`}
            style={
              listWidth
                ? /** @type {import('react').CSSProperties} */ ({
                    '--list-width': `${listWidth}px`,
                  })
                : undefined
            }
          >
            <DateNav ref={dateNavRef} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            {showList ? (
              <ListPanel
                fixedPoints={visibleFixedPoints}
                mobilePoints={shownMobilePoints}
                selectedPoint={selectedPoint}
                onSelectPoint={setSelectedPoint}
                onHoverPoint={setHoveredPoint}
                onClose={() => {
                  setHoveredPoint(null)
                  setShowList(false)
                }}
                refPoint={userLocation ?? mapCenter}
                locationGranted={userLocation !== null}
              />
            ) : (
              <button
                onClick={() => setShowList(true)}
                className="self-start bg-white rounded-full px-4 py-2 shadow-md text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
                Mostrar lista
              </button>
            )}
          </div>
          {/* Mobile: pinned to the bottom edge, and hidden while a point's popup
              (a bottom sheet there) is open. Desktop: top right, opposite the
              date tabs. */}
          {donationType === 'medula' && (
            <div
              className={`${selectedPoint ? 'hidden md:block' : ''} pointer-events-auto fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-10 flex justify-center md:static md:inset-auto md:bottom-auto md:z-auto md:block`}
            >
              <MedulaInfoCard region={currentRegion} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Opening tab by local time: before 9:00 almost nothing is open yet but the
// user will likely go later that day ("Hoy"); from 21:00 everything is closed,
// so show tomorrow ("Mañana"); otherwise "Abierto ahora" (selectedDate = null).
function defaultSelectedDate() {
  const now = dayjs()
  if (now.hour() < 9) return now
  if (now.hour() >= 21) return now.add(1, 'day')
  return null
}
