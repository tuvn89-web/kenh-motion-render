#!/bin/sh
# Chuẩn bị máy ảo cloud cho một phiên mới: cài thư viện, tìm Chrome headless có sẵn, tạo lệnh chụp khung.
#   sh tools/may-ao.sh            (chạy ở gốc project)
# Sau đó: npx remotion still <Comp> out.png --frame=N --scale=0.5 --browser-executable=$HOME/chromium-bin/hs-gl
set -e
[ -d node_modules ] || npm ci --no-audit --no-fund
pip install --break-system-packages -q pocketsphinx opencv-python-headless numpy pillow 2>/dev/null || true
HS=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-headless-shell-linux64 2>/dev/null | head -1)
BIN="$HS/chrome-headless-shell"; [ -f "$HS/chrome-headless-shell.real" ] && BIN="$HS/chrome-headless-shell.real"
mkdir -p "$HOME/chromium-bin"
cat > "$HOME/chromium-bin/hs-gl" <<W
#!/bin/sh
exec "$BIN" --font-render-hinting=none --force-color-profile=srgb --enable-unsafe-swiftshader --ignore-gpu-blocklist "\$@"
W
chmod +x "$HOME/chromium-bin/hs-gl"
echo "OK: --browser-executable=$HOME/chromium-bin/hs-gl"
