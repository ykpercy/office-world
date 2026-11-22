"""渲染背景音乐并编码成 MP3，写回 index.html。用法：python tools/build_music.py
依赖：pip install playwright lameenc && playwright install chromium"""
import base64, pathlib, re
import lameenc
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto((root / 'tools/render-music.html').as_uri())
    r = pg.evaluate("Music.renderLoop()"); b.close()
enc = lameenc.Encoder(); enc.set_bit_rate(80); enc.set_in_sample_rate(22050); enc.set_channels(1); enc.set_quality(2)
mp3 = bytes(enc.encode(base64.b64decode(r['b64'])) + enc.flush())
(root / 'tools/music-preview.mp3').write_bytes(mp3)              # 可直接下载试听（含约 17 秒的前奏部分）
idx = root / 'index.html'; html = idx.read_text(encoding='utf-8')
b64 = base64.b64encode(mp3).decode()
html, n1 = re.subn(r"const MUSIC_B64='[A-Za-z0-9+/=]*';", lambda m: "const MUSIC_B64='" + b64 + "';", html)
loop = "const MUSIC_LOOP=[%.4f,%.4f];" % (r['loopStart'], r['loopEnd'])
html, n2 = re.subn(r"const MUSIC_LOOP=\[[^\]]*\];", lambda m: loop, html)
assert n1 == 1 and n2 == 1, '没找到占位'
idx.write_text(html, encoding='utf-8')
print(f"{loop}  峰值 {r['peak']:.3f}  MP3 {len(mp3)/1024:.0f} KB  index.html {len(html)/1024:.0f} KB")
