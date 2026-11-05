import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { REGIONS, regionLink, regionEntity, requirementsLink } from '../lib/regions'
import { DONATION_TYPES, DONATION_TYPE_LABELS } from '../lib/donationTypes'

function useOutsideClick(onOutside) {
  const ref = useRef(null)
  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onOutside])
  return ref
}

// One clickable red word in the title (donation type or region), opening a
// dropdown to override it manually — see TitleDropdown in HeaderTitle below.
// shrink: let this word give up width (truncated with an ellipsis) so the
// title stays on one line; only the button clips, not the dropdown menu.
function TitleDropdown({
  label,
  value,
  options,
  renderOption = option => option,
  onSelect,
  shrink = false,
}) {
  const [open, setOpen] = useState(false)
  const ref = useOutsideClick(() => setOpen(false))

  return (
    <span ref={ref} className={`relative ${shrink ? 'min-w-0' : 'shrink-0'}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title={typeof label === 'string' ? label : undefined}
        className="block max-w-full truncate pb-1 text-red-600 underline decoration-2 decoration-red-200 underline-offset-4 hover:decoration-red-400 transition-colors"
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-30 min-w-[11rem] bg-white text-gray-900 text-sm font-normal normal-case rounded-xl shadow-xl border border-gray-100 py-1 text-left">
          {options.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onSelect(option)
                setOpen(false)
              }}
              className={`block w-full text-left px-3.5 py-2 hover:bg-gray-50 transition-colors ${
                option === value ? 'font-semibold' : ''
              }`}
            >
              {renderOption(option)}
            </button>
          ))}
        </div>
      )}
    </span>
  )
}

// Info icon after the region dropdown, opening a small menu of the region's
// official pages: the body that runs blood donation there (its plasma / bone
// marrow page while that donation type is selected, where it has one — see
// regionLink in lib/regions.js) and its "who can donate" requirements page.
// The menu opens just below the icon; if that would run past the right edge
// of the screen (e.g. on mobile, with the icon at the end of a long line) it's
// shifted left just enough to stay on screen.
const TYPE_LINK_TITLES = { plasma: 'Donar plasma', medula: 'Donar médula' }

function RegionInfoMenu({ region, donationType }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useOutsideClick(close)
  const menuRef = useRef(null)
  const [shift, setShift] = useState(0)

  useLayoutEffect(() => {
    if (!open || !menuRef.current) return
    const margin = 16
    const { right } = menuRef.current.getBoundingClientRect()
    // Measured from the unshifted position: it's reset to 0 on each open.
    setShift(Math.min(0, window.innerWidth - margin - right))
  }, [open])

  const link = regionLink(region, donationType)
  if (!link) return null

  const items = [
    {
      label: regionEntity(region) ?? 'Web oficial de donación',
      detail: link.isTypeSpecific ? TYPE_LINK_TITLES[donationType] : null,
      url: link.url,
    },
    { label: 'Requisitos para donar', detail: null, url: requirementsLink(region) },
  ].filter(item => item.url)
  const title = `Webs oficiales de donación en ${region}`

  return (
    <span ref={ref} className="relative shrink-0 self-center">
      <button
        type="button"
        onClick={() => {
          setShift(0)
          setOpen(v => !v)
        }}
        title={title}
        aria-label={title}
        aria-expanded={open}
        className={`flex ml-1.5 transition-colors ${
          open ? 'text-red-600' : 'text-gray-700 hover:text-red-600'
        }`}
      >
        <svg
          className="w-[0.8em] h-[0.8em]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{ transform: `translateX(${shift}px)` }}
          className="absolute left-0 top-full mt-2 z-30 min-w-[13rem] max-w-[calc(100vw-2rem)] bg-white text-gray-900 text-sm font-normal tracking-normal rounded-xl shadow-xl border border-gray-100 py-1 text-left"
        >
          {items.map(item => (
            <a
              key={item.label}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="flex items-center justify-between gap-3 px-3.5 py-2 hover:bg-gray-50 hover:text-red-600 transition-colors"
            >
              <span className="flex flex-col">
                <span>{item.label}</span>
                {item.detail && <span className="text-xs text-gray-500">{item.detail}</span>}
              </span>
              <svg
                className="w-3.5 h-3.5 shrink-0 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          ))}
        </div>
      )}
    </span>
  )
}

// "dónde donar [sangre] en [Castilla y León]" — the two bracketed words track
// the donation-type filter and the region the map is currently centered on
// (see nearestRegion in lib/regions.js), and are independently clickable to
// override either one directly from the title instead. Always one line: a
// region name too long for the screen is truncated (full name on hover and in
// the dropdown), so the header keeps the same height in every region.
export default function HeaderTitle({
  donationType,
  onSelectDonationType,
  region,
  onSelectRegion,
}) {
  return (
    <div className="flex items-baseline whitespace-nowrap text-base sm:text-2xl font-bold tracking-tight leading-tight min-w-0">
      {/* Flex items drop trailing plain spaces, hence the non-breaking ones. */}
      <span className="text-black shrink-0">{'dónde donar\u00a0'}</span>
      <TitleDropdown
        label={DONATION_TYPE_LABELS[donationType] ?? donationType}
        value={donationType}
        options={DONATION_TYPES}
        renderOption={type => DONATION_TYPE_LABELS[type]}
        onSelect={onSelectDonationType}
      />
      <span className="text-black shrink-0">{'\u00a0en\u00a0'}</span>
      <TitleDropdown
        label={region ?? '…'}
        value={region}
        options={REGIONS}
        onSelect={onSelectRegion}
        shrink
      />
      <RegionInfoMenu region={region} donationType={donationType} />
    </div>
  )
}
