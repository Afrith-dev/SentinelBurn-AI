<#
Render deployment helper (PowerShell)

Usage:
  1. Open PowerShell in the repo root.
  2. Run: .\scripts\deploy_render.ps1

What it does:
  - Checks for the Render CLI and suggests installing it if missing
  - Runs `render login` to authenticate (interactive)
  - Attempts to create services using `render.yaml`

Note: This script cannot set secret env vars for you. After services are created,
      visit the Render dashboard and set the required environment variables
      (JWT_SECRET, CLIENT_URL, ML_SERVICE_URL, etc.) as documented in README.md.
#>

Push-Location -Path (Split-Path -Path $MyInvocation.MyCommand.Definition -Parent) | Out-Null
Set-Location ..

Write-Host "Checking for Render CLI..."
$renderCmd = Get-Command render -ErrorAction SilentlyContinue
if (-not $renderCmd) {
    Write-Host "Render CLI not found. Install with: npm i -g @render/cli" -ForegroundColor Yellow
    Write-Host "Press Enter to attempt installation, or Ctrl+C to cancel."
    Read-Host | Out-Null
    npm i -g @render/cli
}

Write-Host "Logging into Render (interactive)..." -ForegroundColor Cyan
render login

if (-not (Test-Path render.yaml)) {
    Write-Host "render.yaml not found in repo root. Aborting." -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "Creating services from render.yaml..." -ForegroundColor Cyan
# The Render CLI supports creating services from render.yaml in some versions;
# if unavailable, follow the Render dashboard import flow.
render services create --file render.yaml

Write-Host "Done. Open Render dashboard to set secret environment variables and review service logs." -ForegroundColor Green

Pop-Location
