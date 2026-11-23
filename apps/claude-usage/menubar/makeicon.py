import zlib, struct, math, os, subprocess

CLAUDE_ORANGE = (217, 119, 87)

def burst_alpha(x, y, s):
    """Claude's starburst: 12 lens-shaped rays — pointed at the hub and at the tip,
    widest around the middle of their length."""
    cx = cy = (s - 1) / 2.0
    dx, dy = x - cx, y - cy
    r = math.hypot(dx, dy) / (s * 0.47)
    if r > 1.0 or r < 1e-6:
        return 1.0 if r <= 1e-6 else 0.0
    rays = 12
    step = 2 * math.pi / rays
    a = math.atan2(dy, dx) % step
    ang = min(a, step - a)                 # angular distance to the nearest ray axis
    half = 0.19 * math.sin(math.pi * r ** 0.85)   # the lens profile
    if half <= 0:
        return 0.0
    soft = 0.035
    return max(0.0, min(1.0, (half - ang) / soft))

def png(size, rgb, alpha_fn, supersample=3):
    rows = b''
    S = supersample
    for y in range(size):
        row = b'\x00'
        for x in range(size):
            acc = 0.0
            for sy in range(S):
                for sx in range(S):
                    acc += alpha_fn(x + (sx + .5) / S, y + (sy + .5) / S, size)
            a = int(255 * acc / (S * S))
            row += bytes((rgb[0], rgb[1], rgb[2], a))
        rows += row
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b'')

os.makedirs('AppIcon.iconset', exist_ok=True)
for size, names in [(16, ['icon_16x16.png']), (32, ['icon_16x16@2x.png', 'icon_32x32.png']),
                    (64, ['icon_32x32@2x.png']), (128, ['icon_128x128.png']),
                    (256, ['icon_128x128@2x.png', 'icon_256x256.png']),
                    (512, ['icon_256x256@2x.png', 'icon_512x512.png']),
                    (1024, ['icon_512x512@2x.png'])]:
    data = png(size, CLAUDE_ORANGE, burst_alpha, 2 if size > 256 else 3)
    for n in names:
        open(os.path.join('AppIcon.iconset', n), 'wb').write(data)
    print('.', end='', flush=True)
print()
subprocess.run(['iconutil', '-c', 'icns', 'AppIcon.iconset', '-o', 'AppIcon.icns'], check=True)

# menu bar version: black + alpha only, template image
for size, name in ((16, 'trayTemplate.png'), (32, 'trayTemplate@2x.png')):
    open(name, 'wb').write(png(size, (0, 0, 0), burst_alpha, 4))
print('done')
