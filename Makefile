.PHONY: dev dev-mobile build start lint lint-check format format-check format-lint \
        install clean clean-install test test-watch test-coverage test-ui \
        e2e e2e-headed e2e-ui e2e-journey e2e-chrome e2e-report e2e-install e2e-debug \
        tauri-dev tauri-build \
        tauri-build-macos tauri-build-macos-arm tauri-build-macos-intel \
        tauri-build-windows tauri-build-windows-arm \
        tauri-build-linux tauri-build-linux-arm \
        tauri-android-init tauri-android-dev tauri-android-build tauri-android-build-aab \
        tauri-ios-init tauri-ios-dev tauri-ios-build \
        tauri-info tauri-update tauri-clean tauri-icons \
        tauri-build-all-desktop tauri-build-all-mobile

# ============================================
# Next.js Development & Build
# ============================================

# Start the development server
dev:
	pnpm run dev

# Start dev server bound to all interfaces for mobile device access
dev-mobile:
	@LOCAL_IP=$$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost"); \
	echo "Starting dev server at http://$$LOCAL_IP:3001"; \
	echo "Run 'make tauri-ios-dev' or 'make tauri-android-dev' in another terminal"; \
	pnpm exec next dev -H 0.0.0.0 -p 3001

# Build the application for production
build:
	pnpm run build

# Start the production server
start:
	pnpm run start

# ============================================
# Code Quality
# ============================================

# Run ESLint to check for code quality issues
lint:
	pnpm run lint

# Run ESLint to check for code quality issues without fixing
lint-check:
	pnpm run lint:check

# Format code using Prettier
format:
	pnpm run format

# Check code formatting without making changes
format-check:
	pnpm run format:check

# Format and lint code in one command
format-lint:
	pnpm run format-lint

# ============================================
# Dependencies
# ============================================

# Install all dependencies
install:
	pnpm install

# Clean build artifacts and dependencies
clean:
	rm -rf node_modules
	rm -rf .next
	rm -rf dist
	rm -rf dist-electron
	rm -rf .turbo
	rm -rf playwright-report
	rm -rf test-results
	rm -rf coverage

# Clean everything and reinstall
clean-install:
	$(MAKE) clean
	$(MAKE) install

# ============================================
# Unit Tests (Vitest)
# ============================================

# Run all tests
test:
	pnpm run test

# Run all tests in watch mode
test-watch:
	pnpm run test:watch

# Run all tests in coverage mode
test-coverage:
	pnpm run test:coverage

# Run all tests in UI mode
test-ui:
	pnpm run test:ui

# ============================================
# E2E Tests (Playwright)
# ============================================

# Run all e2e tests (all browsers)
e2e:
	npx playwright test --config=e2e/playwright.config.ts

# Run e2e tests in headed mode (visible browser)
e2e-headed:
	npx playwright test --config=e2e/playwright.config.ts --headed

# Run e2e tests in UI mode (interactive)
e2e-ui:
	npx playwright test --config=e2e/playwright.config.ts --ui

# Run e2e tests for a specific journey (usage: make e2e-journey J=01)
e2e-journey:
	npx playwright test --config=e2e/playwright.config.ts e2e/journeys/$(J)-*.spec.ts

# Run e2e tests only on Chrome
e2e-chrome:
	npx playwright test --config=e2e/playwright.config.ts --project=mentor-desktop-chrome

# Run e2e tests and show the HTML report
e2e-report:
	npx playwright show-report e2e/playwright-report

# Install Playwright browsers
e2e-install:
	npx playwright install --with-deps

# Run e2e tests in debug mode
e2e-debug:
	npx playwright test --config=e2e/playwright.config.ts --debug

# ============================================
# Tauri Desktop Development
# ============================================

# Tauri development mode (runs Next.js dev server + Tauri desktop app)
tauri-dev:
	cargo tauri dev

# Build Tauri for the current platform (auto-detects OS)
tauri-build:
	cargo tauri build

# ============================================
# Tauri macOS Builds
# ============================================

# Build for macOS (Universal binary - Intel + Apple Silicon)
tauri-build-macos:
	cargo tauri build --target universal-apple-darwin

# Build for macOS Apple Silicon only
tauri-build-macos-arm:
	cargo tauri build --target aarch64-apple-darwin

# Build for macOS Intel only
tauri-build-macos-intel:
	cargo tauri build --target x86_64-apple-darwin

# ============================================
# Tauri Windows Builds
# ============================================

# Build for Windows x64
tauri-build-windows:
	cargo tauri build --target x86_64-pc-windows-msvc

# Build for Windows ARM64
tauri-build-windows-arm:
	cargo tauri build --target aarch64-pc-windows-msvc

# ============================================
# Tauri Linux Builds
# ============================================

# Build for Linux x64
tauri-build-linux:
	cargo tauri build --target x86_64-unknown-linux-gnu

# Build for Linux ARM64
tauri-build-linux-arm:
	cargo tauri build --target aarch64-unknown-linux-gnu

# ============================================
# Tauri Mobile - Android
# ============================================

# Initialize Android project (run once)
tauri-android-init:
	cargo tauri android init

