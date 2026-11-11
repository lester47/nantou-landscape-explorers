"""南投家鄉景觀探險隊：素材同步與學生獨立版打包。

用法：在本資料夾執行  python sync_assets.py   （需要 Pillow：pip install pillow）

做的事：
1. 每一站優先使用 Codex 正式圖（pano/、timemachine/、ui/、cert/、mascot/），
   找不到才用 _placeholder/ 的示意圖。
2. 讀取 pano/hotspots_sN.json（若有），把線索位置換成 Codex 實際畫出的 x、y。
3. 產生網頁用的縮小全景圖、卡片縮圖、時光機「現在」圖與灰階徽章到 build/。
4. 由 data/eras.json 產生 data/eras.js（網頁實際讀的資料）。
5. 產生 data/pano_data.js、data/cert_data.js（離線雙擊 index.html 用）。
6. 產生 dist/南投家鄉景觀探險隊_學生獨立版.html（單一檔案，可離線使用）。
"""
import base64
import io
import json
import os

from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
WEB_PANO_W = 4096          # 網頁用全景寬度（多數平板 WebGL 上限）
EMBED_PANO_W = 3072        # 單檔獨立版內嵌全景寬度（控制檔案大小）


def p(*parts):
    return os.path.join(HERE, *parts)


def exists(rel):
    return os.path.exists(p(rel))


def resolve(rel):
    """正式圖優先，否則用示意圖。回傳 (相對路徑, 是否為示意圖)。"""
    if exists(rel):
        return rel, False
    ph = "_placeholder/" + rel
    if exists(ph):
        return ph, True
    return None, True


def newer(src, dst):
    return not exists(dst) or os.path.getmtime(p(src)) > os.path.getmtime(p(dst))


def save_resized(src, dst, width, quality=85, crop=None):
    if not newer(src, dst):
        return
    im = Image.open(p(src)).convert("RGB")
    if crop:
        w, h = im.size
        im = im.crop((int(w * crop[0]), int(h * crop[1]), int(w * crop[2]), int(h * crop[3])))
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    os.makedirs(os.path.dirname(p(dst)), exist_ok=True)
    im.save(p(dst), "JPEG", quality=quality)


def data_uri(rel, max_w=None, as_jpeg=False, quality=85):
    if max_w or as_jpeg:
        im = Image.open(p(rel))
        if as_jpeg:
            im = im.convert("RGB")
        if max_w and im.width > max_w:
            im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        if as_jpeg:
            im.save(buf, "JPEG", quality=quality)
            mime = "image/jpeg"
        else:
            im.save(buf, "PNG", optimize=True)
            mime = "image/png"
        raw = buf.getvalue()
    else:
        raw = open(p(rel), "rb").read()
        mime = "image/png" if rel.lower().endswith(".png") else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(raw).decode("ascii")


def to_yaw_pitch(x, y):
    return round(x * 3.6 - 180, 2), round(90 - y * 1.8, 2)


def read(rel):
    with open(p(rel), encoding="utf-8") as f:
        return f.read()


