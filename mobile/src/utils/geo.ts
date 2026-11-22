export type LatLngPoint = [number, number];

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(a: LatLngPoint, b: LatLngPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Project `point` onto a polyline `route`, returning the closest distance in meters
 * and normalized progress along the route (0 = origin, 1 = destination).
 */
export function projectOnRoute(
  point: LatLngPoint,
  route: LatLngPoint[],
): { distanceM: number; progress: number } {
  if (route.length === 0) return { distanceM: Infinity, progress: 0 };
  if (route.length === 1) {
    return { distanceM: haversineMeters(point, route[0]), progress: 0 };
  }

  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < route.length - 1; i++) {
    const l = haversineMeters(route[i], route[i + 1]);
    segLens.push(l);
    totalLen += l;
  }

  let bestDist = Infinity;
  let bestAlong = 0;
  let cumLen = 0;

  const cosLat = Math.cos((point[0] * Math.PI) / 180);

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const ax = a[1] * cosLat;
    const ay = a[0];
    const bx = b[1] * cosLat;
    const by = b[0];
    const px = point[1] * cosLat;
    const py = point[0];

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t =
      lenSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)) : 0;

    const proj: LatLngPoint = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    const dist = haversineMeters(point, proj);
    if (dist < bestDist) {
      bestDist = dist;
      bestAlong = cumLen + t * segLens[i];
    }
    cumLen += segLens[i];
  }

  const progress = totalLen > 0 ? Math.max(0, Math.min(1, bestAlong / totalLen)) : 0;
  return { distanceM: Math.round(bestDist), progress };
}

/**
 * Compute proportional fare suggestion for partial-route trips (rounded to nearest PKR 10).
 */
export function estimatePartialFare(
  fullFare: number,
  pickupProgress: number,
  dropoffProgress: number,
): { fare: number; pct: number } {
  const rawRatio = Math.max(0.2, Math.min(1, dropoffProgress - pickupProgress));
  const pct = Math.round(rawRatio * 100);
  if (pct >= 92 || fullFare <= 0) {
    return { fare: fullFare, pct: 100 };
  }
  const scaled = Math.max(20, Math.round((fullFare * rawRatio) / 10) * 10);
  return { fare: Math.min(fullFare, scaled), pct };
}
