Set-Location -LiteralPath $PSScriptRoot
$academyNode = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $academyNode) {
    $bundledNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
    if (Test-Path -LiteralPath $bundledNode) { $academyNode = $bundledNode }
}
if (-not $academyNode) { Write-Error 'Install Node.js 24 or newer, then run this script again.'; exit 1 }
& $academyNode server.mjs
