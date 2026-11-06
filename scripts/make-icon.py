#!/usr/bin/env python3
"""Draw a simple phone mark and write build/icon.png plus build/icon.ico."""

import struct
import zlib
from pathlib import Path

SIZE = 256


def smoothstep(edge0, edge1, value):
    span = max(edge1 - edge0, 1e-6)
    t = min(1.0, max(0.0, (value - edge0) / span))
    return t * t * (3 - 2 * t)


def rounded_coverage(px, py, x, y, w, h, radius):
    cx = min(max(px, x + radius), x + w - radius)
    cy = min(max(py, y + radius), y + h - radius)
    dist = ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5
    return 1.0 - smoothstep(radius - 0.8, radius + 0.6, dist)


def blend(dst, src, alpha):
    out = [0, 0, 0, 0]
    inv = 1 - alpha * src[3]
    out[3] = alpha * src[3] + inv * dst[3]
    if out[3] <= 0:
        return dst
    for i in range(3):
        out[i] = (alpha * src[3] * src[i] + inv * dst[3] * dst[i]) / out[3]
    return out


def pixel(x, y):
    color = [0, 0, 0, 0]
    # Canvas
    bg = rounded_coverage(x, y, 16, 16, 224, 224, 36)
    color = blend(color, [0.0, 0.353, 0.620, 1], bg)
    # Phone body
    body = rounded_coverage(x, y, 92, 48, 72, 160, 12)
    color = blend(color, [1, 1, 1, 1], body)
    # Screen
    screen = rounded_coverage(x, y, 102, 66, 52, 104, 4)
    color = blend(color, [0.0, 0.353, 0.620, 1], screen)
    # Speaker
    speaker = rounded_coverage(x, y, 118, 56, 20, 4, 2)
    color = blend(color, [0.0, 0.353, 0.620, 1], speaker)
    return [max(0, min(255, round(channel * 255))) for channel in color]


def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def png_bytes(size, sampler):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(sampler(x + 0.5, y + 0.5))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    return png


def ico_with_png(png):
    # Vista-style ICO: one PNG image, width/height 0 means 256.
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png), 6 + 16)
    return header + entry + png


def main():
    root = Path(__file__).resolve().parents[1]
    build = root / "build"
    build.mkdir(exist_ok=True)
    data = png_bytes(SIZE, pixel)
    (build / "icon.png").write_bytes(data)
    (build / "icon.ico").write_bytes(ico_with_png(data))
    print(f"Wrote {build / 'icon.png'} and {build / 'icon.ico'}")


if __name__ == "__main__":
    main()
