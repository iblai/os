# MSIX Build Guide for ibl.ai OS

## Overview

This guide covers building, testing, and publishing the ibl.ai OS Tauri desktop app as an MSIX package for the Microsoft Store.

Tauri v2 does not produce MSIX natively (only NSIS and MSI). The MSIX is created as a post-build step using Windows SDK tools (`makeappx.exe` + `signtool.exe`).

---

## Prerequisites

Install the following on your Windows machine:

| Tool | Purpose | Install |
|------|---------|---------|
| **Rust** | Compiles the Tauri backend | https://rustup.rs |
| **Tauri CLI** | `cargo install tauri-cli` | Builds the app |
| **Windows 10 SDK** | Provides `makeappx.exe` and `signtool.exe` | Visual Studio Installer > "Desktop development with C++" workload |
| **Node.js + pnpm** | Frontend dependencies (if needed) | https://nodejs.org |
| **Git** | Clone the repo | https://git-scm.com |

---

## Local Testing (Step by Step)

### 1. Clone and checkout

```powershell
git clone git@github.com:iblai/ibl-web-frontend.git
cd ibl-web-frontend
git checkout chore/mentor/prepare-msix-build
```

### 2. Build the Tauri app

```powershell
cargo tauri build --target x86_64-pc-windows-msvc
```

This compiles `ibl-ai-os.exe` to `apps\mentor\src-tauri\target\x86_64-pc-windows-msvc\release\`. It also produces NSIS (.exe) and MSI installers as byproducts - these can be ignored for MSIX purposes.

First build takes ~4 minutes. Subsequent builds are faster.

### 3. Create the self-signed test certificate (one-time)

Run PowerShell **as Administrator**:

```powershell
cd apps\mentor\src-tauri
.\setup-test-cert.ps1
```

This creates a certificate with `CN=iblai-test` and installs it to the Trusted People store.

**Save the thumbprint it prints** - you'll need it for signing.

### 4. Install the cert to Trusted Root (one-time)

Still as Administrator, install the cert to the Trusted Root store so Windows trusts it for MSIX installation:

```powershell
$cert = Get-ChildItem -Path "Cert:\CurrentUser\My" | Where-Object { $_.Thumbprint -eq "YOUR_THUMBPRINT" }
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
$store.Open("ReadWrite")
$store.Add($cert)
$store.Close()
```

### 5. Build and sign the MSIX

```powershell
.\build-msix.ps1 -SkipTauriBuild -CertThumbprint "YOUR_THUMBPRINT"
```

Flags:
- `-SkipTauriBuild` - skip the Tauri compile step (if you already built in step 2)
- `-CertThumbprint` - thumbprint from step 3

Output: `msix-output\ibl-ai-os-1.1.9.0-x64.msix`

### 6. Install

Double-click the `.msix` file in `msix-output\`. The Windows App Installer dialog will appear - click **Install**.

The app will appear in the Start menu as **ibl.ai OS**.

### 7. Uninstall

```powershell
Get-AppxPackage -Name ibl.ai.ibl.aiOS | Remove-AppxPackage
```

---

## Rebuilding After Code Changes

```powershell
# Rebuild the Tauri app
cargo tauri build --target x86_64-pc-windows-msvc

# Repackage and sign (no need to recreate cert)
cd apps\mentor\src-tauri
.\build-msix.ps1 -SkipTauriBuild -CertThumbprint "YOUR_THUMBPRINT"

