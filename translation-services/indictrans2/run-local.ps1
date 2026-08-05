$ErrorActionPreference = "Stop"

$serviceDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceDirectory = Resolve-Path (Join-Path $serviceDirectory "..\..\..")
$python = Join-Path $workspaceDirectory ".runtime\python311\python.exe"

if (-not (Test-Path -LiteralPath $python)) {
    throw "Portable Python runtime not found at $python"
}

Set-Location -LiteralPath $serviceDirectory
& $python -m uvicorn app:app --host 127.0.0.1 --port 8091
