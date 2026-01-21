#!/bin/bash

# Script to generate Tauri icons from the source logo
# Requires: sips (built into macOS) and iconutil

SOURCE_IMAGE="../whales_logo.png"
ICONS_DIR="src-tauri/icons"

# Create icons directory if it doesn't exist
mkdir -p "$ICONS_DIR"

# Generate PNG icons at various sizes
sips -z 32 32 "$SOURCE_IMAGE" --out "$ICONS_DIR/32x32.png"
sips -z 128 128 "$SOURCE_IMAGE" --out "$ICONS_DIR/128x128.png"
sips -z 256 256 "$SOURCE_IMAGE" --out "$ICONS_DIR/128x128@2x.png"

# Generate iconset for macOS .icns
ICONSET_DIR="$ICONS_DIR/icon.iconset"
mkdir -p "$ICONSET_DIR"
sips -z 16 16 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16.png"
sips -z 32 32 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16@2x.png"
sips -z 32 32 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32.png"
sips -z 64 64 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32@2x.png"
sips -z 128 128 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128.png"
sips -z 256 256 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128@2x.png"
sips -z 256 256 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256.png"
sips -z 512 512 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256@2x.png"
sips -z 512 512 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_512x512.png"
sips -z 1024 1024 "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_512x512@2x.png"

# Create .icns file
iconutil -c icns "$ICONSET_DIR" -o "$ICONS_DIR/icon.icns"

# Clean up iconset folder
rm -rf "$ICONSET_DIR"

# For Windows .ico (basic conversion - for better quality use a dedicated tool)
cp "$ICONS_DIR/128x128.png" "$ICONS_DIR/icon.ico"

echo "Icons generated successfully in $ICONS_DIR"
