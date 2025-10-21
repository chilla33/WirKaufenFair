<#
This PowerShell script moves common root files (if present) into the repo folder.
Run from an elevated PowerShell prompt if needed.
#>

$repo = Join-Path $env:SystemDrive 'GIT\WirkaufenFair'
if (-not (Test-Path $repo)) {
    Write-Error "Repo path $repo not found. Adjust the script to your repo location."
    exit 1
}

$filesToMove = @('C:\GOAL.md','C:\ETHICS.md','C:\privacy.md')
foreach ($f in $filesToMove) {
    if (Test-Path $f) {
        $dest = Join-Path $repo ([IO.Path]::GetFileName($f))
        Write-Output "Moving $f -> $dest"
        Move-Item -Path $f -Destination $dest -Force
    } else {
        Write-Output "Not found: $f"
    }
}

Write-Output "Done. Check $repo for moved files."
