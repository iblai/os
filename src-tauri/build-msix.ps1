# build-msix.ps1
# Builds the Tauri app and packages it as MSIX for Microsoft Store submission.
#
# Prerequisites:
#   - Windows 10 SDK (for makeappx.exe and signtool.exe)
#   - Rust toolchain with appropriate target
#   - Tauri CLI: cargo install tauri-cli
#
# Usage:
#   .\build-msix.ps1                                    # Build unsigned MSIX for x64
#   .\build-msix.ps1 -Architecture arm64                # Build unsigned MSIX for arm64
#   .\build-msix.ps1 -CertThumbprint "ABC123"           # Build and sign with certificate
#   .\build-msix.ps1 -SkipTauriBuild                    # Skip Tauri build, just repackage
#   .\build-msix.ps1 -SkipTauriBuild -Architecture arm64 # Repackage arm64 build
#   .\build-msix.ps1 -RegisterOnly                      # Skip packaging, register loose files for testing

param(
    [string]$CertThumbprint = "",
    [string]$TimestampUrl = "http://timestamp.digicert.com",
    [ValidateSet("x64", "arm64")]
    [string]$Architecture = "x64",
    [switch]$SkipTauriBuild,
    [switch]$RegisterOnly
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\.."
$TauriDir = $ScriptDir
$AppName = "ibl-ai-os"

# Map Architecture to Rust target triple
$RustTargetMap = @{
    "x64"   = "x86_64-pc-windows-msvc"
    "arm64" = "aarch64-pc-windows-msvc"
}
$RustTarget = $RustTargetMap[$Architecture]

# Map Architecture to MSIX ProcessorArchitecture value
$MsixArchMap = @{
    "x64"   = "x64"
    "arm64" = "arm64"
}
$MsixArch = $MsixArchMap[$Architecture]

# --- Step 1: Build the Tauri app ---
if (-not $SkipTauriBuild -and -not $RegisterOnly) {
    Write-Host "`n[1/4] Building Tauri app for $RustTarget..." -ForegroundColor Yellow
    Push-Location $ProjectRoot
    try {
        cargo tauri build --target $RustTarget
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`n[1/4] Skipping Tauri build." -ForegroundColor DarkYellow
}

# Locate the built executable - search architecture-specific paths first, then generic
$BuildOutput = $null
$ExePath = $null
$SearchPaths = @(
    (Join-Path $TauriDir "target\$RustTarget\release"),
    (Join-Path $TauriDir "target\release"),
    (Join-Path $ProjectRoot "target\$RustTarget\release"),
    (Join-Path $ProjectRoot "target\release")
)

Write-Host "Searching for $AppName.exe (arch=$Architecture, target=$RustTarget)..." -ForegroundColor Gray
foreach ($candidate in $SearchPaths) {
    $candidateExe = Join-Path $candidate "$AppName.exe"
    Write-Host "  Checking: $candidateExe" -ForegroundColor Gray
    if (Test-Path $candidateExe) {
        $BuildOutput = $candidate
        $ExePath = $candidateExe
        break
    }
}

if (-not $ExePath) {
    Write-Error "Built executable not found. Searched:`n  $($SearchPaths -join "`n  ")`nRun 'cargo tauri build --target $RustTarget' first."
    exit 1
}

Write-Host "Found executable: $ExePath" -ForegroundColor Green

# --- RegisterOnly: loose file registration (fastest for testing) ---
if ($RegisterOnly) {
    Write-Host "`n--- Register Only Mode ---" -ForegroundColor Cyan
    Write-Host "Staging loose files and registering with Add-AppxPackage -Register..." -ForegroundColor Yellow

    $StagingDir = Join-Path $TauriDir "msix-staging"
    if (Test-Path $StagingDir) {
        # Unregister previous if exists
        try {
            Get-AppxPackage -Name "ibl.ai.ibl.aiOS" | Remove-AppxPackage -ErrorAction SilentlyContinue
        } catch {}
        Remove-Item -Recurse -Force $StagingDir
    }
    New-Item -ItemType Directory -Path $StagingDir | Out-Null

    # Copy executable
    Copy-Item $ExePath $StagingDir

    # Copy AppxManifest
    Copy-Item (Join-Path $TauriDir "AppxManifest.xml") $StagingDir

    # Copy icons
    $IconsDestDir = Join-Path $StagingDir "icons"
    New-Item -ItemType Directory -Path $IconsDestDir | Out-Null
    $IconsSrcDir = Join-Path $TauriDir "icons"
    foreach ($icon in @("StoreLogo.png", "Square44x44Logo.png", "Square71x71Logo.png", "Square150x150Logo.png", "Square310x310Logo.png")) {
        $src = Join-Path $IconsSrcDir $icon
        if (Test-Path $src) { Copy-Item $src $IconsDestDir }
    }

    # Copy WebView2 loader if present
    $WebView2Loader = Join-Path $BuildOutput "WebView2Loader.dll"
    if (Test-Path $WebView2Loader) { Copy-Item $WebView2Loader $StagingDir }

    $ManifestPath = Join-Path $StagingDir "AppxManifest.xml"
    Write-Host "Registering: $ManifestPath" -ForegroundColor Gray

    Add-AppxPackage -Register $ManifestPath

    Write-Host "`nApp registered! Look for 'ibl.ai OS' in your Start menu." -ForegroundColor Green
    Write-Host 'To unregister: Get-AppxPackage -Name ibl.ai.ibl.aiOS | Remove-AppxPackage' -ForegroundColor Gray
    exit 0
}

# --- Resolve Windows SDK tools ---
$SdkRoot = "C:\Program Files (x86)\Windows Kits\10\bin"
if (-not (Test-Path $SdkRoot)) {
    # ARM64 runners may have the SDK in Program Files instead
    $SdkRoot = "C:\Program Files\Windows Kits\10\bin"
}
$SdkVersions = Get-ChildItem -Path $SdkRoot -Directory | Where-Object { $_.Name -match "^10\." } | Sort-Object Name -Descending
if ($SdkVersions.Count -eq 0) {
    Write-Error "Windows 10 SDK not found. Install it from https://developer.microsoft.com/windows/downloads/windows-sdk/"
    exit 1
}

# SDK tools are available in x64 and arm64 subdirectories.
# Try the matching architecture first, then fall back to x64 (which works via emulation on ARM).
$SdkToolArch = $Architecture
$SdkBin = Join-Path $SdkVersions[0].FullName $SdkToolArch
if (-not (Test-Path $SdkBin)) {
    Write-Host "SDK tools not found for $SdkToolArch, falling back to x64..." -ForegroundColor DarkYellow
    $SdkToolArch = "x64"
    $SdkBin = Join-Path $SdkVersions[0].FullName $SdkToolArch
}
$MakeAppx = Join-Path $SdkBin "makeappx.exe"
$SignTool = Join-Path $SdkBin "signtool.exe"

if (-not (Test-Path $MakeAppx)) {
    Write-Error "makeappx.exe not found at $MakeAppx"
    exit 1
}

Write-Host "Using Windows SDK: $($SdkVersions[0].Name) ($SdkToolArch tools)" -ForegroundColor Cyan
Write-Host "makeappx: $MakeAppx" -ForegroundColor Gray
Write-Host "signtool: $SignTool" -ForegroundColor Gray

# --- Step 2: Stage MSIX content ---
Write-Host "`n[2/4] Staging MSIX package content..." -ForegroundColor Yellow

$StagingDir = Join-Path $TauriDir "msix-staging"
if (Test-Path $StagingDir) {
    Remove-Item -Recurse -Force $StagingDir
}
New-Item -ItemType Directory -Path $StagingDir | Out-Null

# Copy executable
Copy-Item $ExePath $StagingDir

# Copy AppxManifest and patch ProcessorArchitecture for the target
$ManifestSrc = Join-Path $TauriDir "AppxManifest.xml"
$ManifestDest = Join-Path $StagingDir "AppxManifest.xml"
$manifestContent = Get-Content $ManifestSrc -Raw
$manifestContent = $manifestContent -replace 'ProcessorArchitecture="[^"]*"', "ProcessorArchitecture=`"$MsixArch`""
Set-Content -Path $ManifestDest -Value $manifestContent

Write-Host "Set ProcessorArchitecture=$MsixArch in AppxManifest.xml" -ForegroundColor Gray

# Copy icons
$IconsDestDir = Join-Path $StagingDir "icons"
New-Item -ItemType Directory -Path $IconsDestDir | Out-Null

$RequiredIcons = @(
    "StoreLogo.png",
    "Square44x44Logo.png",
    "Square71x71Logo.png",
    "Square150x150Logo.png",
    "Square310x310Logo.png",
    "Wide310x150Logo.png"
)

$IconsSrcDir = Join-Path $TauriDir "icons"
foreach ($icon in $RequiredIcons) {
    $src = Join-Path $IconsSrcDir $icon
    if (Test-Path $src) {
        Copy-Item $src $IconsDestDir
    } else {
        Write-Warning "Missing icon: $icon"
    }
}

# Copy WebView2 loader if present
$WebView2Loader = Join-Path $BuildOutput "WebView2Loader.dll"
if (Test-Path $WebView2Loader) {
    Copy-Item $WebView2Loader $StagingDir
}

# Copy any sidecar binaries / resources from the Tauri bundle output
$BundleResourceDir = Join-Path $BuildOutput "bundle\nsis"
if (Test-Path $BundleResourceDir) {
    $resources = Get-ChildItem -Path $BundleResourceDir -File -Exclude "*.nsis", "*.nsh", "*.exe"
    foreach ($res in $resources) {
        Copy-Item $res.FullName $StagingDir
    }
}

Write-Host "Staged files:" -ForegroundColor Gray
Get-ChildItem -Recurse $StagingDir | ForEach-Object {
    Write-Host "  $($_.FullName.Replace($StagingDir, '.'))" -ForegroundColor Gray
}

# --- Step 3: Create MSIX package ---
Write-Host "`n[3/4] Creating MSIX package..." -ForegroundColor Yellow

$OutputDir = Join-Path $TauriDir "msix-output"
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

# Read version from staged AppxManifest (which has the correct arch already)
[xml]$manifest = Get-Content $ManifestDest
$Version = $manifest.Package.Identity.Version
$MsixPath = Join-Path $OutputDir "$AppName-$Version-$Architecture.msix"

& $MakeAppx pack /d $StagingDir /p $MsixPath /o

if ($LASTEXITCODE -ne 0) {
    Write-Error "makeappx pack failed with exit code $LASTEXITCODE"
    exit 1
}

Write-Host "MSIX package created: $MsixPath" -ForegroundColor Green

# --- Step 4: Sign the package (optional) ---
if ($CertThumbprint) {
    Write-Host "`n[4/4] Signing MSIX package..." -ForegroundColor Yellow
    & $SignTool sign /fd SHA256 /sha1 $CertThumbprint /td SHA256 /tr $TimestampUrl $MsixPath

    if ($LASTEXITCODE -ne 0) {
        Write-Error "signtool sign failed with exit code $LASTEXITCODE"
        exit 1
    }

    Write-Host "Package signed successfully." -ForegroundColor Green
} else {
    Write-Host "`n[4/4] Skipping signing (no -CertThumbprint provided)." -ForegroundColor DarkYellow
    Write-Host "  Package is unsigned - use one of these to install:" -ForegroundColor Gray
    $win11Cmd = '    Windows 11:  Add-AppxPackage -AllowUnsigned -Path ' + $MsixPath
    Write-Host $win11Cmd -ForegroundColor White
    Write-Host '    Windows 10:  Sign first with .\build-msix.ps1 -CertThumbprint THUMBPRINT -SkipTauriBuild' -ForegroundColor White
}

# --- Cleanup ---
Remove-Item -Recurse -Force $StagingDir

# --- Summary ---
Write-Host "`n--- Build Complete ---" -ForegroundColor Cyan
Write-Host "MSIX Package: $MsixPath" -ForegroundColor White
Write-Host "Architecture: $Architecture ($RustTarget)" -ForegroundColor White
Write-Host ""
Write-Host "Install options:" -ForegroundColor Yellow
$installCmd = '  Unsigned (Win11):  Add-AppxPackage -AllowUnsigned -Path ' + $MsixPath
Write-Host $installCmd -ForegroundColor White
Write-Host '  Signed:            Double-click the .msix file' -ForegroundColor White
Write-Host '  Uninstall:         Get-AppxPackage -Name ibl.ai.ibl.aiOS | Remove-AppxPackage' -ForegroundColor White
