param(
  [switch]$FixtureMode,
  [ValidateSet("GuardProductionTarget", "GuardStagingTarget", "GuardNonLoopback", "GuardMissingExecute", "GuardPrivateIdentityInRepo", "GuardPrivateIdentityInBackupDestination", "GuardMalformedArtifact", "GuardUnexpectedArchiveMember", "GuardPathTraversalArchiveMember", "ChecksumAndCleanup", "CommandPlan", "ManagedRolePlan", "UserRolePlan", "UnsupportedRoleStatement", "RolePlanFailureCleanup")]
  [string]$FixtureScenario,
  [switch]$ExecuteLocalRestore,
  [switch]$VerifyExistingLocalRestore,
  [switch]$InspectRolesOnly,
  [switch]$UseSupabaseLocalDefaults,
  [string]$EncryptedBackupPath,
  [string]$ExpectedSha256,
  [string]$AgeIdentityPath,
  [string]$BackupDestinationRoot,
  [string]$TargetHost,
  [ValidateRange(1, 65535)]
  [int]$TargetPort = 54322,
  [string]$TargetDatabase = "postgres",
  [string]$TargetUser = "postgres",
  [string]$ExpectedMigration = "20260714122230",
  [string]$SupabaseWorkdir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepositoryRoot = (Resolve-Path (Join-Path $ScriptRoot "..\..")).Path
$ProductionRef = "wdlaauzknfggoqldolmx"
$StagingRef = "kfuujcfxoayukywvtaeh"
$ApprovedPackageFiles = @(
  "roles.sql",
  "schema.sql",
  "data.sql",
  "supabase_migrations_schema.sql",
  "supabase_migrations_data.sql",
  "manifest.json"
)
$RestoreOrder = @(
  "roles.sql",
  "schema.sql",
  "supabase_migrations_schema.sql",
  "supabase_migrations_data.sql",
  "data.sql"
)
$ProjectLocalTables = @(
  "workspaces",
  "project_contacts",
  "workspace_contact_grants",
  "questionnaire_submissions",
  "volunteer_profiles",
  "task_presets",
  "calendar_items",
  "calendar_assignments",
  "assignment_responses",
  "assignment_response_tokens",
  "assignment_response_link_reveal_events",
  "volunteer_schedule_access_tokens",
  "assignment_notification_deliveries"
)
$ExpectedForceRlsTables = @(
  "workspaces",
  "project_contacts",
  "workspace_contact_grants",
  "assignment_notification_deliveries"
)
$ExpectedMigrationHistory = @(
  "20260701000000",
  "20260701010000",
  "20260701020000",
  "20260701030000",
  "20260701040000",
  "20260701050000",
  "20260701060000",
  "20260701070000",
  "20260702000000",
  "20260703000000",
  "20260704000000",
  "20260705000000",
  "20260714121500",
  "20260714121600",
  "20260714121700",
  "20260714121800",
  "20260714121900",
  "20260714122000",
  "20260714122100",
  "20260714122200",
  "20260714122210",
  "20260714122220",
  "20260714122230"
)
$ExpectedBaselineFunctions = @(
  "archive_calendar_item",
  "archive_task_preset",
  "calendar_assignment_response_start_at",
  "calendar_custom_values_are_valid",
  "cancel_calendar_assignment",
  "claim_initial_assignment_notification_deliveries",
  "confirm_all_volunteer_schedule_assignments",
  "convert_questionnaire_submission_to_volunteer_profile",
  "create_calendar_assignment",
  "create_calendar_assignments_batch",
  "create_calendar_item",
  "create_manual_volunteer_profile",
  "create_task_preset",
  "finalize_initial_assignment_notification_delivery",
  "issue_assignment_response_token",
  "issue_volunteer_schedule_access",
  "publish_calendar_item",
  "read_assignment_detail_context",
  "read_assignment_response_by_token",
  "read_initial_assignment_notification_summaries",
  "read_volunteer_schedule",
  "record_assignment_response_link_reveal_event",
  "replace_assignment_response_token",
  "response_link_reveal_metadata_is_valid",
  "reveal_assignment_response_link",
  "revoke_assignment_response_token",
  "revoke_volunteer_schedule_access",
  "submit_assignment_response_by_token",
  "submit_questionnaire_submission",
  "submit_volunteer_schedule_assignment_response",
  "task_custom_field_definitions_are_valid",
  "update_assignment_response",
  "update_calendar_item_one_off_timed",
  "update_calendar_item_preset_timed",
  "update_volunteer_profile_manual_fields"
)
$ProductionBaselineTypesCommit = "2ebe35912ae3ff203b249d92d8914a8af73bd9ca"
$ProductionBaselineTypesGitPath = "cvc-scheduler/lib/supabase/database.types.ts"
. (Join-Path $ScriptRoot "ProjectLocalRoleRestore.ps1")

function Test-IsSubPath {
  param([string]$Child, [string]$Parent)
  $childFull = [System.IO.Path]::GetFullPath($Child).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  return $childFull.Equals($parentFull, [System.StringComparison]::OrdinalIgnoreCase) -or $childFull.StartsWith($parentFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
}

function Assert-OutsidePath {
  param([string]$Path, [string]$Parent, [string]$Label)
  if ([string]::IsNullOrWhiteSpace($Path) -or [string]::IsNullOrWhiteSpace($Parent)) { return }
  if (Test-IsSubPath -Child $Path -Parent $Parent) {
    throw "Refusing $Label inside $Parent."
  }
}

function Assert-OutsideRepository {
  param([string]$Path, [string]$Label)
  Assert-OutsidePath -Path $Path -Parent $RepositoryRoot -Label "$Label inside the public application repository"
}

function Assert-SafeConnectionName {
  param([string]$Value, [string]$Label)
  if ([string]::IsNullOrWhiteSpace($Value) -or $Value.Length -gt 63 -or $Value -notmatch "^[A-Za-z0-9_][A-Za-z0-9_.-]*$") {
    throw "Restore $Label is malformed."
  }
}

function Assert-LoopbackHost {
  param([string]$HostName)
  if ([string]::IsNullOrWhiteSpace($HostName)) { throw "Restore target host is required." }
  if ($HostName -match $ProductionRef -or $HostName -match $StagingRef -or $HostName -match "projectlocal\.app|supabase\.co") {
    throw "Refusing production, staging, or hosted restore target."
  }
  if ($HostName -notin @("localhost", "127.0.0.1", "::1", "[::1]")) {
    throw "Refusing non-loopback restore target without a future reviewed opt-in."
  }
  if ($HostName -eq "localhost") {
    $addresses = [System.Net.Dns]::GetHostAddresses($HostName)
    foreach ($address in $addresses) {
      if (-not [System.Net.IPAddress]::IsLoopback($address)) {
        throw "Restore target host must resolve only to loopback addresses."
      }
    }
  }
}

function Get-TargetPsqlArguments {
  param([string]$HostName, [int]$Port, [string]$DatabaseName, [string]$UserName)
  Assert-LoopbackHost -HostName $HostName
  Assert-SafeConnectionName -Value $DatabaseName -Label "database name"
  Assert-SafeConnectionName -Value $UserName -Label "user name"
  return @("-h", $HostName, "-p", ([string]$Port), "-U", $UserName, "-d", $DatabaseName)
}

function Assert-SupabaseLocalDefaultsTarget {
  if (
    $TargetHost -cne "127.0.0.1" -or
    $TargetPort -ne 54322 -or
    $TargetDatabase -cne "postgres" -or
    $TargetUser -cne "postgres"
  ) {
    throw "Standard disposable Supabase credentials require the exact 127.0.0.1:54322 postgres target."
  }
}

function ConvertTo-NativeArgumentString {
  param([string[]]$ArgumentList)
  return (($ArgumentList | ForEach-Object {
    $arg = [string]$_
    if ($arg -eq "") {
      '""'
    } elseif ($arg -notmatch '[\s"]') {
      $arg
    } else {
      '"' + $arg.Replace('\', '\\').Replace('"', '\"') + '"'
    }
  }) -join " ")
}

function Invoke-CheckedProcess {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$WorkingDirectory,
    [string]$SafeFailureCode,
    [string]$StdoutPath = $null,
    [System.Security.SecureString]$ChildScopedSecret = $null
  )

  $stderrPath = Join-Path $WorkingDirectory ("stderr-" + [guid]::NewGuid().ToString("N") + ".log")
  $stdoutTarget = $StdoutPath
  if ([string]::IsNullOrWhiteSpace($stdoutTarget)) {
    $stdoutTarget = Join-Path $WorkingDirectory ("stdout-" + [guid]::NewGuid().ToString("N") + ".log")
  }

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $FilePath
  $startInfo.Arguments = ConvertTo-NativeArgumentString -ArgumentList $ArgumentList
  $startInfo.WorkingDirectory = $WorkingDirectory
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $passwordPtr = [IntPtr]::Zero
  $plainPassword = $null
  try {
    if ($null -ne $ChildScopedSecret) {
      $passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ChildScopedSecret)
      $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
      $startInfo.EnvironmentVariables["PGPASSWORD"] = $plainPassword
    }

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    Set-Content -LiteralPath $stdoutTarget -Value $stdout -Encoding UTF8
    Set-Content -LiteralPath $stderrPath -Value $stderr -Encoding UTF8
    if ($process.ExitCode -ne 0) {
      throw "Restore subprocess failed at $SafeFailureCode."
    }
  } finally {
    if ($startInfo.EnvironmentVariables.ContainsKey("PGPASSWORD")) {
      $startInfo.EnvironmentVariables.Remove("PGPASSWORD")
    }
    if ($passwordPtr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
    }
    $plainPassword = $null
  }
}

function Get-Sha256Hex {
  param([Parameter(Mandatory = $true)][string]$Path)
  $stream = [System.IO.File]::OpenRead($Path)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace("-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
    $stream.Dispose()
  }
}

function Assert-ApprovedArchiveMembers {
  param([string]$ArchivePath)

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
  try {
    $members = @()
    foreach ($entry in $zip.Entries) {
      $name = $entry.FullName
      if ([string]::IsNullOrWhiteSpace($name) -or $name.EndsWith("/") -or $name.EndsWith("\")) {
        throw "Backup package contains unexpected directory entry."
      }
      if ($name -match '(^|[\\/])\.\.([\\/]|$)' -or $name -match '^[\\/]+' -or $name -match ':' -or $name -match '[\\/]') {
        throw "Backup package contains an unsafe path."
      }
      $members += $name
    }
    $expected = @($ApprovedPackageFiles | Sort-Object)
    $actual = @($members | Sort-Object)
    if (($actual -join "|") -ne ($expected -join "|")) {
      throw "Backup package contains unexpected files."
    }
  } finally {
    $zip.Dispose()
  }
}

function New-FixtureZip {
  param([string]$ArchivePath, [string[]]$EntryNames)
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (Test-Path -LiteralPath $ArchivePath) { Remove-Item -LiteralPath $ArchivePath -Force }
  $zip = [System.IO.Compression.ZipFile]::Open($ArchivePath, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($name in $EntryNames) {
      $entry = $zip.CreateEntry($name)
      $writer = New-Object System.IO.StreamWriter($entry.Open())
      try { $writer.Write("-- fixture") } finally { $writer.Dispose() }
    }
  } finally {
    $zip.Dispose()
  }
}

function Invoke-ScalarQuery {
  param([string]$PsqlPath, [string[]]$TargetArguments, [string]$Sql, [string]$WorkingDirectory, [string]$SafeFailureCode, [System.Security.SecureString]$ChildScopedSecret)
  $outPath = Join-Path $WorkingDirectory ("query-" + [guid]::NewGuid().ToString("N") + ".txt")
  Invoke-CheckedProcess -FilePath $PsqlPath -WorkingDirectory $WorkingDirectory -SafeFailureCode $SafeFailureCode -StdoutPath $outPath -ChildScopedSecret $ChildScopedSecret -ArgumentList (@("--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1") + $TargetArguments + @("-c", $Sql))
  return (Get-Content -LiteralPath $outPath -Raw).Trim()
}

function ConvertTo-ProjectLocalSqlLiteralList {
  param([Parameter(Mandatory = $true)][string[]]$Values)
  return ($Values | ForEach-Object { "'" + $_.Replace("'", "''") + "'" }) -join ","
}

function Get-ProjectLocalLogicalBackupCoverage {
  param([Parameter(Mandatory = $true)][string]$ExtractRoot)

  $schemaSql = [System.IO.File]::ReadAllText((Join-Path $ExtractRoot "schema.sql"))
  $dataSql = [System.IO.File]::ReadAllText((Join-Path $ExtractRoot "data.sql"))
  $authObjectPattern = '(?im)^\s*(?:CREATE\s+(?:TABLE|SEQUENCE)|COPY|INSERT\s+INTO)\s+(?:"auth"|auth)\s*\.'
  $storageObjectPattern = '(?im)^\s*(?:CREATE\s+(?:TABLE|SEQUENCE)|COPY|INSERT\s+INTO)\s+(?:"storage"|storage)\s*\.'
  return [ordered]@{
    auth_schema_or_data_represented = [regex]::IsMatch($schemaSql, $authObjectPattern) -or [regex]::IsMatch($dataSql, $authObjectPattern)
    storage_metadata_represented = [regex]::IsMatch($schemaSql, $storageObjectPattern) -or [regex]::IsMatch($dataSql, $storageObjectPattern)
    auth_platform_configuration_represented = $false
    storage_object_blobs_represented = $false
  }
}

function Get-NormalizedProjectLocalGeneratedTypes {
  param([Parameter(Mandatory = $true)][string]$Path)
  $source = [System.IO.File]::ReadAllText($Path).Replace("`r`n", "`n")
  $source = [regex]::Replace(
    $source,
    "\n\s*// Allows to automatically instantiate createClient with right options\s*\n\s*// instead of createClient<Database, \{ PostgrestVersion: 'XX' \}>\(URL, KEY\)\s*(?=\n\s*__InternalSupabase:)",
    "",
    [System.Text.RegularExpressions.RegexOptions]::Multiline
  )
  $source = [regex]::Replace(
    $source,
    '\n\s*__InternalSupabase:\s*\{\s*\n\s*PostgrestVersion:\s*"[^"]+"\s*\n\s*\}\s*(?=\n\s*public:)',
    "",
    [System.Text.RegularExpressions.RegexOptions]::Multiline
  )
  return $source.Trim()
}

function Invoke-FixtureScenario {
  $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("project-local-restore-fixture-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
  try {
    switch ($FixtureScenario) {
      "GuardProductionTarget" { [void](Get-TargetPsqlArguments -HostName $ProductionRef -Port 54322 -DatabaseName "postgres" -UserName "postgres") }
      "GuardStagingTarget" { [void](Get-TargetPsqlArguments -HostName $StagingRef -Port 54322 -DatabaseName "postgres" -UserName "postgres") }
      "GuardNonLoopback" { [void](Get-TargetPsqlArguments -HostName "example.invalid" -Port 54322 -DatabaseName "postgres" -UserName "postgres") }
      "GuardMissingExecute" {
        if (-not $ExecuteLocalRestore) { throw "Local restore execution requires -ExecuteLocalRestore." }
      }
      "GuardPrivateIdentityInRepo" {
        Assert-OutsideRepository -Path (Join-Path $RepositoryRoot "fixture-age-identity.txt") -Label "age private identity"
      }
      "GuardPrivateIdentityInBackupDestination" {
        $destination = Join-Path $tempRoot "backups"
        $identity = Join-Path $destination "identity.txt"
        New-Item -ItemType Directory -Path $destination -Force | Out-Null
        Assert-OutsidePath -Path $identity -Parent $destination -Label "age private identity inside the backup destination"
      }
      "GuardMalformedArtifact" {
        $artifact = Join-Path $tempRoot "bad.age"
        Set-Content -LiteralPath $artifact -Value "not-age" -Encoding UTF8
        $header = Get-Content -LiteralPath $artifact -TotalCount 1
        if ($header -notlike "age-encryption.org/v1*") { throw "malformed encrypted artifact refused" }
      }
      "GuardUnexpectedArchiveMember" {
        $archive = Join-Path $tempRoot "unexpected.zip"
        New-FixtureZip -ArchivePath $archive -EntryNames ($ApprovedPackageFiles + @("extra.sql"))
        Assert-ApprovedArchiveMembers -ArchivePath $archive
      }
      "GuardPathTraversalArchiveMember" {
        $archive = Join-Path $tempRoot "traversal.zip"
        New-FixtureZip -ArchivePath $archive -EntryNames ($ApprovedPackageFiles + @("../evil.sql"))
        Assert-ApprovedArchiveMembers -ArchivePath $archive
      }
      "ChecksumAndCleanup" {
        $artifact = Join-Path $tempRoot "fixture.age"
        Set-Content -LiteralPath $artifact -Value "age-encryption.org/v1`nfixture" -Encoding UTF8
        $hash = Get-Sha256Hex -Path $artifact
        if ($hash.Length -ne 64) { throw "bad_hash" }
        $decrypt = Join-Path $tempRoot "decrypt"
        New-Item -ItemType Directory -Path $decrypt -Force | Out-Null
        try {
          Set-Content -LiteralPath (Join-Path $decrypt "schema.sql") -Value "plaintext fixture" -Encoding UTF8
        } finally {
          Remove-Item -LiteralPath $decrypt -Recurse -Force
        }
        if (Test-Path -LiteralPath $decrypt) { throw "decrypted_cleanup_failed" }
        "fixture_checksum_cleanup_ok"
        return
      }
      "CommandPlan" {
        $commands = @(
          "psql --single-transaction --set ON_ERROR_STOP=1 -f roles.sql",
          "psql --single-transaction --set ON_ERROR_STOP=1 -f schema.sql",
          "psql --single-transaction --set ON_ERROR_STOP=1 -f supabase_migrations_schema.sql",
          "psql --single-transaction --set ON_ERROR_STOP=1 -f supabase_migrations_data.sql",
          "psql --single-transaction --set ON_ERROR_STOP=1 -f data.sql"
        )
        $commands | ConvertTo-Json
        return
      }
      "ManagedRolePlan" {
        $rolesPath = Join-Path $tempRoot "roles.sql"
        $derivedPath = Join-Path $tempRoot "roles-restore.sql"
        $fixtureSql = @"
SET default_transaction_read_only = off;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
RESET ALL;
CREATE ROLE "anon";
ALTER ROLE "anon" WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS CONNECTION LIMIT -1;
ALTER ROLE "anon" SET "statement_timeout" TO '3s';
GRANT SET ON PARAMETER "log_min_messages" TO "supabase_realtime_admin";
"@
        [System.IO.File]::WriteAllText($rolesPath, $fixtureSql, (New-Object System.Text.UTF8Encoding($false)))
        $summary = Write-ProjectLocalRoleRestoreSql -RolesSqlPath $rolesPath -OutputPath $derivedPath
        $derived = [System.IO.File]::ReadAllText($derivedPath)
        if ($summary.managed_role_count -ne 2 -or $summary.user_role_count -ne 0) { throw "fixture_managed_role_count_invalid" }
        if ($derived -match '(?i)CREATE\s+ROLE\s+"anon"' -or $derived -match '(?i)ALTER\s+ROLE\s+"anon"') { throw "fixture_managed_role_would_be_recreated" }
        foreach ($marker in @(
          "project_local_managed_role_missing",
          "project_local_managed_role_property_mismatch",
          "project_local_managed_role_configuration_mismatch",
          "project_local_managed_parameter_privilege_mismatch"
        )) {
          if (-not $derived.Contains($marker)) { throw "fixture_managed_verification_missing" }
        }
        "fixture_managed_role_plan_ok"
        return
      }
      "UserRolePlan" {
        $rolesPath = Join-Path $tempRoot "roles.sql"
        $derivedPath = Join-Path $tempRoot "roles-restore.sql"
        $fixtureSql = @"
CREATE ROLE "project_local_worker";
CREATE ROLE "project_local_reader";
ALTER ROLE "project_local_worker" WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3 PASSWORD 'syntheticScramVerifier123' VALID UNTIL '2030-01-01 00:00:00+00';
ALTER ROLE "project_local_worker" SET "statement_timeout" TO '10s';
GRANT "project_local_reader" TO "project_local_worker";
"@
        [System.IO.File]::WriteAllText($rolesPath, $fixtureSql, (New-Object System.Text.UTF8Encoding($false)))
        $summary = Write-ProjectLocalRoleRestoreSql -RolesSqlPath $rolesPath -OutputPath $derivedPath
        $derived = [System.IO.File]::ReadAllText($derivedPath)
        if ($summary.user_role_count -ne 2 -or $summary.managed_role_count -ne 0) { throw "fixture_user_role_count_invalid" }
        foreach ($marker in @(
          'CREATE ROLE "project_local_worker"',
          'ALTER ROLE "project_local_worker" WITH',
          'ALTER ROLE "project_local_worker" SET "statement_timeout"',
          'GRANT "project_local_reader" TO "project_local_worker"'
        )) {
          if (-not $derived.Contains($marker)) { throw "fixture_user_role_application_missing" }
        }
        "fixture_user_role_application_plan_ok"
        return
      }
      "UnsupportedRoleStatement" {
        $rolesPath = Join-Path $tempRoot "roles.sql"
        [System.IO.File]::WriteAllText($rolesPath, 'DROP ROLE "project_local_worker";', (New-Object System.Text.UTF8Encoding($false)))
        [void](New-ProjectLocalRoleRestorePlan -RolesSqlPath $rolesPath)
      }
      "RolePlanFailureCleanup" {
        $planRoot = Join-Path $tempRoot "derived"
        New-Item -ItemType Directory -Path $planRoot -Force | Out-Null
        try {
          $rolesPath = Join-Path $planRoot "roles.sql"
          [System.IO.File]::WriteAllText($rolesPath, 'DROP ROLE "project_local_worker";', (New-Object System.Text.UTF8Encoding($false)))
          [void](New-ProjectLocalRoleRestorePlan -RolesSqlPath $rolesPath)
        } catch {
          Remove-Item -LiteralPath $planRoot -Recurse -Force
        }
        if (Test-Path -LiteralPath $planRoot) { throw "fixture_failed_role_plan_cleanup_failed" }
        "fixture_failed_role_plan_cleanup_ok"
        return
      }
      default { throw "Unknown fixture scenario." }
    }
  } finally {
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
  }
}

if ($FixtureMode) {
  Invoke-FixtureScenario
  return
}

if (-not $ExecuteLocalRestore -and -not $VerifyExistingLocalRestore -and -not $InspectRolesOnly) {
  throw "Local restore execution requires -ExecuteLocalRestore."
}
$selectedModeCount = 0
if ($ExecuteLocalRestore) { $selectedModeCount++ }
if ($VerifyExistingLocalRestore) { $selectedModeCount++ }
if ($InspectRolesOnly) { $selectedModeCount++ }
if ($selectedModeCount -ne 1) {
  throw "Restore, verification-only, and role-inspection modes are mutually exclusive."
}

$targetPsqlArguments = $null
if ($ExecuteLocalRestore -or $VerifyExistingLocalRestore) {
  $targetPsqlArguments = Get-TargetPsqlArguments -HostName $TargetHost -Port $TargetPort -DatabaseName $TargetDatabase -UserName $TargetUser
}
Assert-OutsideRepository -Path $EncryptedBackupPath -Label "encrypted backup"
if ([string]::IsNullOrWhiteSpace($AgeIdentityPath)) {
  $AgeIdentityPath = Read-Host "Path to age private identity file"
}
Assert-OutsideRepository -Path $AgeIdentityPath -Label "age private identity"
if (-not [string]::IsNullOrWhiteSpace($BackupDestinationRoot)) {
  Assert-OutsidePath -Path $AgeIdentityPath -Parent $BackupDestinationRoot -Label "age private identity inside the backup destination"
}
if (-not (Test-Path -LiteralPath $EncryptedBackupPath)) { throw "Encrypted backup does not exist." }
if (-not (Test-Path -LiteralPath $AgeIdentityPath)) { throw "Age private identity does not exist." }
if ([string]::IsNullOrWhiteSpace($ExpectedSha256) -or $ExpectedSha256 -notmatch "^[a-fA-F0-9]{64}$") {
  throw "Expected SHA-256 checksum is required."
}
if ((Get-Content -LiteralPath $EncryptedBackupPath -TotalCount 1) -notlike "age-encryption.org/v1*") {
  throw "Encrypted backup is not structurally recognizable as an age file."
}
$actualSha = Get-Sha256Hex -Path $EncryptedBackupPath
if ($actualSha -ne $ExpectedSha256.ToLowerInvariant()) { throw "Encrypted backup checksum mismatch." }

$age = Get-Command "age" -ErrorAction Stop
$psql = Get-Command "psql" -ErrorAction Stop
$workRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("project-local-restore-" + [guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $workRoot "backup-package.zip"
$extractRoot = Join-Path $workRoot "decrypted"
$localRestorePassword = $null
$restoreStage = "prepare"

try {
  New-Item -ItemType Directory -Path $workRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null

  $restoreStage = "age_decrypt"
  Invoke-CheckedProcess -FilePath $age.Source -WorkingDirectory $workRoot -SafeFailureCode "age_decrypt" -ArgumentList @("-d", "-i", $AgeIdentityPath, "-o", $zipPath, $EncryptedBackupPath)
  $restoreStage = "archive_validation"
  Assert-ApprovedArchiveMembers -ArchivePath $zipPath
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot -Force

  foreach ($name in $ApprovedPackageFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $extractRoot $name))) {
      throw "Backup package is missing an approved restore file."
    }
  }
  $backupCoverage = Get-ProjectLocalLogicalBackupCoverage -ExtractRoot $extractRoot

  if ($InspectRolesOnly) {
    $restoreStage = "role_inspection"
    $inspection = Get-ProjectLocalRolesSqlInspection -RolesSqlPath (Join-Path $extractRoot "roles.sql")
    $restoreStage = "role_plan"
    $plan = New-ProjectLocalRoleRestorePlan -RolesSqlPath (Join-Path $extractRoot "roles.sql")
    [ordered]@{
      inspection = $inspection
      restore_plan = [ordered]@{
        statement_count = $plan.statement_count
        managed_role_count = $plan.managed_role_count
        managed_roles = $plan.managed_roles
        user_role_count = $plan.user_role_count
        user_roles = $plan.user_roles
        derived_statement_count = $plan.derived_statement_count
      }
      logical_backup_coverage = $backupCoverage
    } | ConvertTo-Json -Depth 10
    return
  }

  $restoreStage = "role_plan"
  $derivedRolesPath = Join-Path $extractRoot "roles-restore.sql"
  $rolePlanSummary = Write-ProjectLocalRoleRestoreSql -RolesSqlPath (Join-Path $extractRoot "roles.sql") -OutputPath $derivedRolesPath

  $restoreStage = "local_database_secret"
  if ($UseSupabaseLocalDefaults) {
    Assert-SupabaseLocalDefaultsTarget
    $localRestorePassword = ConvertTo-SecureString -String "postgres" -AsPlainText -Force
  } else {
    $localRestorePassword = Read-Host "Local disposable database password" -AsSecureString
  }
  if ($localRestorePassword.Length -eq 0) { throw "Local restore database password is required." }

  if ($ExecuteLocalRestore) {
    foreach ($name in $RestoreOrder) {
      $restoreStage = "restore_$($name.Replace('.', '_'))"
      $restoreFilePath = if ($name -eq "roles.sql") { $derivedRolesPath } else { Join-Path $extractRoot $name }
      Invoke-CheckedProcess -FilePath $psql.Source -WorkingDirectory $workRoot -SafeFailureCode "restore_$name" -ChildScopedSecret $localRestorePassword -ArgumentList (@("--single-transaction", "--set", "ON_ERROR_STOP=1") + $targetPsqlArguments + @("-f", $restoreFilePath))
    }
  }

  $restoreStage = "verify_migration_history"
  $migrationHistory = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_migration_history" -ChildScopedSecret $localRestorePassword -Sql "select coalesce(string_agg(version, ',' order by version), '') from supabase_migrations.schema_migrations;"
  if ($migrationHistory -cne ($ExpectedMigrationHistory -join ",") -or $ExpectedMigrationHistory[-1] -cne $ExpectedMigration) {
    throw "production_baseline_migration_history_mismatch"
  }

  $restoreStage = "verify_tables"
  $expectedTables = @($ProjectLocalTables | Sort-Object)
  $tableList = ConvertTo-ProjectLocalSqlLiteralList -Values $ProjectLocalTables
  $actualTables = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_tables" -ChildScopedSecret $localRestorePassword -Sql "select coalesce(string_agg(tablename, ',' order by tablename), '') from pg_catalog.pg_tables where schemaname = 'public';"
  if ($actualTables -cne ($expectedTables -join ",")) {
    throw "production_baseline_public_tables_mismatch"
  }

  $restoreStage = "verify_functions"
  $expectedFunctions = @($ExpectedBaselineFunctions | Sort-Object)
  $actualFunctions = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_functions" -ChildScopedSecret $localRestorePassword -Sql "select coalesce(string_agg(distinct procedure.proname, ',' order by procedure.proname), '') from pg_catalog.pg_proc as procedure join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace where namespace.nspname = 'public' and procedure.prokind = 'f' and procedure.prorettype <> 'pg_catalog.trigger'::regtype;"
  if ($actualFunctions -cne ($expectedFunctions -join ",")) {
    throw "production_baseline_public_functions_mismatch"
  }

  $restoreStage = "verify_pending_function_absent"
  $pendingFunctionCount = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_pending_function_absent" -ChildScopedSecret $localRestorePassword -Sql "select count(*) from pg_catalog.pg_proc as procedure join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace where namespace.nspname = 'public' and procedure.proname = 'read_assignment_notification_delivery_health';"
  if ([int]$pendingFunctionCount -ne 0) { throw "pending_notification_health_function_present" }

  $restoreStage = "verify_rls"
  $actualRlsTables = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_rls" -ChildScopedSecret $localRestorePassword -Sql "select coalesce(string_agg(tablename, ',' order by tablename), '') from pg_catalog.pg_tables where schemaname = 'public' and tablename in ($tableList) and rowsecurity = true;"
  if ($actualRlsTables -cne ($expectedTables -join ",")) { throw "production_baseline_rls_mismatch" }

  $restoreStage = "verify_force_rls"
  $expectedForceRls = @($ExpectedForceRlsTables | Sort-Object)
  $actualForceRls = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_force_rls" -ChildScopedSecret $localRestorePassword -Sql "select coalesce(string_agg(relation.relname, ',' order by relation.relname), '') from pg_catalog.pg_class as relation join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace where namespace.nspname = 'public' and relation.relname in ($tableList) and relation.relkind = 'r' and relation.relforcerowsecurity = true;"
  if ($actualForceRls -cne ($expectedForceRls -join ",")) { throw "production_baseline_force_rls_mismatch" }

  $restoreStage = "verify_table_grants"
  $unsafeGrantCount = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_table_grants" -ChildScopedSecret $localRestorePassword -Sql "select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in ($tableList) and grantee in ('anon','authenticated','public') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');"
  if ([int]$unsafeGrantCount -ne 0) { throw "unsafe_broad_table_mutation_grants" }

  $restoreStage = "verify_managed_roles"
  $managedRoleList = ConvertTo-ProjectLocalSqlLiteralList -Values $rolePlanSummary.managed_roles
  $managedRoleCount = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_managed_roles" -ChildScopedSecret $localRestorePassword -Sql "select count(*) from pg_catalog.pg_roles where rolname in ($managedRoleList);"
  if ([int]$managedRoleCount -ne $rolePlanSummary.managed_role_count) { throw "managed_roles_post_restore_missing" }

  $restoreStage = "verify_no_service_role_runtime_owner"
  $serviceRoleOwnerCount = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_no_service_role_runtime_owner" -ChildScopedSecret $localRestorePassword -Sql "select count(*) from pg_catalog.pg_proc as procedure join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace join pg_catalog.pg_roles as owner on owner.oid = procedure.proowner where namespace.nspname = 'public' and owner.rolname = 'service_role';"
  if ([int]$serviceRoleOwnerCount -ne 0) { throw "service_role_owned_public_function_present" }
  if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_SERVICE_ROLE_KEY)) { throw "service_role_application_environment_present" }

  $restoreStage = "verify_product_rows"
  $rowCountParts = $ProjectLocalTables | ForEach-Object { "select count(*)::bigint as row_count from public.$(ConvertTo-ProjectLocalSqlIdentifier -Identifier $_)" }
  $productRowCount = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_product_rows" -ChildScopedSecret $localRestorePassword -Sql ("select coalesce(sum(row_count), 0) from (" + ($rowCountParts -join " union all ") + ") as product_rows;")
  if ([int64]$productRowCount -ne 0) { throw "production_snapshot_product_rows_unexpected" }

  $restoreStage = "verify_public_object_shape"
  $unexpectedPublicObjectCount = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_public_object_shape" -ChildScopedSecret $localRestorePassword -Sql "select (select count(*) from pg_catalog.pg_class as relation join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace where namespace.nspname = 'public' and relation.relkind = 'S') + (select count(*) from pg_catalog.pg_type as type join pg_catalog.pg_namespace as namespace on namespace.oid = type.typnamespace where namespace.nspname = 'public' and type.typtype in ('e','c') and type.typrelid = 0);"
  if ([int]$unexpectedPublicObjectCount -ne 0) { throw "production_baseline_unexpected_public_objects" }

  $restoreStage = "verify_baseline_types"
  if ([string]::IsNullOrWhiteSpace($SupabaseWorkdir)) { $SupabaseWorkdir = $RepositoryRoot }
  if (-not (Test-Path -LiteralPath (Join-Path $SupabaseWorkdir "supabase\config.toml"))) { throw "supabase_workdir_config_missing" }
  $supabase = Get-Command "supabase" -ErrorAction Stop
  $git = Get-Command "git" -ErrorAction Stop
  $generatedTypesPath = Join-Path $workRoot "restored-database.types.ts"
  $baselineTypesPath = Join-Path $workRoot "production-baseline.types.ts"
  Invoke-CheckedProcess -FilePath $supabase.Source -WorkingDirectory $workRoot -SafeFailureCode "generate_restored_types" -StdoutPath $generatedTypesPath -ArgumentList @("gen", "types", "typescript", "--local", "--workdir", $SupabaseWorkdir)
  Invoke-CheckedProcess -FilePath $git.Source -WorkingDirectory $workRoot -SafeFailureCode "read_baseline_types" -StdoutPath $baselineTypesPath -ArgumentList @("-C", $RepositoryRoot, "show", "$ProductionBaselineTypesCommit`:$ProductionBaselineTypesGitPath")
  $generatedTypes = Get-NormalizedProjectLocalGeneratedTypes -Path $generatedTypesPath
  $baselineTypes = Get-NormalizedProjectLocalGeneratedTypes -Path $baselineTypesPath
  if ($baselineTypes.Contains("read_assignment_notification_delivery_health")) { throw "production_baseline_types_are_not_pre_12_33" }
  if (-not ([System.IO.File]::ReadAllText((Join-Path $RepositoryRoot "lib\supabase\database.types.ts")).Contains("read_assignment_notification_delivery_health"))) { throw "current_head_types_distinction_missing" }
  if ($generatedTypes -cne $baselineTypes) { throw "production_baseline_generated_type_mismatch" }

  [ordered]@{
    result = "local_restore_validation_ok"
    restored_terminal_migration = $ExpectedMigration
    migration_history_count = $ExpectedMigrationHistory.Count
    public_table_count = $ProjectLocalTables.Count
    baseline_public_function_count = $ExpectedBaselineFunctions.Count
    pending_notification_health_function_count = [int]$pendingFunctionCount
    rls_table_count = $ProjectLocalTables.Count
    force_rls_table_count = $ExpectedForceRlsTables.Count
    unsafe_broad_mutation_grant_count = [int]$unsafeGrantCount
    managed_role_count = $rolePlanSummary.managed_role_count
    restored_user_role_count = $rolePlanSummary.user_role_count
    product_row_count = [int64]$productRowCount
    production_baseline_types_commit = $ProductionBaselineTypesCommit
    logical_backup_coverage = $backupCoverage
  } | ConvertTo-Json -Depth 6
} catch {
  $safeFailureCode = if ($_.Exception.Message -match '^[a-z][a-z0-9_]{2,80}$') {
    $_.Exception.Message
  } else {
    $safeType = [regex]::Replace($_.Exception.GetType().Name.ToLowerInvariant(), '[^a-z0-9_]', '_')
    "stage_failed_$safeType"
  }
  throw "Local restore validation failed safely at $restoreStage with $safeFailureCode."
} finally {
  if ($null -ne $localRestorePassword) { $localRestorePassword.Dispose() }
  if (Test-Path -LiteralPath $workRoot) { Remove-Item -LiteralPath $workRoot -Recurse -Force }
}
