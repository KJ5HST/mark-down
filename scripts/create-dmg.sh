#!/bin/bash
set -euo pipefail

# Create a DMG installer for Mark Down
# Usage: ./scripts/create-dmg.sh [arch]
# arch: aarch64 (default) or x86_64

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ARCH="${1:-aarch64}"

APP_NAME="Mark Down"
APP_PATH="$PROJECT_DIR/src-tauri/target/${ARCH}-apple-darwin/release/bundle/macos/${APP_NAME}.app"
DMG_DIR="$PROJECT_DIR/src-tauri/target/${ARCH}-apple-darwin/release/bundle/dmg"
DMG_PATH="$DMG_DIR/${APP_NAME}_1.0.0_${ARCH}.dmg"
VOLUME_NAME="$APP_NAME"
BG_IMAGE="$PROJECT_DIR/src-tauri/dmg/background.png"

if [[ ! -d "$APP_PATH" ]]; then
    echo "Error: App not found at $APP_PATH"
    echo "Build the app first with: npx tauri build --target ${ARCH}-apple-darwin --bundles app"
    exit 1
fi

mkdir -p "$DMG_DIR"

# Clean up any previous mount
hdiutil detach "/Volumes/$VOLUME_NAME" 2>/dev/null || true
rm -f "$DMG_PATH"

# Create temporary DMG (read-write)
TEMP_DMG=$(mktemp -t mark-down-dmg.XXXXXX).dmg
rm -f "$TEMP_DMG"

# Calculate size needed (app size + 20MB padding)
APP_SIZE_KB=$(du -sk "$APP_PATH" | cut -f1)
DMG_SIZE_MB=$(( (APP_SIZE_KB / 1024) + 20 ))

echo "Creating temporary disk image (${DMG_SIZE_MB}MB)..."
hdiutil create -size "${DMG_SIZE_MB}m" -fs HFS+ -volname "$VOLUME_NAME" "$TEMP_DMG" -ov -quiet

echo "Mounting temporary disk image..."
DEVICE=$(hdiutil attach -readwrite -noverify -noautoopen "$TEMP_DMG" | grep '/Volumes/' | head -1 | awk '{print $1}')
MOUNT_DIR="/Volumes/$VOLUME_NAME"

echo "Copying app..."
cp -a "$APP_PATH" "$MOUNT_DIR/"

echo "Creating Applications symlink..."
ln -s /Applications "$MOUNT_DIR/Applications"

# Copy background image
# Note: macOS 26+ has a Finder bug where symlink icons render as gray boxes
# in DMGs. The background image has the Applications folder icon baked in
# as a workaround so the layout always looks correct.
if [[ -f "$BG_IMAGE" ]]; then
    echo "Setting background image..."
    mkdir -p "$MOUNT_DIR/.background"
    cp "$BG_IMAGE" "$MOUNT_DIR/.background/background.png"
fi

echo "Configuring Finder appearance..."
sleep 1

# Use AppleScript to configure the DMG window layout
osascript << 'APPLESCRIPT'
tell application "Finder"
    tell disk "Mark Down"
        open
        delay 2

        tell container window
            set current view to icon view
            set toolbar visible to false
            set statusbar visible to false
            set the bounds to {100, 100, 760, 500}
        end tell

        set opts to the icon view options of container window
        tell opts
            set icon size to 72
            set text size to 10
            set arrangement to not arranged
        end tell

        -- Set background
        try
            set background picture of opts to file ".background:background.png"
        end try

        -- Position items on top of background icons
        set position of item "Mark Down.app" to {180, 170}
        set position of item "Applications" to {480, 170}

        -- Close and reopen to save .DS_Store
        close
        delay 1
        open
        delay 1

        tell container window
            set toolbar visible to false
            set statusbar visible to false
            set the bounds to {100, 100, 760, 500}
        end tell
    end tell
end tell
APPLESCRIPT

echo "Waiting for .DS_Store..."
sleep 3

# Eject
echo "Ejecting..."
hdiutil detach "$DEVICE" -quiet

# Convert to compressed read-only DMG
echo "Creating final compressed DMG..."
hdiutil convert "$TEMP_DMG" -format UDZO -imagekey zlib-level=9 -o "$DMG_PATH" -quiet

rm -f "$TEMP_DMG"

echo "DMG created: $DMG_PATH"
