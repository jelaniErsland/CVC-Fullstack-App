param(
  [switch]$FixtureMode,
  [ValidateSet("GuardProductionTarget", "GuardStagingTarget", "GuardNonLoopback", "GuardMissingExecute", "GuardPrivateIdentityInRepo", "GuardPrivateIdentityInBackupDestination", "GuardMalformedArtifact", "GuardUnexpectedArchiveMember", "GuardPathTraversalArchiveMember", "ChecksumAndCleanup", "CommandPlan")]
  [string]$FixtureScenario,
  [switch]$ExecuteLocalRestore,
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
  [string]$ExpectedMigration = "20260714122230"
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
  "assignment_notification_deliveries"
)

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

if (-not $ExecuteLocalRestore) {
  throw "Local restore execution requires -ExecuteLocalRestore."
}

$targetPsqlArguments = Get-TargetPsqlArguments -HostName $TargetHost -Port $TargetPort -DatabaseName $TargetDatabase -UserName $TargetUser
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

  $restoreStage = "local_database_secret"
  if ($UseSupabaseLocalDefaults) {
    Assert-SupabaseLocalDefaultsTarget
    $localRestorePassword = ConvertTo-SecureString -String "postgres" -AsPlainText -Force
  } else {
    $localRestorePassword = Read-Host "Local disposable database password" -AsSecureString
  }
  if ($localRestorePassword.Length -eq 0) { throw "Local restore database password is required." }

  foreach ($name in $RestoreOrder) {
    $restoreStage = "restore_$($name.Replace('.', '_'))"
    Invoke-CheckedProcess -FilePath $psql.Source -WorkingDirectory $workRoot -SafeFailureCode "restore_$name" -ChildScopedSecret $localRestorePassword -ArgumentList (@("--single-transaction", "--set", "ON_ERROR_STOP=1") + $targetPsqlArguments + @("-f", (Join-Path $extractRoot $name)))
  }

  $restoreStage = "verify_migration"
  $migration = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_migration" -ChildScopedSecret $localRestorePassword -Sql "select version from supabase_migrations.schema_migrations order by version desc limit 1;"
  if ($migration -ne $ExpectedMigration) {
    throw "Restored database terminal migration mismatch."
  }

  $restoreStage = "verify_tables"
  $tableList = ($ProjectLocalTables | ForEach-Object { "'$_'" }) -join ","
  $tableCount = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_tables" -ChildScopedSecret $localRestorePassword -Sql "select count(*) from information_schema.tables where table_schema = 'public' and table_name in ($tableList);"
  if ([int]$tableCount -lt $ProjectLocalTables.Count) {
    throw "Restored database is missing Project Local application tables."
  }

  $restoreStage = "verify_rls"
  $rlsCount = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_rls" -ChildScopedSecret $localRestorePassword -Sql "select count(*) from pg_tables where schemaname = 'public' and tablename in ($tableList) and rowsecurity = true;"
  if ([int]$rlsCount -lt 8) {
    throw "Restored database RLS posture is incomplete."
  }

  $restoreStage = "verify_table_grants"
  $unsafeGrantCount = Invoke-ScalarQuery -PsqlPath $psql.Source -TargetArguments $targetPsqlArguments -WorkingDirectory $workRoot -SafeFailureCode "verify_table_grants" -ChildScopedSecret $localRestorePassword -Sql "select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name in ($tableList) and grantee in ('anon','authenticated','public') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');"
  if ([int]$unsafeGrantCount -ne 0) {
    throw "Restored database exposes unsafe broad table mutation grants."
  }

  "local_restore_validation_ok"
} catch {
  throw "Local restore validation failed safely at $restoreStage."
} finally {
  if ($null -ne $localRestorePassword) { $localRestorePassword.Dispose() }
  if (Test-Path -LiteralPath $workRoot) { Remove-Item -LiteralPath $workRoot -Recurse -Force }
}
