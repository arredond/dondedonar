import { haversine } from './geo'
import regionBoundaries from '../data/regionBoundaries.json'
import regionData from '../data/regions.json'

// Per-region app data, one entry per region the ETL covers (the REGION
// constants in etl/regions/), keyed by that exact name:
//   - entity: short name of the body that runs blood donation there (e.g.
//     "Centro de Transfusión"), the label for its "sangre" link in the info
//     menu next to the header's region dropdown
//   - links: the official page for each donation type ("sangre" is the
//     region's transfusion centre / blood bank home page; "plasma" and
//     "medula" are its pages for those, where it has one), both in the
//     info menu next to the header's region dropdown; "requirements" is the
//     page listing who can donate (age, weight, intervals…), which varies
//     slightly by region, also in that menu
//   - medula: how to register as a bone marrow donor there (see lib/medula.js)
// Kept in alphabetical order, since its keys are also the header's region
// dropdown options.
export const REGIONS = Object.keys(regionData)

// The official page for a donation type in a region, falling back to the
// region's main page when it has none for that type.
export function regionLink(region, donationType) {
  const links = regionData[region]?.links
  if (!links) return null
  const url = links[donationType] ?? links.sangre
  return { url, isTypeSpecific: donationType !== 'sangre' && Boolean(links[donationType]) }
}

// The region's official page on who can donate blood, or null if unknown.
export function requirementsLink(region) {
  return regionData[region]?.links?.requirements ?? null
}

// Short name of the body that runs blood donation in the region, or null.
export function regionEntity(region) {
  return regionData[region]?.entity ?? null
}

// regionBoundaries.json holds just these regions' real polygons, trimmed
// from codeforgermany/click_that_hood's spain-communities.geojson (public
// domain-ish community dataset) down to ~115KB (Cataluña's coastline islets
// dropped and its outline simplified, Llívia kept; Galicia's sliver holes
// dropped, its islets too except Arousa; País Vasco's islets dropped, its
// Treviño and Villaverde enclave holes kept; Región de Murcia's sliver holes
// and its Mar Menor and coastal islets dropped; Extremadura as-is). An
// earlier version of this module guessed the region from whichever fixed
// point was nearest instead —
// but that's biased by point *density*, not the real border: Madrid's 32
// fixed points vs. Castilla y León's 10, spread over a much bigger area,
// bulged Madrid's detected area well past its actual (small) territory. Real
// polygons don't have that problem.
function pointInRing(lng, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

function pointInGeometry(lng, lat, geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.some(([outer, ...holes]) => {
    if (!pointInRing(lng, lat, outer)) return false
    return !holes.some(hole => pointInRing(lng, lat, hole))
  })
}

// The region whose real boundary contains the given map center, or null if
// it falls outside every region we have a boundary for (e.g. panned to some
// other part of Spain) — see nearestCoveredRegion for a fallback then.
export function regionAt(center) {
  if (!center) return null
  const feature = regionBoundaries.features.find(f =>
    pointInGeometry(center.lng, center.lat, f.geometry)
  )
  return feature?.properties?.region ?? null
}

// Fallback for when the map center isn't inside any region we cover —
// picks whichever fixed point is closest and uses its region, so the
// title/blood levels still show *something* relevant instead of going blank.
export function nearestCoveredRegion(fixedPoints, center) {
  if (!center || fixedPoints.length === 0) return null
  let best = null
  let bestDist = Infinity
  for (const point of fixedPoints) {
    const [lng, lat] = point.geometry.coordinates
    const dist = haversine(center.lat, center.lng, lat, lng)
    if (dist < bestDist) {
      bestDist = dist
      best = point.properties?.region ?? null
    }
  }
  return best
}
