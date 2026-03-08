#!/bin/bash
# Build the Quick Look preview extension for macOS
# Called by Tauri's beforeBundleCommand

set -euo pipefail

# Only build on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "Skipping Quick Look extension build (not macOS)"
    exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EXT_SRC="$PROJECT_DIR/QuickLookExtension"
BUILD_DIR="$PROJECT_DIR/src-tauri/MarkdownPreview.appex"

echo "Building Quick Look extension..."

# Determine architecture from TAURI_TARGET or default to current machine
TARGET_ARCH="${TAURI_ARCH:-$(uname -m)}"
if [[ "$TARGET_ARCH" == "aarch64" ]]; then
    SWIFT_TARGET="arm64-apple-macosx15.0"
elif [[ "$TARGET_ARCH" == "x86_64" ]]; then
    SWIFT_TARGET="x86_64-apple-macosx15.0"
else
    SWIFT_TARGET="arm64-apple-macosx15.0"
fi

# Create appex bundle structure
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/Contents/MacOS"

# Compile Swift sources
swiftc \
    "$EXT_SRC/MarkdownToHTML.swift" \
    "$EXT_SRC/PreviewViewController.swift" \
    -parse-as-library \
    -module-name "MarkdownPreview" \
    -application-extension \
    -Xlinker -e -Xlinker _NSExtensionMain \
    -target "$SWIFT_TARGET" \
    -o "$BUILD_DIR/Contents/MacOS/MarkdownPreview"

# Copy Info.plist
cp "$EXT_SRC/Info.plist" "$BUILD_DIR/Contents/Info.plist"

# Write PkgInfo
echo -n "XPC!" > "$BUILD_DIR/Contents/PkgInfo"

# Sign the extension
# In CI, APPLE_SIGNING_IDENTITY is set and the keychain is configured by tauri-action
# Locally, fall back to ad-hoc signing
if [[ -n "${APPLE_SIGNING_IDENTITY:-}" ]]; then
    echo "Signing with identity: $APPLE_SIGNING_IDENTITY"
    codesign --force --sign "$APPLE_SIGNING_IDENTITY" \
        --entitlements "$EXT_SRC/extension.entitlements" \
        --options runtime \
        --timestamp \
        "$BUILD_DIR"
else
    codesign --force --sign - \
        --entitlements "$EXT_SRC/extension.entitlements" \
        "$BUILD_DIR"
fi

echo "Quick Look extension built successfully"