def main():
    data = json.loads(read("data/eras.json"))
    report = []
    assets = {}

    for era in data["eras"]:
        sid, fname = era["id"], era["file"]
        src, ph = resolve(f"pano/{fname}.jpg")
        if not src:
            raise SystemExit(f"找不到第 {sid} 站全景圖，請先執行 python tools/make_placeholders.py")
        era["placeholder"] = ph
        save_resized(src, f"build/{sid}.jpg", WEB_PANO_W, 86)
        save_resized(src, f"build/{sid}_thumb.jpg", 800, 80, crop=(.2, .22, .8, .72))
        save_resized(src, f"build/{sid}_now.jpg", 1600, 84, crop=(.3, .2, .7, .7))
        era["panorama"] = f"build/{sid}.jpg"
        era["thumb"] = f"build/{sid}_thumb.jpg"

        # Codex 回報的實際線索位置
        hs_file = f"pano/hotspots_{sid}.json"
        calibrated = 0
        if exists(hs_file) and not ph:
            real = {h["id"]: h for h in json.loads(read(hs_file)).get("hotspots", [])}
            for h in era["hotspots"]:
                if h["id"] in real:
                    h["x"], h["y"] = real[h["id"]]["x"], real[h["id"]]["y"]
                    calibrated += 1
        for h in era["hotspots"]:
            h["yaw"], h["pitch"] = to_yaw_pitch(h["x"], h["y"])

        bsrc, _ = resolve(f"ui/badge_{sid}.png")
        era["badge"] = bsrc
        if exists(f"ui/badge_{sid}_locked.png"):
            era["badgeLocked"] = f"ui/badge_{sid}_locked.png"
        else:
            dst = f"build/badge_{sid}_locked.png"
            if newer(bsrc, dst):
                im = Image.open(p(bsrc)).convert("RGBA")
                g = ImageOps.grayscale(im).convert("RGBA")
                g.putalpha(im.getchannel("A"))
                g.save(p(dst))
            era["badgeLocked"] = dst

        tm = era.get("timemachine")
        if tm:
            for fr in tm["frames"]:
                if fr["img"] == "@preview":
                    fr["img"] = f"build/{sid}_now.jpg"
                    fr["placeholder"] = ph
                else:
                    r, fph = resolve(fr["img"])
                    fr["img"], fr["placeholder"] = r, fph
        report.append(f"  {sid} {era['name']}：{'示意圖' if ph else '正式圖'}"
                      + (f"，已套用 {calibrated} 個 Codex 線索位置" if calibrated else ""))

    for key, rel in [("mascot", "mascot/ahu_wave.png"), ("mascotPoint", "mascot/ahu_point.png"),
                     ("mascotMagnify", "mascot/ahu_magnify.png"), ("certBg", "cert/certificate_bg.png"),
                     ("heroMap", "ui/hero_map.jpg")]:
        r, _ = resolve(rel)
        if r:
            assets[key] = r
    assets.setdefault("mascotPoint", assets.get("mascot"))
    assets.setdefault("mascotMagnify", assets.get("mascot"))
    data["assets"] = assets
    # Codex 正式證書底圖下方有 8 個預留圓框；示意底圖沒有，就用原本的排法
    if assets.get("certBg", "").startswith("_placeholder"):
        data.pop("certLayout", None)

    eras_js = ("// data/eras.js - 由 sync_assets.py 自動產生，請改 data/eras.json 後重新執行\n"
               "window.ERAS_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n")
    with open(p("data/eras.js"), "w", encoding="utf-8") as f:
        f.write(eras_js)

    pano = {e["id"]: data_uri(e["panorama"], EMBED_PANO_W, True, 82) for e in data["eras"]}
    pano_js = ("// data/pano_data.js - 離線用全景圖（Base64），由 sync_assets.py 產生\n"
               "window.PANO_DATA = " + json.dumps(pano) + ";\n")
    with open(p("data/pano_data.js"), "w", encoding="utf-8") as f:
        f.write(pano_js)

    cert = {"bg": data_uri(assets["certBg"], 1754, True, 88), "mascot": data_uri(assets["mascot"], 512)}
    for e in data["eras"]:
        cert[e["id"]] = data_uri(e["badge"], 256)
    cert_js = ("// data/cert_data.js - 證書、吉祥物與徽章離線資源（Base64），由 sync_assets.py 產生\n"
               "window.CERT_ASSETS = " + json.dumps(cert) + ";\n")
    with open(p("data/cert_data.js"), "w", encoding="utf-8") as f:
        f.write(cert_js)

    # ---- 單檔學生獨立版：所有圖片改用內嵌 ----
    asset_map = {}
    for e in data["eras"]:
        asset_map[e["thumb"]] = data_uri(e["thumb"])
        asset_map[e["badge"]] = cert[e["id"]]
        asset_map[e["badgeLocked"]] = data_uri(e["badgeLocked"], 256)
        for fr in (e.get("timemachine") or {}).get("frames", []):
            asset_map[fr["img"]] = data_uri(fr["img"], 1200, True, 82)
    asset_map[assets["mascot"]] = cert["mascot"]
    for k in ("mascotPoint", "mascotMagnify"):
        asset_map.setdefault(assets[k], data_uri(assets[k], 512))
    asset_map[assets["heroMap"]] = data_uri(assets["heroMap"], 1280, True, 82)
    asset_js = "window.ASSET_DATA = " + json.dumps(asset_map) + ";"

    html = read("index.html")
    css = "<style>\n" + read("css/pannellum.css") + "\n" + read("css/style.css") + "\n" + read("css/landscape.css") + "\n</style>"
    for name in ("pannellum", "style", "landscape"):
        html = html.replace(f'<link rel="stylesheet" href="css/{name}.css">', "")
    html = html.replace("</head>", css + "\n</head>")

    def tag(code):
        return "<script>\n" + code.replace("</script>", "<\\/script>") + "\n</script>\n"

    bundle = (tag(read("js/pannellum.js")) + tag(eras_js) + tag(pano_js) + tag(cert_js) + tag(asset_js)
              + "".join(tag(read(f"js/{n}.js")) for n in
                        ["markdown", "storage", "audio", "viewer", "quiz", "certificate", "landscape", "app"]))
    start, end = html.index("<!-- SCRIPTS:START -->"), html.index("<!-- SCRIPTS:END -->")
    html = html[:start] + bundle + html[end + len("<!-- SCRIPTS:END -->"):]
    os.makedirs(p("dist"), exist_ok=True)
    out = p("dist", "南投家鄉景觀探險隊_學生獨立版.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)

    print("同步完成：")
    print("\n".join(report))
    print(f"  學生獨立版：dist/南投家鄉景觀探險隊_學生獨立版.html（{os.path.getsize(out) / 1e6:.1f} MB）")


if __name__ == "__main__":
    main()
