"""Pure geo maths (no DB, no network). Points are (lat, lng) in degrees."""
import math

EARTH_R_M = 6_371_000.0
Point = tuple[float, float]


def haversine_m(a: Point, b: Point) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * EARTH_R_M * math.asin(math.sqrt(h))


def route_length_km(route: list[Point]) -> float:
    return sum(haversine_m(route[i], route[i + 1]) for i in range(len(route) - 1)) / 1000


def decode_polyline(encoded: str) -> list[Point]:
    """Decode a Google encoded polyline."""
    pts: list[Point] = []
    idx = lat = lng = 0
    while idx < len(encoded):
        for is_lng in (False, True):
            shift = result = 0
            while True:
                b = ord(encoded[idx]) - 63
                idx += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if is_lng:
                lng += delta
            else:
                lat += delta
        pts.append((lat / 1e5, lng / 1e5))
    return pts


def project_on_route(point: Point, route: list[Point]) -> tuple[float, int]:
    """Return (distance in metres from point to the route, index of the nearest segment).

    Uses a local equirectangular projection, accurate to well under 1 m at campus scale.
    """
    if len(route) == 1:
        return haversine_m(point, route[0]), 0
    lat0 = math.radians(point[0])
    kx = math.cos(lat0) * math.pi / 180 * EARTH_R_M
    ky = math.pi / 180 * EARTH_R_M

    def xy(p: Point) -> tuple[float, float]:
        return (p[1] - point[1]) * kx, (p[0] - point[0]) * ky

    best, best_i = float("inf"), 0
    for i in range(len(route) - 1):
        ax, ay = xy(route[i])
        bx, by = xy(route[i + 1])
        dx, dy = bx - ax, by - ay
        seg2 = dx * dx + dy * dy
        t = 0.0 if seg2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / seg2))
        d = math.hypot(ax + t * dx, ay + t * dy)
        if d < best:
            best, best_i = d, i
    return best, best_i


def straight_route(a: Point, b: Point, steps: int = 12) -> list[Point]:
    return [(a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps) for i in range(steps + 1)]
