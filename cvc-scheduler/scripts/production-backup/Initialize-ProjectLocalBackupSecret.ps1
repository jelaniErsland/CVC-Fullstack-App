param(
  [string]$SecretDirectory,
  [switch]$FixtureValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepositoryRoot = (Resolve-Path (Join-Path $ScriptRoot "..\..")).Path

function Assert-WindowsOnly {
  if (-not $IsWindows) {
    throw "Project Local production backup secret setup is Windows-only because it uses current-user DPAPI."
  }
}

function Test-IsSubPath {
  param(
    [Parameter(Mandatory = $true)][string]$Child,
    [Parameter(Mandatory = $true)][string]$Parent
  )
  $childFull = [System.IO.Path]::GetFullPath($Child).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  return $childFull.Equals($parentFull, [System.StringComparison]::OrdinalIgnoreCase) -or $childFull.StartsWith($parentFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
}

function Resolve-SecretDirectory {
  param([string]$RequestedDirectory)
  if ([string]::IsNullOrWhiteSpace($RequestedDirectory)) {
    if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
      throw "LOCALAPPDATA is required for the default Project Local backup secret directory."
    }
    $RequestedDirectory = Join-Path $env:LOCALAPPDATA "ProjectLocal\ProductionBackup"
  }

  $full = [System.IO.Path]::GetFullPath($RequestedDirectory)
  if (Test-IsSubPath -Child $full -Parent $RepositoryRoot) {
    throw "Refusing to store the production backup secret inside the public application repository."
  }
  return $full
}

Assert-WindowsOnly
$resolvedSecretDirectory = Resolve-SecretDirectory -RequestedDirectory $SecretDirectory
$secretFile = Join-Path $resolvedSecretDirectory "production-db-url.dpapi.txt"

if ($FixtureValidateOnly) {
  [pscustomobject]@{
    ok = $true
    secretDirectory = "<redacted>"
    secretFile = "<redacted>"
    storage = "Windows current-user DPAPI"
  } | ConvertTo-Json -Depth 3
  return
}

Write-Host "Project Local production database connection secret setup"
Write-Host "This stores a current-Windows-user DPAPI-protected secret under LOCALAPPDATA."
Write-Host "The DPAPI file is machine/user-bound and is not the disaster-recovery decryption key."
Write-Host "This script does not create or store the age private recovery identity."
Write-Host "The secret will not be echoed, logged, returned, or validated by printing."

New-Item -ItemType Directory -Path $resolvedSecretDirectory -Force | Out-Null

$secureSecret = Read-Host "Paste the production database connection string" -AsSecureString
if ($secureSecret.Length -lt 1) {
  throw "Secret input was empty."
}

$encrypted = ConvertFrom-SecureString -SecureString $secureSecret
Set-Content -LiteralPath $secretFile -Value $encrypted -Encoding UTF8 -NoNewline

try {
  $acl = Get-Acl -LiteralPath $secretFile
  $acl.SetAccessRuleProtection($true, $false)
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, "FullControl", "Allow")
  $acl.SetAccessRule($rule)
  Set-Acl -LiteralPath $secretFile -AclObject $acl
} catch {
  Write-Warning "Could not fully restrict ACLs automatically. Review file permissions manually."
}

Write-Host "Project Local backup secret stored. The secret value was not printed."
