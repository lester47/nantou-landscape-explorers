"""產生示意暫用圖（全景、時光機、徽章、證書底圖、首頁地圖）到 _placeholder/。

正式圖由 Codex 生成後放進 pano/、timemachine/、ui/、cert/、mascot/，
sync_assets.py 會優先使用正式圖，找不到才用這裡的示意圖。
用法：python tools/make_placeholders.py   （需要 Pillow）
"""
import json
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "_placeholder")

CJK_CANDIDATES = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "C:/Windows/Fonts/msjhbd.ttc",
    "C:/Windows/Fonts/msjh.ttc",
]
EMOJI_CANDIDATES = [
    "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
    "C:/Windows/Fonts/seguiemj.ttf",
]


def first_existing(paths):
    for path in paths:
        if os.path.exists(path):
            return path
    return None


CJK = first_existing(CJK_CANDIDATES)
EMOJI = first_existing(EMOJI_CANDIDATES)


def font(size):
    return ImageFont.truetype(CJK, size) if CJK else ImageFont.load_default()


def emoji_img(ch, size):
    """把 emoji 畫成透明底圖片；沒有彩色 emoji 字型時退回 CJK 字。"""
    if EMOJI and EMOJI.endswith("NotoColorEmoji.ttf"):
        f = ImageFont.truetype(EMOJI, 109)
        im = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((80, 80), ch, font=f, embedded_color=True, anchor="mm")
        return im.crop(im.getbbox() or (0, 0, 160, 160)).resize((size, size), Image.LANCZOS)
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if EMOJI:
        d.text((size / 2, size / 2), ch, font=ImageFont.truetype(EMOJI, int(size * .8)), embedded_color=True, anchor="mm")
    return im


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgradient(w, h, top, bottom):
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        d.line([(0, y), (w, y)], fill=mix(top, bottom, y / max(1, h - 1)))
    return im


def ridge(d, w, base_y, amp, color, seed, peaks=6, sharp=False):
    """畫一條可左右無縫接合的山脊（週期函數）。"""
    rnd = random.Random(seed)
    phases = [rnd.random() * math.tau for _ in range(3)]
    pts = []
    for i in range(0, w + 1, 8):
        t = i / w * math.tau
        v = (math.sin(t * peaks + phases[0]) * .55 + math.sin(t * peaks * 2 + phases[1]) * .3
             + math.sin(t * peaks * 3 + phases[2]) * .15)
        if sharp:
            v = abs(math.sin(t * peaks * 3 + phases[0])) * 1.4 - .4 + v * .3
        pts.append((i, base_y - amp * (v * .5 + .5)))
    pts += [(w, 10 ** 5), (0, 10 ** 5)]
    d.polygon(pts, fill=color)


SCENES = {
    # 天空, 遠山, 近山, 地面, 水面(可選)
    "s1": dict(sky=("#9fd3f5", "#e8f6ff"), far="#7fb59a", near="#4f9a6a", ground="#c9a679", water="#4fb3c8", water_band=(50, 70)),
    "s2": dict(sky=("#f4b88a", "#fde6c8"), far="#b98f62", near="#9c7650", ground="#a8a090", sharp=True),
    "s3": dict(sky=("#a8d8c0", "#e2f3e8"), far="#3f7d4f", near="#2d6a3e", ground="#5b7d3a", water="#4d8f7a", water_band=(53, 62)),
    "s4": dict(sky=("#a9d4f2", "#eef7ff"), far="#8fb7a2", near="#7aa48b", ground="#d8cbb4", building="#b8452f"),
    "s5": dict(sky=("#b2dbf5", "#f2f8ff"), far="#93bba5", near="#7ea98f", ground="#d9d2c4", building="#c0392b"),
    "s6": dict(sky=("#a6d3ef", "#eaf6ff"), far="#5f9a7a", near="#4c8768", ground="#b89c74", water="#5e9e8a", water_band=(55, 66)),
    "s7": dict(sky=("#b0d7f2", "#f0f8ff"), far="#8db59f", near="#79a28b", ground="#cfc6b6", building="#a0522d"),
    "s8": dict(sky=("#a7d6f4", "#eef8ff"), far="#8cbf9a", near="#6fab7e", ground="#8fc06d", building="#e9e2d0"),
}

