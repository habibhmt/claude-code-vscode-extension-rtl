# RTL Fix for Claude Code Extension
# Supports: VSCode, Cursor, Windsurf, Windsurf Next
# Works on: Windows

param(
    [switch]$WithFont,
    [switch]$Help
)

# Show help
if ($Help) {
    Write-Host "Usage: .\fix-rtl-claude.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -WithFont    Include Vazirmatn font (for Persian/Arabic)"
    Write-Host "  -Help        Show this help message"
    exit 0
}

# RTL CSS without font
$RTL_CSS_BASE = @"
html,body{direction:rtl;text-align:right}
p:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]),span:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]),div:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]):not([class*="monaco"]),li,ul,ol,input,textarea,[contenteditable],[contenteditable="true"]{direction:rtl;text-align:right;unicode-bidi:isolate}
pre,code,[class*="diff"],[class*="Diff"],[class*="code"],[class*="Code"],[class*="monaco"],[class*="editor"]{direction:ltr!important;text-align:left!important;unicode-bidi:isolate}
"@

# RTL CSS with Vazirmatn font
$RTL_CSS_WITH_FONT = @"
*{font-family:"Vazirmatn","SF Mono",Monaco,"Courier New",monospace!important}
html,body{direction:rtl;text-align:right}
p:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]),span:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]),div:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]):not([class*="monaco"]),li,ul,ol,input,textarea,[contenteditable],[contenteditable="true"]{direction:rtl;text-align:right;unicode-bidi:isolate}
pre,code,[class*="diff"],[class*="Diff"],[class*="code"],[class*="Code"],[class*="monaco"],[class*="editor"]{direction:ltr!important;text-align:left!important;unicode-bidi:isolate}
"@

# Choose CSS based on font flag
if ($WithFont) {
    $RTL_CSS = $RTL_CSS_WITH_FONT
    Write-Host "Using Vazirmatn font" -ForegroundColor Yellow
} else {
    $RTL_CSS = $RTL_CSS_BASE
}

# Counter for patched IDEs
$patched = 0

# Function to patch an IDE
function Patch-IDE {
    param(
        [string]$IdeName,
        [string]$ExtensionsPath
    )

    # Check if extensions directory exists
    if (-not (Test-Path $ExtensionsPath)) {
        return
    }

    # Find Claude Code extension directories
    $extDirs = Get-ChildItem -Path $ExtensionsPath -Directory -Filter "anthropic.claude-code-*" -ErrorAction SilentlyContinue

    foreach ($extDir in $extDirs) {
        $webviewPath = Join-Path $extDir.FullName "webview"
        $cssFile = Join-Path $webviewPath "index.css"
        $backupFile = Join-Path $webviewPath "index.css.backup"

        if (Test-Path $cssFile) {
            # Create backup if not exists
            if (-not (Test-Path $backupFile)) {
                Copy-Item $cssFile $backupFile
            }

            # Apply RTL CSS
            $originalContent = Get-Content $backupFile -Raw -Encoding UTF8
            $newContent = $RTL_CSS + "`n" + $originalContent
            Set-Content -Path $cssFile -Value $newContent -NoNewline -Encoding UTF8

            Write-Host "[OK] " -ForegroundColor Green -NoNewline
            Write-Host "Patched ${IdeName}: $webviewPath"
            $script:patched++
        }
    }
}

Write-Host ""
Write-Host "=== RTL Fix for Claude Code Extension ==="
Write-Host ""

# Get user profile path
$userProfile = $env:USERPROFILE

# Patch all supported IDEs
Patch-IDE -IdeName "VSCode" -ExtensionsPath "$userProfile\.vscode\extensions"
Patch-IDE -IdeName "VSCode Insiders" -ExtensionsPath "$userProfile\.vscode-insiders\extensions"
Patch-IDE -IdeName "Cursor" -ExtensionsPath "$userProfile\.cursor\extensions"
Patch-IDE -IdeName "Windsurf" -ExtensionsPath "$userProfile\.windsurf\extensions"
Patch-IDE -IdeName "Windsurf Next" -ExtensionsPath "$userProfile\.windsurf-next\extensions"

Write-Host ""
if ($patched -eq 0) {
    Write-Host "No Claude Code extensions found." -ForegroundColor Red
    Write-Host "Make sure Claude Code extension is installed in your IDE."
    exit 1
} else {
    Write-Host "Patched $patched IDE(s) successfully." -ForegroundColor Green
    Write-Host ""
    Write-Host "Restart your IDE to apply changes."
}
