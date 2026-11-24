"""가상 학생 사진 생성기 (실제 학생 사진 대신 테스트용 합성 이미지)

python3 scripts/make-virtual-photos.py [출력폴더]
DAY별 장면(도쿄타워 / 디즈니 성 / 교실 / 대학 캠퍼스)을 단순 도형으로 그린 JPEG를 만듭니다.
일부는 휴대폰 원본 크기(4032x3024, 3~6MB)로 만들어 대용량 업로드도 검증합니다.
"""
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "data/virtual-photos"
os.makedirs(OUT, exist_ok=True)


def grad(draw, w, h, top, bottom):
    for y in range(h):
        t = y / h
        c = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        draw.line([(0, y), (w, y)], fill=c)


def day1(d, w, h, r):
    grad(d, w, h, (120, 170, 220), (240, 210, 190))
    for i in range(14):  # 빌딩
        bx = r.randint(0, w)
        bw = r.randint(w // 14, w // 7)
        bh = r.randint(h // 4, int(h * 0.7))
        g = r.randint(80, 150)
        d.rectangle([bx, h - bh, bx + bw, h], fill=(g, g + 5, g + 15))
        for wy in range(h - bh + 20, h - 20, max(12, h // 40)):
            for wx in range(bx + 8, bx + bw - 8, max(12, w // 60)):
                if r.random() < 0.5:
                    d.rectangle([wx, wy, wx + 6, wy + 8], fill=(230, 220, 170))
    cx = r.randint(int(w * 0.35), int(w * 0.65))  # 도쿄타워
    top = int(h * 0.12)
    d.polygon([(cx, top), (cx - w // 9, h), (cx + w // 9, h)], fill=(214, 72, 45))
    for k in range(6):
        y = top + (h - top) * (k + 1) // 7
        half = (w // 9) * (y - top) // (h - top)
        d.line([(cx - half, y), (cx + half, y)], fill=(250, 250, 250), width=max(3, w // 300))
    d.rectangle([cx - w // 30, int(h * 0.42), cx + w // 30, int(h * 0.46)], fill=(245, 245, 245))


def day2(d, w, h, r):
    grad(d, w, h, (20, 30, 70), (90, 60, 120))
    for _ in range(40):
        x, y = r.randint(0, w), r.randint(0, h // 2)
        c = r.choice([(255, 220, 120), (255, 160, 200), (160, 220, 255)])
        rr = r.randint(3, max(4, w // 120))
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=c)
    base = int(h * 0.55)
    d.rectangle([w * 0.25, base, w * 0.75, h], fill=(225, 210, 230))
    for k, tx in enumerate([0.3, 0.42, 0.5, 0.58, 0.7]):
        x = int(w * tx)
        tw = w // 22
        th = int(h * (0.18 if k != 2 else 0.32))
        d.rectangle([x - tw, base - th, x + tw, base], fill=(235, 225, 240))
        d.polygon([(x - tw - 6, base - th), (x + tw + 6, base - th), (x, base - th - int(h * 0.1))], fill=(70, 110, 190))
    d.rectangle([0, int(h * 0.85), w, h], fill=(40, 40, 60))


def day3(d, w, h, r):
    d.rectangle([0, 0, w, h], fill=(214, 200, 175))
    d.rectangle([w * 0.1, h * 0.08, w * 0.9, h * 0.45], fill=(46, 85, 64))
    d.rectangle([w * 0.1, h * 0.45, w * 0.9, h * 0.47], fill=(150, 110, 70))
    for k in range(r.randint(3, 6)):
        x = int(w * 0.15 + k * w * 0.12)
        d.line([(x, h * 0.15), (x + w * 0.06, h * 0.2)], fill=(240, 240, 240), width=4)
    for row in range(3):
        for col in range(4):
            x = int(w * (0.08 + col * 0.23))
            y = int(h * (0.55 + row * 0.14))
            d.rectangle([x, y, x + w * 0.18, y + h * 0.06], fill=(170, 125, 80))
            if r.random() < 0.7:  # 사람(얼굴 없는 실루엣)
                c = r.choice([(40, 50, 90), (240, 240, 240), (90, 90, 100)])
                d.ellipse([x + w * 0.06, y - h * 0.09, x + w * 0.11, y - h * 0.04], fill=(60, 45, 40))
                d.rectangle([x + w * 0.05, y - h * 0.04, x + w * 0.12, y + h * 0.01], fill=c)


def day4(d, w, h, r):
    grad(d, w, h, (90, 150, 220), (200, 225, 245))
    d.rectangle([0, int(h * 0.75), w, h], fill=(110, 150, 80))
    bx = int(w * 0.3)
    d.rectangle([bx, int(h * 0.35), w - bx, int(h * 0.78)], fill=(150, 70, 55))
    d.rectangle([w // 2 - w // 16, int(h * 0.18), w // 2 + w // 16, int(h * 0.78)], fill=(140, 62, 50))
    d.ellipse([w // 2 - w // 40, int(h * 0.22), w // 2 + w // 40, int(h * 0.22) + w // 20], fill=(240, 235, 220))
    d.polygon([(w // 2 - w // 30, int(h * 0.78)), (w // 2 + w // 30, int(h * 0.78)), (w // 2, int(h * 0.62))], fill=(60, 35, 30))
    for _ in range(8):
        tx = r.choice([r.randint(0, bx - 40), r.randint(w - bx, w)])
        tr = r.randint(w // 25, w // 12)
        d.ellipse([tx - tr, int(h * 0.7) - tr, tx + tr, int(h * 0.7) + tr], fill=(r.randint(40, 80), r.randint(110, 150), 60))


MANIFEST = {}
SCENES = {1: day1, 2: day2, 3: day3, 4: day4}


def make(day, idx, big=False):
    r = random.Random(day * 1000 + idx)
    portrait = r.random() < 0.3
    w, h = (4032, 3024) if big else (1600, 1200)
    if portrait:
        w, h = h, w
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    SCENES[day](d, w, h, r)
    if big:
        # 실제 휴대폰 사진 크기에 가깝도록 노이즈 추가
        noise = Image.effect_noise((w, h), 40).convert("RGB")
        img = Image.blend(img, noise, 0.08)
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    name = f"day{day}_{idx:02d}{'_big' if big else ''}.jpg"
    img.save(os.path.join(OUT, name), "JPEG", quality=92 if big else 85)
    # 학생 휴대폰이 만드는 '출력용 사본'(긴 변 2000px)과 같은 파일
    disp = img.copy()
    disp.thumbnail((2000, 2000))
    disp.save(os.path.join(OUT, "display_" + name), "JPEG", quality=86)
    MANIFEST[name] = {"width": disp.width, "height": disp.height, "display": "display_" + name}
    return name


if __name__ == "__main__":
    names = []
    for day in range(1, 5):
        for idx in range(1, 11):
            names.append(make(day, idx))
        names.append(make(day, 99, big=True))
    import json
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(MANIFEST, f, indent=1)
    print(f"{len(names)} photos -> {OUT}")