CAT_COLOR = {"nature": "#3FA34D", "culture": "#E8833A", "change": "#2F7FC1"}


def label_card(base, cx, cy, title, icon, scale, color):
    """在 (cx, cy) 畫一個示意物件：圓形 emoji＋名稱標籤。"""
    d = ImageDraw.Draw(base)
    r = int(70 * scale)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255), outline=hexrgb(color), width=int(10 * scale))
    em = emoji_img(icon, int(r * 1.3))
    base.paste(em, (int(cx - em.width / 2), int(cy - em.height / 2)), em)
    f = font(int(40 * scale))
    tw = d.textlength(title, font=f)
    pad = 16 * scale
    box = [cx - tw / 2 - pad, cy + r + 10 * scale, cx + tw / 2 + pad, cy + r + 10 * scale + 60 * scale]
    d.rounded_rectangle(box, radius=int(18 * scale), fill=(255, 255, 255), outline=hexrgb(color), width=int(4 * scale))
    d.text((cx, (box[1] + box[3]) / 2), title, font=f, fill=(40, 40, 40), anchor="mm")


def pano(era, idx, w=4096, h=2048):
    sc = SCENES[era["id"]]
    im = vgradient(w, h, hexrgb(sc["sky"][0]), hexrgb(sc["sky"][1]))
    d = ImageDraw.Draw(im)
    horizon = h * .5
    # 雲
    rnd = random.Random(idx)
    for _ in range(14):
        cx, cy = rnd.random() * w, h * (.14 + rnd.random() * .14)
        for k in range(4):
            rr = 60 + rnd.random() * 70
            ox = (k - 1.5) * rr * .9
            d.ellipse([cx + ox - rr, cy - rr * .6, cx + ox + rr, cy + rr * .6], fill=(255, 255, 255))
    ridge(d, w, horizon - 10, h * .14, hexrgb(sc["far"]), idx * 7 + 1, peaks=5, sharp=sc.get("sharp", False))
    ridge(d, w, horizon + 20, h * .09, hexrgb(sc["near"]), idx * 7 + 2, peaks=8, sharp=sc.get("sharp", False))
    d.rectangle([0, horizon + 20, w, h], fill=hexrgb(sc["ground"]))
    if "water" in sc:
        y0, y1 = sc["water_band"]
        d.rectangle([0, h * y0 / 100, w, h * y1 / 100], fill=hexrgb(sc["water"]))
        for k in range(40):
            yy = h * y0 / 100 + (k * 37) % int(h * (y1 - y0) / 100)
            xx = (k * 523) % w
            d.line([(xx, yy), (xx + 120, yy)], fill=mix(hexrgb(sc["water"]), (255, 255, 255), .35), width=4)
    if "building" in sc:
        bc = hexrgb(sc["building"])
        for k in range(10):
            bx = k * w / 10 + w / 40
            bw, bh = w / 18, h * (.06 + (k % 3) * .02)
            d.rectangle([bx, horizon + 20 - bh, bx + bw, horizon + 20], fill=mix(bc, (255, 255, 255), .25))
            d.polygon([(bx - bw * .15, horizon + 20 - bh), (bx + bw / 2, horizon + 20 - bh - h * .03),
                       (bx + bw * 1.15, horizon + 20 - bh)], fill=bc)
    # 地面紋理（下半部近景欄杆感）
    d.rectangle([0, h * .80, w, h], fill=mix(hexrgb(sc["ground"]), (90, 60, 40), .25))
    for k in range(0, w, 256):
        d.rectangle([k, h * .74, k + 26, h * .82], fill=(140, 98, 60))
    d.rectangle([0, h * .755, w, h * .775], fill=(160, 112, 70))

    color = CAT_COLOR[era["category"]]
    # 浮水印（四個方向各一個）
    wm = f"示意圖・第 {idx} 站 {era['name']}"
    fw = font(56)
    for k in range(4):
        cx = w * (k * .25 + .125)
        tw = d.textlength(wm, font=fw)
        d.rounded_rectangle([cx - tw / 2 - 30, h * .2 - 52, cx + tw / 2 + 30, h * .2 + 52], radius=40,
                            fill=(255, 255, 255), outline=hexrgb(color), width=6)
        d.text((cx, h * .2), wm, font=fw, fill=hexrgb(color), anchor="mm")
    # 知識點物件
    for hs in era["hotspots"]:
        cx, cy = w * hs["x"] / 100, h * hs["y"] / 100
        label_card(im, cx, cy, hs["title"].replace("彩蛋：", "彩蛋・"), hs["icon"],
                   1.0 if not hs["id"].endswith("egg") else .75, "#c99700" if hs["id"].endswith("egg") else color)
    return im


