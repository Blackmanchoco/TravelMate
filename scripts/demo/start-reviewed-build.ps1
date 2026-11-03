# User-run only: serve the compiled reviewed build without restoring or seeding any database.
param(
  [string]$DatabaseName = 'travelmate_demo_20261006',
  [string]$SourceBackend = 'C:\FYP\travelmate\backend'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'demo-common.ps1')
$buildRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (Test-DemoPortOpen 5174) { throw 'Port 5174 is occupied. Stop your existing demo yourself before starting this build.' }
$demoBuildConnection = Get-DemoConnection -DatabaseName $DatabaseName -EnvironmentFile (Join-Path $SourceBackend '.env')
$variableNames = @('DATABASE_URL', 'PORT', 'CORS_ORIGIN', 'PYTHON_EXECUTABLE')
$previousEnvironment = @{}
foreach ($variableName in $variableNames) {
  $previousEnvironment[$variableName] = [Environment]::GetEnvironmentVariable($variableName, 'Process')
}
Push-Location -LiteralPath $SourceBackend
try {
  $env:DATABASE_URL = $demoBuildConnection.Url
  $env:PORT = '5174'
  $env:CORS_ORIGIN = 'http://127.0.0.1:5174'
  $env:PYTHON_EXECUTABLE = Join-Path $SourceBackend '.venv\Scripts\python.exe'
  & node (Join-Path $buildRoot 'scripts\demo\serve-built.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'The compiled demo process exited unsuccessfully.' }
} finally {
  Pop-Location
  foreach ($variableName in $variableNames) {
    [Environment]::SetEnvironmentVariable($variableName, $previousEnvironment[$variableName], 'Process')
  }
  $demoBuildConnection = $null
}
