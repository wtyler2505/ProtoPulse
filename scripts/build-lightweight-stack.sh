#!/bin/bash
# Description: Automated build script for a lightweight Linux userland stack.
# Target OS: Linux Mint / Ubuntu / Debian base

set -e # Exit immediately if a command exits with a non-zero status

BUILD_DIR="$HOME/src/light-stack"
mkdir -p "$BUILD_DIR"

echo "========================================================"
echo "1. Installing Build Dependencies"
echo "========================================================"
sudo apt update
sudo apt install -y \
    build-essential git meson ninja-build pkg-config \
    libx11-dev libxft-dev libxinerama-dev libxrandr-dev \
    libxss-dev libdbus-1-dev libglib2.0-dev libpango1.0-dev \
    libgtk-3-dev libxdg-basedir-dev libnotify-dev \
    libfreetype6-dev libpcre2-dev libncurses-dev libsdl2-dev liblua5.4-dev \
    maim xclip feh zathura btop

echo "========================================================"
echo "2. Compiling nnn (Terminal File Manager)"
echo "========================================================"
cd "$BUILD_DIR"
if [ ! -d "nnn" ]; then git clone https://github.com/jarun/nnn.git; fi
cd nnn
sudo make strip install

echo "========================================================"
echo "3. Compiling Lite XL (Text Editor)"
echo "========================================================"
cd "$BUILD_DIR"
if [ ! -d "lite-xl" ]; then git clone https://github.com/lite-xl/lite-xl.git; fi
cd lite-xl
git checkout v2.1.1
rm -rf build
meson setup build -Dbuildtype=release
meson compile -C build
sudo meson install -C build

echo "========================================================"
echo "4. Compiling Dunst (Notification Daemon)"
echo "========================================================"
cd "$BUILD_DIR"
if [ ! -d "dunst" ]; then git clone https://github.com/dunst-project/dunst.git; fi
cd dunst
make -j$(nproc)
sudo make install

echo "========================================================"
echo "5. Compiling dmenu (Application Launcher)"
echo "========================================================"
cd "$BUILD_DIR"
if [ ! -d "dmenu" ]; then git clone https://git.suckless.org/dmenu; fi
cd dmenu
sudo make clean install

echo "========================================================"
echo "Build and Installation Complete!"
echo "========================================================"
