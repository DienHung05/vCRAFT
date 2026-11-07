"""Build fox-directions-blink.webp from fox-directions.webp (GH#186).

Each 360x360 cell keeps its pose; only the eyes change. For every eye the script grows the eye region
(dark iris + white sclera) from a hand-placed seed, leaves the nose and the silhouette outline alone,
inpaints the eye from the surrounding skin and draws a closed-lid stroke. Alpha is copied unchanged, so
head, ears and outline stay pixel-aligned with the directions sheet.

Usage (needs opencv-python-headless and numpy; Pillow re-encodes the result as lossy WebP q90):
  python scripts/mascot/make-blink-sheet.py packages/ui/assets/mascot/fox-directions.webp out.webp preview.png
"""
import sys
import cv2
import numpy as np
from collections import deque

SRC, OUT, PREVIEW = sys.argv[1], sys.argv[2], sys.argv[3]
CELL = 360
# per cell: list of eyes (seed x, seed y, max radius), list of protected ellipses (nose)
SPEC = [
    ([(162, 148, 34), (108, 124, 27)], [(106, 146, 13, 8)]),   # up-left
    ([(135, 137, 32), (213, 136, 32)], [(175, 152, 11, 7)]),   # up
    ([(188, 147, 34), (243, 124, 27)], [(245, 146, 13, 8)]),   # up-right
    ([(138, 167, 34), (83, 157, 26)], [(86, 175, 12, 8)]),     # left
    ([(134, 166, 32), (214, 167, 32)], [(175, 185, 11, 7)]),   # center
    ([(213, 167, 34), (267, 157, 26)], [(263, 176, 12, 8)]),   # right
    ([(160, 194, 34), (96, 191, 26)], [(111, 213, 13, 8)]),    # down-left
    ([(136, 198, 32), (214, 198, 32)], [(175, 219, 12, 8)]),   # down
    ([(189, 195, 34), (253, 192, 26)], [(238, 213, 13, 8)]),   # down-right
]

im = cv2.imread(SRC, cv2.IMREAD_UNCHANGED)
out = im.copy()
for idx, (eyes, protect) in enumerate(SPEC):
    r, c = divmod(idx, 3)
    cell = im[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL]
    bgr = cell[:, :, :3].astype(np.float32)
    alpha = cell[:, :, 3]
    b, g, rr = bgr[:, :, 0], bgr[:, :, 1], bgr[:, :, 2]
    lum = 0.299 * rr + 0.587 * g + 0.114 * b
    mx = bgr.max(axis=2)
    mn = bgr.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1)
    eyeish = ((lum < 140) | ((lum > 215) & (sat < 0.10))) & (alpha > 200)
    prot = np.zeros(lum.shape, np.uint8)
    for (px, py, ax, ay) in protect:
        cv2.ellipse(prot, (px, py), (ax, ay), 0, 0, 360, 1, -1)
    # The silhouette outline (dark band next to the transparent outside) is never part of an eye.
    inside = (alpha >= 128).astype(np.uint8)
    dist_ext = cv2.distanceTransform(inside, cv2.DIST_L2, 5)
    rim = (dist_ext <= 4.5) & (lum < 150)
    rim = cv2.dilate(rim.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (dist_ext <= 5.5)
    nose = prot.astype(bool)
    prot = (prot.astype(bool) | rim).astype(np.uint8)
    mask = np.zeros(lum.shape, np.uint8)
    lids = []
    for (sx, sy, rad) in eyes:
        seen = np.zeros(lum.shape, bool)
        q = deque([(sx, sy)])
        seen[sy, sx] = True
        pts = []
        while q:
            x, y = q.popleft()
            pts.append((x, y))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < CELL and 0 <= ny < CELL and not seen[ny, nx]:
                    seen[ny, nx] = True
                    if eyeish[ny, nx] and not prot[ny, nx] and (nx - sx) ** 2 + (ny - sy) ** 2 <= rad * rad:
                        q.append((nx, ny))
        m = np.zeros(lum.shape, np.uint8)
        for x, y in pts:
            m[y, x] = 1
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        ys, xs = np.nonzero(m)
        lids.append((xs.min(), xs.max(), ys.min(), ys.max()))
        mask |= m
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8)) & (1 - prot) & (alpha > 200).astype(np.uint8)
    # Inpaint from skin only: hide the dark outline and nose from the inpainting source first.
    src = cell[:, :, :3].copy()
    ring = cv2.dilate(mask, np.ones((25, 25), np.uint8)).astype(bool) & ~mask.astype(bool)
    skin = ring & (lum > 150) & (alpha > 250)
    cream = np.median(src[skin], axis=0) if skin.any() else np.array([205, 228, 252])
    dark_near = ring & (lum < 150)
    src[dark_near] = cream
    filled = cv2.inpaint(src, mask * 255, 7, cv2.INPAINT_TELEA)
    filled[~mask.astype(bool)] = cell[:, :, :3][~mask.astype(bool)]
    # Supersample the lid strokes for smooth anti-aliasing.
    S = 4
    big = cv2.resize(filled, None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)
    for (x0, x1, y0, y1) in lids:
        w, h = x1 - x0, y1 - y0
        cx = (x0 + x1) / 2
        cy = y0 + h * 0.55
        half = w * 0.46
        sag = max(3.0, h * 0.16)
        thick = 3.6 if w > 30 else 3.0
        pts = []
        for t in np.linspace(-1, 1, 40):
            pts.append((cx + t * half, cy + sag * (1 - t * t)))
        arr = (np.array(pts) * S).astype(np.int32)
        cv2.polylines(big, [arr], False, (22, 24, 38), int(thick * S), cv2.LINE_AA)
    filled = cv2.resize(big, (CELL, CELL), interpolation=cv2.INTER_AREA)
    # Only pixels near the eyes may change: everything else stays byte-identical.
    touch = cv2.dilate(mask, np.ones((9, 9), np.uint8)).astype(bool) & ~prot.astype(bool)
    res = cell.copy()
    res[:, :, :3][touch] = filled[touch]
    out[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] = res

from PIL import Image  # noqa: E402

Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGRA2RGBA)).save(OUT, 'WEBP', quality=90, method=6, exact=True)
bg = np.full(im.shape[:2] + (3,), (200, 230, 200), np.uint8)
a = out[:, :, 3:4] / 255.0
cv2.imwrite(PREVIEW, (out[:, :, :3] * a + bg * (1 - a)).astype(np.uint8))
diff = np.any(out != im, axis=2)
print('changed pixels per cell:', [int(diff[r*CELL:(r+1)*CELL, c*CELL:(c+1)*CELL].sum()) for r in range(3) for c in range(3)])
print('alpha identical:', bool((out[:, :, 3] == im[:, :, 3]).all()))