# Run Android dev build (auto-detects local IP for dev server)
# Run 'make dev-mobile' first in another terminal
tauri-android-dev:
	@LOCAL_IP=$$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null); \
	if [ -z "$$LOCAL_IP" ]; then \
		echo "Error: Could not detect local IP address"; \
		exit 1; \
	fi; \
	echo "Using dev server at http://$$LOCAL_IP:3001"; \
	TAURI_DEV_URL="http://$$LOCAL_IP:3001" cargo tauri android dev \
		--config '{"build":{"devUrl":"http://'"$$LOCAL_IP"':3001","frontendDist":"http://'"$$LOCAL_IP"':3001"}}'

# Build for Android (release APK)
tauri-android-build:
	cargo tauri android build

# Build for Android (release AAB for Play Store)
tauri-android-build-aab:
	cargo tauri android build --aab

# ============================================
# Tauri Mobile - iOS (macOS only)
# ============================================

# Initialize iOS project (run once)
tauri-ios-init:
	cargo tauri ios init

# Run iOS dev build (auto-detects local IP for dev server)
# Run 'make dev-mobile' first in another terminal
tauri-ios-dev:
	@LOCAL_IP=$$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null); \
	if [ -z "$$LOCAL_IP" ]; then \
		echo "Error: Could not detect local IP address"; \
		exit 1; \
	fi; \
	echo "Using dev server at http://$$LOCAL_IP:3001"; \
	TAURI_DEV_URL="http://$$LOCAL_IP:3001" cargo tauri ios dev \
		--config '{"build":{"devUrl":"http://'"$$LOCAL_IP"':3001","frontendDist":"http://'"$$LOCAL_IP"':3001"}}'

# Build for iOS (release)
tauri-ios-build:
	cargo tauri ios build

# ============================================
# Tauri Utilities
# ============================================

# Check Tauri build dependencies and environment
tauri-info:
	cargo tauri info

# Update Tauri CLI and Cargo dependencies
tauri-update:
	cargo install tauri-cli --version "^2.0.0"
	cd src-tauri && cargo update

# Clean Tauri build artifacts
tauri-clean:
	rm -rf src-tauri/target

# Generate Tauri icons from a source image (requires 1024x1024 PNG at src-tauri/icons/app-icon.png)
tauri-icons:
	cargo tauri icon src-tauri/icons/icon.png

# ============================================
# Tauri Build All Platforms
# ============================================

# Build for all desktop platforms (run on appropriate CI runners)
tauri-build-all-desktop: tauri-build-macos tauri-build-windows tauri-build-linux
	@echo "All desktop builds completed"

# Build for all mobile platforms
tauri-build-all-mobile: tauri-android-build tauri-ios-build
	@echo "All mobile builds completed"

# ============================================
# Help
# ============================================
help:
	@echo "Available commands:"
	@echo ""
	@echo "  Development:"
	@echo "    make dev              - Start Next.js dev server"
	@echo "    make dev-mobile       - Start dev server on 0.0.0.0:3001 for mobile"
	@echo "    make build            - Build for production"
	@echo "    make start            - Start production server"
	@echo ""
	@echo "  Code Quality:"
	@echo "    make lint             - Lint and fix"
	@echo "    make lint-check       - Lint without fixing"
	@echo "    make format           - Format with Prettier"
	@echo "    make format-check     - Check formatting"
	@echo ""
	@echo "  Testing:"
	@echo "    make test             - Run unit tests"
	@echo "    make test-watch       - Run unit tests in watch mode"
	@echo "    make test-coverage    - Run unit tests with coverage"
	@echo "    make e2e              - Run all e2e tests"
	@echo "    make e2e-headed       - Run e2e tests with visible browser"
	@echo "    make e2e-ui           - Run e2e tests in interactive UI"
	@echo "    make e2e-journey J=01 - Run a specific e2e journey"
	@echo "    make e2e-chrome       - Run e2e tests on Chrome only"
	@echo "    make e2e-debug        - Run e2e tests in debug mode"
	@echo ""
	@echo "  Tauri Desktop:"
	@echo "    make tauri-dev              - Desktop dev mode with hot reload"
	@echo "    make tauri-build            - Build for current platform"
	@echo "    make tauri-build-macos      - Build macOS universal binary"
	@echo "    make tauri-build-macos-arm  - Build macOS Apple Silicon"
	@echo "    make tauri-build-macos-intel - Build macOS Intel"
	@echo "    make tauri-build-windows    - Build Windows x64"
	@echo "    make tauri-build-windows-arm - Build Windows ARM64"
	@echo "    make tauri-build-linux      - Build Linux x64"
	@echo "    make tauri-build-linux-arm  - Build Linux ARM64"
	@echo ""
	@echo "  Tauri Mobile:"
	@echo "    make tauri-ios-init         - Initialize iOS project (run once)"
	@echo "    make tauri-ios-dev          - iOS dev build (run dev-mobile first)"
	@echo "    make tauri-ios-build        - iOS release build"
	@echo "    make tauri-android-init     - Initialize Android project (run once)"
	@echo "    make tauri-android-dev      - Android dev build (run dev-mobile first)"
	@echo "    make tauri-android-build    - Android release APK"
	@echo "    make tauri-android-build-aab - Android release AAB"
	@echo ""
	@echo "  Tauri Utilities:"
	@echo "    make tauri-info       - Show build environment info"
	@echo "    make tauri-update     - Update Tauri CLI and deps"
	@echo "    make tauri-clean      - Clean Rust build artifacts"
	@echo "    make tauri-icons      - Generate icons from source image"
