import { getPointInfo } from '../lib/pointHelpers'
import { isPermanentlyClosed, isTemporarilyClosed } from '../lib/openingHours'
import OpenStatusBadge from './OpenStatusBadge'

export default function PointCard({
  point,
  isSelected,
  onClick,
  onPointerEnter,
  onPointerLeave,
  distanceKm,
  itemRef,
}) {
  const { isMobile, name, address, locality, hours, openingHours, region, mapsUrl } =
    getPointInfo(point)
  const closedPermanently = isPermanentlyClosed(openingHours)
  const closedTemporarily = isTemporarilyClosed(openingHours)

  return (
    <div
      ref={itemRef}
      className={`px-6 py-4 cursor-pointer transition-colors ${isSelected ? 'bg-red-50' : 'hover:bg-gray-50'} ${closedTemporarily ? 'opacity-60' : ''}`}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
            {isMobile ? 'Punto móvil' : 'Punto fijo'}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">{name}</h3>
            {distanceKm != null && (
              <span className="text-xs text-gray-400 shrink-0">
                {distanceKm < 1
                  ? `${Math.round(distanceKm * 1000)} m`
                  : `${distanceKm.toFixed(1)} km`}
              </span>
            )}
          </div>
          {(address || locality) && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
              <svg
                className="shrink-0 text-gray-400"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span>{[address, locality].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {closedPermanently ? (
            <p className="mt-1.5 text-xs font-medium text-red-600">Cerrado permanentemente</p>
          ) : (
            <>
              {hours && (
                <div className="flex items-start gap-1.5 mt-1 text-xs text-gray-500">
                  <svg
                    className="shrink-0 mt-0.5 text-gray-400"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
                  </svg>
                  <span>{hours}</span>
                </div>
              )}
              <div className="mt-1.5">
                <OpenStatusBadge openingHours={openingHours} region={region} />
              </div>
            </>
          )}
        </div>
        {mapsUrl && !closedPermanently && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="shrink-0 self-center border-2 border-gray-900 text-gray-900 rounded-full px-5 py-2.5 text-sm font-medium hover:bg-gray-900 hover:text-white transition-colors whitespace-nowrap"
          >
            Cómo llegar
          </a>
        )}
      </div>
      <div className="mt-4 h-px bg-gray-100" />
    </div>
  )
}
