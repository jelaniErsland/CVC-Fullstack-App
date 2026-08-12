param(
  [string]$SecretDirectory,
  [switch]$FixtureValidateOnly,
  [string]$FixtureConnectionUrl,
  [switch]$FixtureAclValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepositoryRoot = (Resolve-Path (Join-Path $ScriptRoot "..\..")).Path
$ExpectedProjectRef = "wdlaauzknfggoqldolmx"
$ForbiddenStagingRef = "kfuujcfxoayukywvtaeh"
. (Join-Path $ScriptRoot "ProjectLocalProductionConnection.ps1")

function Assert-WindowsOnly {
  if ($env:OS -ne 'Windows_NT') {
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

function ConvertFrom-SecureProductionSessionPoolerUrl {
  param([Parameter(Mandatory = $true)][System.Security.SecureString]$SecureValue)

  $secretPointer = [IntPtr]::Zero
  $plainValue = $null
  try {
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    try {
      return ConvertTo-ProjectLocalProductionSessionPoolerUrl `
        -ConnectionInput $plainValue `
        -ExpectedProjectRef $ExpectedProjectRef `
        -ForbiddenStagingRef $ForbiddenStagingRef
    } catch {
      $failureCode = "validation_failed"
      if ($_.Exception.Message -match 'Production database connection validation failed: (?<code>[a-z_]+)\.') {
        $failureCode = $Matches["code"]
      }
      $diagnostics = Get-ProjectLocalProductionConnectionSafeDiagnostics `
        -ConnectionInput $plainValue `
        -ExpectedProjectRef $ExpectedProjectRef
      $safeFacts = @(
        "secure_string_character_count=$($SecureValue.Length)",
        "plaintext_character_count=$($diagnostics.plaintext_character_count)",
        "trimmed_character_count=$($diagnostics.trimmed_character_count)",
        "secure_plaintext_lengths_match=$($SecureValue.Length -eq $diagnostics.plaintext_character_count)",
        "starts_with_expected_scheme=$($diagnostics.starts_with_expected_scheme)",
        "contains_exactly_one_scheme_separator=$($diagnostics.contains_exactly_one_scheme_separator)",
        "contains_expected_username_marker=$($diagnostics.contains_expected_username_marker)",
        "contains_at_separator=$($diagnostics.contains_at_separator)",
        "contains_expected_pooler_suffix=$($diagnostics.contains_expected_pooler_suffix)",
        "contains_expected_port_marker=$($diagnostics.contains_expected_port_marker)",
        "ends_with_postgres_path=$($diagnostics.ends_with_postgres_path)",
        "contains_control_character=$($diagnostics.contains_control_character)",
        "contains_BOM=$($diagnostics.contains_BOM)",
        "contains_outer_quote=$($diagnostics.contains_outer_quote)",
        "uri_trycreate_success=$($diagnostics.uri_trycreate_success)"
      ) -join "; "
      throw [System.InvalidOperationException]::new(
        "Production database connection validation failed safely: $failureCode; $safeFacts"
      )
    }
  } finally {
    if ($secretPointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    }
    $plainValue = $null
  }
}

function New-FixtureSecureString {
  param([Parameter(Mandatory = $true)][string]$Value)
  $secureValue = New-Object System.Security.SecureString
  foreach ($character in $Value.ToCharArray()) {
    $secureValue.AppendChar($character)
  }
  $secureValue.MakeReadOnly()
  return $secureValue
}

function Test-ProjectLocalSecretAcl {
  param([Parameter(Mandatory = $true)][string]$Path)

  $currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $getAccessControl = [System.IO.File].GetMethod("GetAccessControl", [Type[]]@([string]))
  $acl = if ($null -ne $getAccessControl) {
    [System.IO.File]::GetAccessControl($Path)
  } else {
    Get-Acl -LiteralPath $Path
  }
  $ownerSid = (New-Object System.Security.Principal.NTAccount($acl.Owner)).Translate(
    [System.Security.Principal.SecurityIdentifier]
  )
  $rules = @($acl.Access)
  if (-not $acl.AreAccessRulesProtected -or $ownerSid -ne $currentSid -or $rules.Count -ne 1) {
    return $false
  }
  $rule = $rules[0]
  $ruleSid = $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier])
  return (
    $ruleSid -eq $currentSid -and
    $rule.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow -and
    -not $rule.IsInherited -and
    ($rule.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::FullControl) -eq [System.Security.AccessControl.FileSystemRights]::FullControl
  )
}

function Set-ProjectLocalSecretAcl {
  param([Parameter(Mandatory = $true)][string]$Path)

  $currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $getAccessControl = [System.IO.File].GetMethod("GetAccessControl", [Type[]]@([string]))
  $acl = if ($null -ne $getAccessControl) {
    [System.IO.File]::GetAccessControl($Path)
  } else {
    Get-Acl -LiteralPath $Path
  }
  $acl.SetOwner($currentSid)
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($existingRule in @($acl.Access)) {
    [void]$acl.RemoveAccessRuleSpecific($existingRule)
  }
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    $currentSid,
    [System.Security.AccessControl.FileSystemRights]::FullControl,
    [System.Security.AccessControl.AccessControlType]::Allow
  )
  [void]$acl.AddAccessRule($rule)
  $setAccessControl = [System.IO.File].GetMethod("SetAccessControl")
  if ($null -ne $setAccessControl) {
    [System.IO.File]::SetAccessControl($Path, $acl)
  } else {
    Set-Acl -LiteralPath $Path -AclObject $acl
  }

  if (-not (Test-ProjectLocalSecretAcl -Path $Path)) {
    throw "Production backup secret ACL verification failed."
  }
}

Assert-WindowsOnly
$resolvedSecretDirectory = Resolve-SecretDirectory -RequestedDirectory $SecretDirectory
$secretFile = Join-Path $resolvedSecretDirectory "production-db-url.dpapi.txt"

if ($FixtureAclValidateOnly) {
  $fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("project-local-secret-acl-fixture-" + [guid]::NewGuid().ToString("N"))
  try {
    New-Item -ItemType Directory -Path $fixtureRoot -Force | Out-Null
    $fixtureFile = Join-Path $fixtureRoot "fixture.dpapi.txt"
    [System.IO.File]::WriteAllText($fixtureFile, "fixture", (New-Object System.Text.UTF8Encoding($false)))
    Set-ProjectLocalSecretAcl -Path $fixtureFile
    if (-not (Test-ProjectLocalSecretAcl -Path $fixtureFile)) {
      throw "Fixture ACL verification failed."
    }
    "fixture_secret_acl_ok"
    return
  } finally {
    if (Test-Path -LiteralPath $fixtureRoot) {
      [System.IO.Directory]::Delete($fixtureRoot, $true)
    }
  }
}

if ($FixtureValidateOnly) {
  if ([string]::IsNullOrWhiteSpace($FixtureConnectionUrl)) {
    [pscustomobject]@{
      ok = $true
      secretDirectory = "<redacted>"
      secretFile = "<redacted>"
      storage = "Windows current-user DPAPI"
    } | ConvertTo-Json -Depth 3
    return
  }
}

Write-Host "Project Local production database connection secret setup"
Write-Host "This stores a current-Windows-user DPAPI-protected secret under LOCALAPPDATA."
Write-Host "The DPAPI file is machine/user-bound and is not the disaster-recovery decryption key."
Write-Host "This script does not create or store the age private recovery identity."
Write-Host "The secret will not be echoed, logged, returned, or validated by printing."

$secureSecret = if ($FixtureValidateOnly) {
  New-FixtureSecureString -Value $FixtureConnectionUrl
} else {
  Read-Host "Paste the production database connection string" -AsSecureString
}
if ($secureSecret.Length -lt 1) {
  throw "Secret input was empty."
}

try {
  $canonicalConnection = ConvertFrom-SecureProductionSessionPoolerUrl -SecureValue $secureSecret
  if ($FixtureValidateOnly) {
    [pscustomobject]@{
      ok = $true
      inputBoundary = "SecureString to BSTR to canonical URI"
      storage = "not written in fixture mode"
    } | ConvertTo-Json -Depth 3
    return
  }
  $canonicalSecureSecret = ConvertTo-SecureString -String $canonicalConnection -AsPlainText -Force
  try {
    $encrypted = ConvertFrom-SecureString -SecureString $canonicalSecureSecret
  } finally {
    $canonicalSecureSecret.Dispose()
    $canonicalConnection = $null
  }
  New-Item -ItemType Directory -Path $resolvedSecretDirectory -Force | Out-Null
  [System.IO.File]::WriteAllText(
    $secretFile,
    $encrypted,
    (New-Object System.Text.UTF8Encoding($false))
  )
} finally {
  $secureSecret.Dispose()
}

Set-ProjectLocalSecretAcl -Path $secretFile

Write-Host "Project Local backup secret stored. The secret value was not printed."
