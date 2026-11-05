import HeaderTitle from './HeaderTitle'
import BloodLevelBadges from './BloodLevelBadges'

// hideOnMobile: the mobile list panel is a fixed, full-screen overlay meant to
// sit above everything else in the app — including this header. In practice it
// doesn't always paint above it (stacking-context quirks vary by browser), so
// instead of relying on z-index alone we just remove the header from mobile
// layout while the list overlay is open, guaranteeing its search bar and close
// button stay reachable. Desktop is unaffected (the list is a side panel there).
// On mobile the blood-level badges sit on their own row under the title (see
// BloodLevelBadges), so the one-line title gets the full width.
export default function Header({
  hideOnMobile = false,
  donationType,
  onSelectDonationType,
  region,
  onSelectRegion,
}) {
  return (
    <header
      className={`${hideOnMobile ? 'hidden md:flex' : 'flex'} flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 shrink-0`}
    >
      <HeaderTitle
        donationType={donationType}
        onSelectDonationType={onSelectDonationType}
        region={region}
        onSelectRegion={onSelectRegion}
      />
      <BloodLevelBadges region={region} />
    </header>
  )
}
