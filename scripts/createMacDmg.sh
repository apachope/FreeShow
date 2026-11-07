#!/bin/bash
set -euo pipefail

version="${1:?Release version is required}"
arch="${2:?Architecture is required}"
case "$arch" in
    x64) app_path="dist/mac/FreeShow.app" ;;
    arm64) app_path="dist/mac-arm64/FreeShow.app" ;;
    *) echo "Unsupported Mac architecture: $arch" >&2; exit 1 ;;
esac
if [ ! -d "$app_path" ]; then
    echo "Missing packaged application: $app_path" >&2
    exit 1
fi

image_path="$PWD/dist/FreeShow-${version}-${arch}.dmg"
zip_path="$PWD/dist/FreeShow-${version}-${arch}.zip"
workspace="$(mktemp -d "${TMPDIR:-/tmp}/freeshow-dmg.XXXXXX")"
mounted=false
cleanup() {
    if [ "$mounted" = true ]; then
        hdiutil detach "$workspace/volume" || true
    fi
    rm -rf "$workspace"
}
trap cleanup EXIT

# Create and test the ZIP independently of the vendor archive toolset as well.
ditto -c -k --sequesterRsrc --keepParent "$app_path" "$zip_path"
unzip -tq "$zip_path"

# Create the image directly with macOS tools, bypassing the vendor DMG toolset.
mkdir -p "$workspace/staging" "$workspace/volume"
ditto "$app_path" "$workspace/staging/FreeShow.app"
ln -s /Applications "$workspace/staging/Applications"
hdiutil create -ov -volname FreeShow -srcfolder "$workspace/staging" \
    -fs HFS+ -format UDZO "$image_path"

# A successful build must also produce a readable, mountable installer.
hdiutil verify "$image_path"
hdiutil attach -readonly -nobrowse -mountpoint "$workspace/volume" "$image_path"
mounted=true
test -x "$workspace/volume/FreeShow.app/Contents/MacOS/FreeShow"
test -L "$workspace/volume/Applications"
hdiutil detach "$workspace/volume"
mounted=false
echo "Verified installer: $image_path"