# Uninstall old version first, then double-click new .msix
Get-AppxPackage -Name ibl.ai.ibl.aiOS | Remove-AppxPackage
```

Or do it all in one step (includes Tauri build):

```powershell
.\build-msix.ps1 -CertThumbprint "YOUR_THUMBPRINT"
```

---

## What Was Changed

### Modified Files

| File | Changes |
|------|---------|
| `tauri.conf.json` | Identifier changed from `ai.ibl.mentorai.macos` to `ai.ibl.mentorai` (platform-neutral). Added NSIS bundle target, WebView2 `downloadBootstrapper` config, timestamp URL (`digicert`), WiX language config. |
| `entitlements.mac.plist` | Updated `com.apple.application-identifier` to match new identifier. |
| `.gitignore` | Added `msix-staging/` and `msix-output/` exclusions. |

### New Files

| File | Purpose |
|------|---------|
| `AppxManifest.xml` | MSIX package manifest defining app identity, capabilities, visual elements, and deep link protocols. |
| `build-msix.ps1` | PowerShell script that stages files, runs `makeappx.exe pack`, and optionally signs with `signtool.exe`. |
| `setup-test-cert.ps1` | Creates a self-signed certificate (`CN=iblai-test`) for local testing and installs it to Trusted People store. |

---

## Key Lessons Learned

1. **Tauri doesn't produce MSIX** - it only builds NSIS and MSI. MSIX requires a separate packaging step with `makeappx.exe`.

2. **Unsigned MSIX can't contain executables** - Windows blocks `Add-AppxPackage -AllowUnsigned` for packages with `.exe` files. Desktop apps must be signed even for local testing.

3. **Publisher must exactly match cert Subject** - The `Publisher` field in `AppxManifest.xml` must be identical to the signing certificate's Subject (e.g., `CN=iblai-test`). Any mismatch causes signing to fail.

4. **Cert must be in Trusted Root** - Adding the self-signed cert to "Trusted People" store is not enough. It must also be in the "Trusted Root Certification Authorities" (`Root`) store on `LocalMachine` for the MSIX installer to accept it.

5. **MSIX manifest schema is strict about ordering** - `DeviceCapability` elements must come after all `Capability` and `rescap:Capability` elements. `Square310x310Logo` requires `Wide310x150Logo`.

6. **Use `EntryPoint="Windows.FullTrustApplication"`** - The newer `uap10:RuntimeBehavior`/`uap10:TrustLevel` attributes are not universally supported. The legacy `EntryPoint` attribute works on all Windows 10/11 versions.

7. **No em dashes in PowerShell scripts** - Unicode em dashes (`U+2014`) break PowerShell's parser. Use regular hyphens only.

8. **Tauri outputs to `src-tauri/target/`** - Not the repo root `target/` directory. Build scripts must search the correct path.

---

## Next Steps for Microsoft Store Submission

### 1. Partner Center Setup (DONE)

- [x] Enrolled in Microsoft Partner Center
- [x] Product created and app name reserved: **ibl.ai OS**
- [x] Store ID: `9MZPPXDWGWK9`
- [x] Package Identity Name: `ibl.ai.ibl.aiOS`
- [x] Publisher ID: `CN=02D69AED-8E37-4338-A36D-57B9C8A6FA57`
- [x] PFN: `ibl.ai.ibl.aiOS_zx1xbkjfpftke`
- [x] AppxManifest.xml updated with real values

### 3. Code Signing Certificate

For Store submission, you have two options:
- **Let the Store sign it** - Upload an unsigned MSIX to Partner Center and Microsoft re-signs during ingestion (simplest)
- **Sign with a trusted cert** - Purchase a code signing certificate from a CA (DigiCert, Sectigo, etc.) for sideloading outside the Store

### 4. Generate Missing Icon (DONE)

- [x] Created `Wide310x150Logo.png` (310x150 pixels)
- [x] Added to `AppxManifest.xml` DefaultTile with Square310x310Logo

### 5. Prepare Store Listing

- [ ] Screenshots (at least 1, recommended 4-8) - 1366x768 or 2560x1440
- [ ] App description (short and long)
- [ ] Privacy policy URL
- [ ] Age rating questionnaire
- [ ] Category: Education
- [ ] Pricing: Free or paid

### 6. Build the Release MSIX

```powershell
# With Partner Center values in AppxManifest.xml:
cargo tauri build --target x86_64-pc-windows-msvc
.\build-msix.ps1 -SkipTauriBuild
# Upload the unsigned .msix to Partner Center (Store will sign it)
```

### 7. Submit for Certification

- [ ] Upload the MSIX package to Partner Center
- [ ] Fill out all submission sections (properties, pricing, store listing)
- [ ] Submit for certification review (typically 1-3 business days)
- [ ] Once approved, the app goes live in the Microsoft Store

---

## Reference

- [MSIX Overview](https://learn.microsoft.com/en-us/windows/msix/overview)
- [Generate MSIX Package Components](https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-manual-conversion)
- [MakeAppx.exe Tool](https://learn.microsoft.com/en-us/windows/msix/package/create-app-package-with-makeappx-tool)
- [Sign an MSIX Package](https://learn.microsoft.com/en-us/windows/msix/package/signing-package-overview)
- [Microsoft Store Submission](https://learn.microsoft.com/en-us/windows/apps/publish/)
- [Tauri v2 Bundle Config](https://v2.tauri.app/reference/config/#bundleconfig)
