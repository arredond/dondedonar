import HeaderTitle from './HeaderTitle'
import BloodLevelBadges from './BloodLevelBadges'
import { requirementsLink } from '../lib/regions'

// Small link under the title to the current region's official "who can
// donate" page (age, weight, intervals…), which varies slightly by region.
function RequirementsLink({ region }) {
  const url = requirementsLink(region)
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Requisitos para donar en ${region}: web oficial`}
      className="self-start text-xs sm:text-sm text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-red-600 hover:decoration-red-300 transition-colors"
    >
      Requisitos para donar
    </a>
  )
}

// hideOnMobile: the mobile list panel is a fixed, full-screen overlay meant to
// sit above everything else in the app — including this header. In practice it
// doesn't always paint above it (stacking-context quirks vary by browser), so
// instead of relying on z-index alone we just remove the header from mobile
// layout while the list overlay is open, guaranteeing its search bar and close
// button stay reachable. Desktop is unaffected (the list is a side panel there).
export default function Header({
  hideOnMobile = false,
  donationType,
  onSelectDonationType,
  region,
  onSelectRegion,
}) {
  return (
    <header
      className={`${hideOnMobile ? 'hidden md:flex' : 'flex'} items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 shrink-0`}
    >
      <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
        <HeaderTitle
          donationType={donationType}
          onSelectDonationType={onSelectDonationType}
          region={region}
          onSelectRegion={onSelectRegion}
        />
        <RequirementsLink region={region} />
      </div>
      <BloodLevelBadges region={region} />
    </header>
  )
}