def timemachine(name, scene, label, w=1600, h=1000):
    im = vgradient(w, h, (170, 214, 242), (236, 247, 255))
    d = ImageDraw.Draw(im)
    if scene in ("s2_a", "s2_b"):
        bare = scene == "s2_b"
        ridge(d, w, h * .62, h * .38, (176, 141, 98) if bare else (66, 135, 74), 3, peaks=4, sharp=True)
        ridge(d, w, h * .74, h * .22, (196, 160, 112) if bare else (88, 156, 88), 5, peaks=6, sharp=True)
        d.rectangle([0, h * .74, w, h], fill=(170, 165, 150))
        if bare:
            rnd = random.Random(2)
            for _ in range(120):
                x, y, r = rnd.random() * w, h * (.72 + rnd.random() * .1), 6 + rnd.random() * 18
                d.ellipse([x - r, y - r, x + r, y + r], fill=(150, 130, 105))
    else:
        d.rectangle([0, h * .7, w, h], fill=(205, 198, 182) if scene.startswith("s7") else (150, 196, 110))
        ridge(d, w, h * .55, h * .12, (140, 181, 159), 9, peaks=3)
        d.rectangle([0, h * .7, w, h], fill=(205, 198, 182) if scene.startswith("s7") else (150, 196, 110))
        if scene == "s7_a":
            d.rectangle([520, 380, 1080, 700], fill=(200, 70, 50))
            d.polygon([(440, 390), (800, 230), (1160, 390)], fill=(170, 50, 35))
            d.rectangle([740, 560, 860, 700], fill=(90, 40, 30))
        elif scene == "s7_b":
            d.polygon([(420, 700), (800, 560), (1180, 700)], fill=(170, 50, 35))
            for k in range(14):
                x = 470 + k * 50
                d.line([(x, 700), (x + (k % 3 - 1) * 30, 640)], fill=(90, 90, 90), width=6)
            d.rectangle([1250, 560, 1500, 700], fill=(180, 180, 185))
            d.line([(300, 720), (1350, 720)], fill=(220, 40, 40), width=8)
        else:
            d.rectangle([560, 360, 1040, 700], fill=(236, 230, 214))
            for r in range(4):
                for c in range(8):
                    d.rectangle([590 + c * 56, 390 + r * 70, 620 + c * 56, 430 + r * 70], fill=(120, 140, 160))
            big = scene == "s8_b"
            for k in range(9):
                x = 80 + k * 180
                if 500 < x < 1100:
                    continue
                if big:
                    d.ellipse([x - 90, 420, x + 90, 620], fill=(60, 130, 70))
                    d.rectangle([x - 12, 600, x + 12, 720], fill=(110, 80, 50))
                else:
                    d.rectangle([x - 4, 660, x + 4, 720], fill=(110, 80, 50))
                    d.ellipse([x - 22, 620, x + 22, 668], fill=(110, 170, 90))
            if big:
                rnd = random.Random(8)
                for _ in range(50):
                    x, y = rnd.random() * w, h * (.75 + rnd.random() * .2)
                    d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=(60, 60, 90))
            else:
                for k in range(6):
                    d.rectangle([k * 280, h * .86, k * 280 + 240, h * .97], fill=(196, 214, 120))
    f = font(64)
    d.rounded_rectangle([40, 40, 40 + d.textlength(f"示意圖：{label}", font=f) + 60, 150], radius=30,
                        fill=(255, 255, 255), outline=(47, 127, 193), width=6)
    d.text((70, 95), f"示意圖：{label}", font=f, fill=(47, 127, 193), anchor="lm")
    im.save(os.path.join(OUT, "timemachine", name + ".jpg"), quality=85)


def badge(era, size=512):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = hexrgb(CAT_COLOR[era["category"]])
    d.ellipse([8, 8, size - 8, size - 8], fill=c)
    d.ellipse([48, 48, size - 48, size - 48], fill=(255, 252, 240))
    for k in range(24):
        a = k / 24 * math.tau
        x, y = size / 2 + math.cos(a) * (size / 2 - 28), size / 2 + math.sin(a) * (size / 2 - 28)
        d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=mix(c, (255, 255, 255), .5))
    em = emoji_img(era["badgeEmoji"], int(size * .5))
    im.paste(em, (int(size / 2 - em.width / 2), int(size / 2 - em.height / 2)), em)
    im.save(os.path.join(OUT, "ui", f"badge_{era['id']}.png"))


def cert_bg(w=3508, h=2480):
    im = vgradient(w, h, (253, 250, 240), (246, 240, 222))
    d = ImageDraw.Draw(im)
    ridge(d, w, h * .985, h * .07, (150, 196, 160), 21, peaks=4)
    ridge(d, w, h * 1.0, h * .045, (90, 160, 110), 22, peaks=7)
    d.rectangle([0, h * .975, w, h], fill=(80, 150, 175))
    for i, (wd, col) in enumerate([(36, (47, 127, 193)), (12, (232, 131, 58))]):
        m = 60 + i * 60
        d.rounded_rectangle([m, m, w - m, h - m], radius=60, outline=col, width=wd)
    for cx, cy in [(200, 200), (w - 200, 200), (200, h - 260), (w - 200, h - 260)]:
        d.ellipse([cx - 70, cy - 70, cx + 70, cy + 70], fill=(63, 163, 77))
        d.ellipse([cx - 40, cy - 40, cx + 40, cy + 40], fill=(253, 250, 240))
    f = font(54)
    d.text((w - 140, h - 140), "示意證書底圖・待 Codex 替換", font=f, fill=(170, 160, 140), anchor="rs")
    im.save(os.path.join(OUT, "cert", "certificate_bg.png"))


def hero_map(eras, w=1920, h=1080):
    im = vgradient(w, h, (226, 241, 229), (205, 230, 214))
    d = ImageDraw.Draw(im)
    blob = [(820, 140), (1180, 110), (1500, 220), (1700, 430), (1650, 760), (1380, 960), (980, 990), (760, 820), (700, 520)]
    d.polygon(blob, fill=(168, 210, 160), outline=(90, 150, 100))
    d.line([(760, 720), (980, 640), (1180, 700), (1420, 600), (1640, 640)], fill=(90, 170, 210), width=14)
    d.ellipse([1230, 560, 1340, 625], fill=(70, 160, 210))
    pos = {"s1": (1300, 520), "s2": (1060, 250), "s3": (1240, 880), "s4": (780, 560),
           "s5": (800, 900), "s6": (1400, 740), "s7": (1010, 760), "s8": (820, 380)}
    f = font(30)
    for era in eras:
        x, y = pos[era["id"]]
        c = hexrgb(CAT_COLOR[era["category"]])
        d.ellipse([x - 34, y - 34, x + 34, y + 34], fill=(255, 255, 255), outline=c, width=6)
        em = emoji_img(era["badgeEmoji"], 40)
        im.paste(em, (x - 20, y - 20), em)
        d.text((x + 44, y), era["name"], font=f, fill=(40, 60, 40), anchor="lm")
    d.text((w - 30, h - 30), "示意地圖・待 Codex 替換", font=font(28), fill=(120, 140, 120), anchor="rs")
    im.save(os.path.join(OUT, "ui", "hero_map.jpg"), quality=88)


def main():
    for sub in ("pano", "timemachine", "ui", "cert"):
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)
    data = json.load(open(os.path.join(ROOT, "data", "eras.json"), encoding="utf-8"))
    eras = data["eras"]
    for i, era in enumerate(eras, 1):
        pano(era, i).save(os.path.join(OUT, "pano", era["file"] + ".jpg"), quality=82)
        badge(era)
        print("全景示意圖", era["file"])
    for name, label in [("s2_a", "921 地震前・翠綠的山峰"), ("s2_b", "921 地震後・山壁崩塌"),
                        ("s7_a", "921 地震前・完整的武昌宮"), ("s7_b", "921 地震後・屋頂落地"),
                        ("s8_a", "興建初期・小樹苗與農田"), ("s8_b", "省府時期・大樹成蔭、人潮多")]:
        timemachine(name, name, label)
    cert_bg()
    hero_map(eras)
    print("完成：示意圖已輸出到 _placeholder/")


if __name__ == "__main__":
    main()
