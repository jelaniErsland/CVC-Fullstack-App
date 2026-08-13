param(
  [switch]$ExecuteProductionBackup,
  [switch]$ExecuteProductionPreflight,
  [switch]$FixtureMode,
  [ValidateSet("GuardMissingOptIn", "GuardStagingRef", "GuardRepoDestination", "GuardMissingRecipient", "GuardMissingSecret", "GuardMalformedSecret", "ValidateConnectionUrl", "Retention", "CleanupAfterFailure", "StatusRedaction", "SafeInjectedFailure", "MigrationPreflightExpected", "MigrationPreflightWrong", "MigrationPreflightMissing", "MigrationPreflightMalformed", "MigrationPreflightQueryFailure", "MigrationPreflightLoopback")]
  [string]$FixtureScenario,
  [string]$FixtureConnectionUrl,
  [string]$ProjectName,
  [string]$ProjectRef,
  [string]$ExpectedMigration,
  [string]$AgeRecipient,
  [string]$DestinationRoot,
  [string]$SecretPath,
  [string]$RetentionRoot,
  [int]$DailyRetention = 14,
  [int]$WeeklyRetention = 8,
  [string]$WeeklyPromotionDay = "Sunday",
  [switch]$NotifyOnFailure,
  [switch]$ConfirmSafeInjectedFailure,
  [string]$FailureTestStatusRoot,
  [string]$NotificationTestSinkPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepositoryRoot = (Resolve-Path (Join-Path $ScriptRoot "..\..")).Path
$ExpectedProjectName = "project-local-production"
$ExpectedProjectRef = "wdlaauzknfggoqldolmx"
$ForbiddenStagingRef = "kfuujcfxoayukywvtaeh"
$ExpectedTerminalMigration = "20260714122230"
$BackupFormatVersion = "project-local.logical-backup.v1"
. (Join-Path $ScriptRoot "ProjectLocalProductionConnection.ps1")

function Test-IsSubPath {
  param([Parameter(Mandatory = $true)][string]$Child, [Parameter(Mandatory = $true)][string]$Parent)
  $childFull = [System.IO.Path]::GetFullPath($Child).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  return $childFull.Equals($parentFull, [System.StringComparison]::OrdinalIgnoreCase) -or $childFull.StartsWith($parentFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
}

function Assert-NotRepositoryPath {
  param([Parameter(Mandatory = $true)][string]$Path, [string]$Label = "path")
  if (Test-IsSubPath -Child $Path -Parent $RepositoryRoot) {
    throw "Refusing $Label inside the public application repository."
  }
}

function Assert-SafeTarget {
  if (-not $ExecuteProductionBackup -and -not $ExecuteProductionPreflight -and -not $FixtureMode) {
    throw "Refusing to run: pass -ExecuteProductionBackup, -ExecuteProductionPreflight, or -FixtureMode."
  }
  if (($FixtureMode -and ($ExecuteProductionBackup -or $ExecuteProductionPreflight)) -or ($ExecuteProductionBackup -and $ExecuteProductionPreflight)) {
    throw "Choose exactly one production backup, production preflight, or fixture mode."
  }
  if ($ProjectRef -eq $ForbiddenStagingRef) {
    throw "Refusing staging project ref."
  }
  if ($ExecuteProductionBackup -or $ExecuteProductionPreflight) {
    if ($ProjectName -ne $ExpectedProjectName -or $ProjectRef -ne $ExpectedProjectRef -or $ExpectedMigration -ne $ExpectedTerminalMigration) {
      throw "Refusing production backup because exact project locks do not match."
    }
  }
}

function Assert-NoServiceRoleRuntime {
  if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_SERVICE_ROLE_KEY)) {
    throw "SUPABASE_SERVICE_ROLE_KEY must not be present for Project Local backup automation."
  }
}

function Assert-AgeRecipient {
  param([string]$Recipient)
  if ([string]::IsNullOrWhiteSpace($Recipient) -or $Recipient -notmatch "^age1[023456789acdefghjklmnpqrstuvwxyz]{20,}$") {
    throw "Missing or malformed age public recipient."
  }
}

function Resolve-DefaultDestinationRoot {
  if ([string]::IsNullOrWhiteSpace($DestinationRoot)) {
    if ([string]::IsNullOrWhiteSpace($env:OneDrive)) {
      throw "OneDrive is not available; pass an explicit private destination outside the repository."
    }
    $DestinationRoot = Join-Path $env:OneDrive "Project Local Backups\production"
  }
  $full = [System.IO.Path]::GetFullPath($DestinationRoot)
  Assert-NotRepositoryPath -Path $full -Label "backup destination"
  return $full
}

function Write-SafeStatus {
  param(
    [Parameter(Mandatory = $true)][string]$StatusDirectory,
    [Parameter(Mandatory = $true)][hashtable]$Payload
  )
  Assert-NotRepositoryPath -Path $StatusDirectory -Label "status directory"
  New-Item -ItemType Directory -Path $StatusDirectory -Force | Out-Null
  $safe = [ordered]@{
    status = $Payload.status
    utcTimestamp = (Get-Date).ToUniversalTime().ToString("o")
    encryptedFileName = $Payload.encryptedFileName
    encryptedByteSize = $Payload.encryptedByteSize
    sha256 = $Payload.sha256
    safeFailureCode = $Payload.safeFailureCode
  }
  $statusPath = Join-Path $StatusDirectory "latest-status.json"
  $temporaryStatusPath = "$statusPath.$PID.$([guid]::NewGuid().ToString('N')).tmp"
  try {
    [System.IO.File]::WriteAllText(
      $temporaryStatusPath,
      ($safe | ConvertTo-Json -Depth 4),
      (New-Object System.Text.UTF8Encoding($false))
    )
    Move-Item -LiteralPath $temporaryStatusPath -Destination $statusPath -Force
  } finally {
    if (Test-Path -LiteralPath $temporaryStatusPath) {
      Remove-Item -LiteralPath $temporaryStatusPath -Force
    }
  }
  return $statusPath
}

function Write-SafeNotificationStatus {
  param(
    [Parameter(Mandatory = $true)][string]$StatusDirectory,
    [Parameter(Mandatory = $true)][ValidateSet("emitted", "failed")][string]$NotificationState,
    [Parameter(Mandatory = $true)][string]$SafeFailureCode
  )
  Assert-NotRepositoryPath -Path $StatusDirectory -Label "notification status directory"
  New-Item -ItemType Directory -Path $StatusDirectory -Force | Out-Null
  $payload = [ordered]@{
    notificationState = $NotificationState
    utcTimestamp = (Get-Date).ToUniversalTime().ToString("o")
    safeFailureCode = $SafeFailureCode
  }
  $path = Join-Path $StatusDirectory "latest-notification.json"
  $temporaryPath = "$path.$PID.$([guid]::NewGuid().ToString('N')).tmp"
  try {
    [System.IO.File]::WriteAllText(
      $temporaryPath,
      ($payload | ConvertTo-Json -Depth 3),
      (New-Object System.Text.UTF8Encoding($false))
    )
    Move-Item -LiteralPath $temporaryPath -Destination $path -Force
  } finally {
    if (Test-Path -LiteralPath $temporaryPath) {
      Remove-Item -LiteralPath $temporaryPath -Force
    }
  }
}

function Send-SafeFailureNotification {
  param(
    [Parameter(Mandatory = $true)][string]$StatusDirectory,
    [Parameter(Mandatory = $true)][string]$SafeFailureCode,
    [string]$TestSinkPath
  )
  if ($SafeFailureCode -notmatch "^[a-z][a-z0-9_]{2,63}$") {
    throw "Refusing unsafe failure-notification code."
  }
  $utcTimestamp = (Get-Date).ToUniversalTime().ToString("o")
  $message = "Project Local production backup failed.`r`nUTC: $utcTimestamp`r`nFailure code: $SafeFailureCode`r`nReview backup status."
  try {
    if (-not [string]::IsNullOrWhiteSpace($TestSinkPath)) {
      if (-not $FixtureMode) {
        throw "Notification test sink is fixture-only."
      }
      $fullSinkPath = [System.IO.Path]::GetFullPath($TestSinkPath)
      Assert-NotRepositoryPath -Path $fullSinkPath -Label "notification test sink"
      $sinkParent = Split-Path -Parent $fullSinkPath
      New-Item -ItemType Directory -Path $sinkParent -Force | Out-Null
      [System.IO.File]::WriteAllText(
        $fullSinkPath,
        $message,
        (New-Object System.Text.UTF8Encoding($false))
      )
    } else {
      $messageCommand = Get-Command "msg.exe" -ErrorAction Stop
      $sessionId = [System.Diagnostics.Process]::GetCurrentProcess().SessionId
      if ($sessionId -le 0) {
        throw "No interactive Windows session is available for backup notification."
      }
      & $messageCommand.Source $sessionId "/TIME:300" $message 2>$null | Out-Null
      if ($LASTEXITCODE -ne 0) {
        throw "Windows operator notification failed."
      }
    }
    Write-SafeNotificationStatus -StatusDirectory $StatusDirectory -NotificationState "emitted" -SafeFailureCode $SafeFailureCode
    return $true
  } catch {
    try {
      Write-SafeNotificationStatus -StatusDirectory $StatusDirectory -NotificationState "failed" -SafeFailureCode $SafeFailureCode
    } catch {}
    return $false
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

function Invoke-CheckedProcess {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$ArgumentList,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$SafeFailureCode
  )
  $stdout = Join-Path $WorkingDirectory "$SafeFailureCode.stdout.txt"
  $stderr = Join-Path $WorkingDirectory "$SafeFailureCode.stderr.txt"
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo.FileName = $FilePath
  $process.StartInfo.WorkingDirectory = $WorkingDirectory
  $process.StartInfo.Arguments = ConvertTo-NativeArgumentString -ArgumentList $ArgumentList
  $process.StartInfo.RedirectStandardOutput = $true
  $process.StartInfo.RedirectStandardError = $true
  $process.StartInfo.UseShellExecute = $false
  [void]$process.Start()
  $out = $process.StandardOutput.ReadToEnd()
  $err = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  Set-Content -LiteralPath $stdout -Value $out -Encoding UTF8
  Set-Content -LiteralPath $stderr -Value $err -Encoding UTF8
  if ($process.ExitCode -ne 0) {
    throw "$SafeFailureCode failed. Output was captured and redacted."
  }
}

function Read-SecretUrl {
  if ([string]::IsNullOrWhiteSpace($SecretPath)) {
    if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
      throw "Missing encrypted secret path and LOCALAPPDATA."
    }
    $SecretPath = Join-Path $env:LOCALAPPDATA "ProjectLocal\ProductionBackup\production-db-url.dpapi.txt"
  }
  Assert-NotRepositoryPath -Path $SecretPath -Label "encrypted secret"
  if (-not (Test-Path -LiteralPath $SecretPath)) {
    throw "Encrypted production database secret is missing."
  }
  $encrypted = (Get-Content -LiteralPath $SecretPath -Raw).TrimStart([char]0xFEFF)
  $secure = ConvertTo-SecureString -String $encrypted
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    return ConvertTo-ProjectLocalProductionSessionPoolerUrl `
      -ConnectionInput $plainValue `
      -ExpectedProjectRef $ExpectedProjectRef `
      -ForbiddenStagingRef $ForbiddenStagingRef
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $secure.Dispose()
  }
}

function Assert-MigrationPreflightProcessResult {
  param(
    [Parameter(Mandatory = $true)][int]$ExitCode,
    [string]$Output,
    [Parameter(Mandatory = $true)][string]$ExpectedMigrationVersion
  )
  if ($ExitCode -ne 0) {
    throw "migration_preflight_query_failed"
  }
  $result = $null
  try {
    $result = $Output.Trim() | ConvertFrom-Json
  } catch {
    throw "migration_preflight_output_invalid"
  }
  if (
    $null -eq $result -or
    $null -eq $result.PSObject.Properties["database_name"] -or
    $null -eq $result.PSObject.Properties["terminal_migration"] -or
    $result.database_name -isnot [string] -or
    $result.terminal_migration -isnot [string] -or
    $result.terminal_migration -notmatch "^[0-9]{14}$"
  ) {
    throw "migration_preflight_history_invalid"
  }
  if (
    $result.database_name -cne "postgres" -or
    $result.terminal_migration -cne $ExpectedMigrationVersion
  ) {
    throw "migration_preflight_mismatch"
  }
}

function Invoke-ProjectLocalMigrationPreflight {
  param(
    [Parameter(Mandatory = $true)][string]$PsqlPath,
    [Parameter(Mandatory = $true)][string]$ConnectionUrl,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$ExpectedMigrationVersion,
    [switch]$AllowLoopbackFixture
  )
  $uri = [System.Uri]$ConnectionUrl
  $userInfo = $uri.UserInfo
  $separatorIndex = $userInfo.IndexOf(":", [System.StringComparison]::Ordinal)
  if ($separatorIndex -lt 1) { throw "migration_preflight_target_invalid" }
  $userName = $userInfo.Substring(0, $separatorIndex)
  $password = $null
  try {
    $password = [System.Uri]::UnescapeDataString($userInfo.Substring($separatorIndex + 1))
    if ([string]::IsNullOrEmpty($password)) { throw "migration_preflight_target_invalid" }
    if ($AllowLoopbackFixture) {
      if ($uri.Host -notin @("127.0.0.1", "localhost") -or $uri.AbsolutePath -cne "/postgres") {
        throw "migration_preflight_fixture_target_invalid"
      }
    } elseif (
      $uri.Host -notmatch "\.pooler\.supabase\.com$" -or
      $uri.Port -ne 5432 -or
      $uri.AbsolutePath -cne "/postgres" -or
      $userName -cne "postgres.$ExpectedProjectRef" -or
      $ConnectionUrl.IndexOf($ForbiddenStagingRef, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    ) {
      throw "migration_preflight_target_invalid"
    }

    $queryPath = Join-Path $WorkingDirectory "production-migration-preflight.sql"
    [System.IO.File]::WriteAllText(
      $queryPath,
      @"
\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
SELECT json_build_object(
  'database_name', current_database(),
  'terminal_migration', (
    SELECT version::text
    FROM supabase_migrations.schema_migrations
    ORDER BY version DESC
    LIMIT 1
  )
)::text;
ROLLBACK;
"@,
      (New-Object System.Text.UTF8Encoding($false))
    )

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo.FileName = $PsqlPath
    $process.StartInfo.WorkingDirectory = $WorkingDirectory
    $process.StartInfo.Arguments = ConvertTo-NativeArgumentString -ArgumentList @(
      "-X",
      "--no-password",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set", "ON_ERROR_STOP=1",
      "--file", $queryPath
    )
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.EnvironmentVariables["PGHOST"] = $uri.Host
    $process.StartInfo.EnvironmentVariables["PGPORT"] = [string]$uri.Port
    $process.StartInfo.EnvironmentVariables["PGDATABASE"] = "postgres"
    $process.StartInfo.EnvironmentVariables["PGUSER"] = $userName
    $process.StartInfo.EnvironmentVariables["PGPASSWORD"] = $password
    $process.StartInfo.EnvironmentVariables["PGSSLMODE"] = if ($AllowLoopbackFixture) { "disable" } else { "require" }
    $process.StartInfo.EnvironmentVariables["PGOPTIONS"] = "-c default_transaction_read_only=on"
    try {
      [void]$process.Start()
      $output = $process.StandardOutput.ReadToEnd()
      [void]$process.StandardError.ReadToEnd()
      $process.WaitForExit()
      Assert-MigrationPreflightProcessResult `
        -ExitCode $process.ExitCode `
        -Output $output `
        -ExpectedMigrationVersion $ExpectedMigrationVersion
    } finally {
      foreach ($name in @("PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGSSLMODE", "PGOPTIONS")) {
        [void]$process.StartInfo.EnvironmentVariables.Remove($name)
      }
      $output = $null
      $process.Dispose()
    }
  } finally {
    $password = $null
    $userInfo = $null
  }
}

function Remove-RecognizedBackups {
  param([Parameter(Mandatory = $true)][string]$Directory, [Parameter(Mandatory = $true)][int]$Keep)
  if (-not (Test-Path -LiteralPath $Directory)) { return }
  $recognized = Get-ChildItem -LiteralPath $Directory -File | Where-Object {
    $_.Name -match "^project-local-production-\d{8}T\d{6}Z-[a-f0-9]{8}\.zip\.age$"
  } | Sort-Object LastWriteTimeUtc -Descending
  $toRemove = @($recognized | Select-Object -Skip $Keep)
  foreach ($file in $toRemove) {
    Remove-Item -LiteralPath $file.FullName -Force
  }
}

function Invoke-FixtureScenario {
  $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("project-local-backup-fixture-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
  try {
    switch ($FixtureScenario) {
      "GuardMissingOptIn" {
        if ($ExecuteProductionBackup) { throw "fixture_misconfigured" }
        throw "Refusing to run: pass -ExecuteProductionBackup for real production backup or -FixtureMode for safe local validation."
      }
      "GuardStagingRef" {
        $script:ProjectRef = $ForbiddenStagingRef
        Assert-SafeTarget
      }
      "GuardRepoDestination" {
        Assert-NotRepositoryPath -Path (Join-Path $RepositoryRoot "tmp-backups") -Label "backup destination"
      }
      "GuardMissingRecipient" {
        Assert-AgeRecipient -Recipient ""
      }
      "GuardMissingSecret" {
        $script:SecretPath = Join-Path $tempRoot "missing.dpapi.txt"
        [void](Read-SecretUrl)
      }
      "GuardMalformedSecret" {
        $script:SecretPath = Join-Path $tempRoot "malformed.dpapi.txt"
        $fixtureSecret = ConvertTo-SecureString -String "x" -AsPlainText -Force
        try {
          $fixtureCipher = ConvertFrom-SecureString -SecureString $fixtureSecret
          [System.IO.File]::WriteAllText(
            $script:SecretPath,
            $fixtureCipher,
            (New-Object System.Text.UTF8Encoding($false))
          )
        } finally {
          $fixtureSecret.Dispose()
        }
        [void](Read-SecretUrl)
      }
      "ValidateConnectionUrl" {
        [void](ConvertTo-ProjectLocalProductionSessionPoolerUrl `
          -ConnectionInput $FixtureConnectionUrl `
          -ExpectedProjectRef $ExpectedProjectRef `
          -ForbiddenStagingRef $ForbiddenStagingRef)
        "fixture_connection_url_ok"
        return
      }
      "Retention" {
        $daily = Join-Path $tempRoot "daily"
        New-Item -ItemType Directory -Path $daily -Force | Out-Null
        1..18 | ForEach-Object {
          $path = Join-Path $daily ("project-local-production-202607{0:D2}T000000Z-abcdef{0:D2}.zip.age" -f $_)
          Set-Content -LiteralPath $path -Value "AGE-FIXTURE" -Encoding UTF8
          (Get-Item -LiteralPath $path).LastWriteTimeUtc = (Get-Date).AddDays(-$_)
        }
        Set-Content -LiteralPath (Join-Path $daily "operator-note.txt") -Value "preserve" -Encoding UTF8
        Remove-RecognizedBackups -Directory $daily -Keep 14
        $remaining = @(Get-ChildItem -LiteralPath $daily -File)
        if (-not (Test-Path -LiteralPath (Join-Path $daily "operator-note.txt"))) { throw "unrecognized_file_deleted" }
        if (@($remaining | Where-Object { $_.Name -like "*.age" }).Count -ne 14) { throw "retention_count_wrong" }
        "fixture_retention_ok"
        return
      }
      "CleanupAfterFailure" {
        $work = Join-Path $tempRoot "work"
        New-Item -ItemType Directory -Path $work -Force | Out-Null
        try {
          Set-Content -LiteralPath (Join-Path $work "schema.sql") -Value "plaintext fixture" -Encoding UTF8
          throw "simulated_failure"
        } finally {
          if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force }
        }
      }
      "StatusRedaction" {
        $statusDir = Join-Path $tempRoot "status"
        $path = Write-SafeStatus -StatusDirectory $statusDir -Payload @{
          status = "failure"
          encryptedFileName = $null
          encryptedByteSize = $null
          sha256 = $null
          safeFailureCode = "simulated_failure"
        }
        $text = Get-Content -LiteralPath $path -Raw
        if ($text -match "postgres://|password|service_role|eyJ|supabase.co") { throw "status_not_redacted" }
        "fixture_status_ok"
        return
      }
      "SafeInjectedFailure" {
        if (-not $ConfirmSafeInjectedFailure) {
          throw "Safe injected failure requires -ConfirmSafeInjectedFailure."
        }
        if ([string]::IsNullOrWhiteSpace($FailureTestStatusRoot)) {
          throw "Safe injected failure requires a dedicated status root."
        }
        if (-not $NotifyOnFailure) {
          throw "Safe injected failure requires -NotifyOnFailure."
        }
        $failureStatusDirectory = [System.IO.Path]::GetFullPath($FailureTestStatusRoot)
        Assert-NotRepositoryPath -Path $failureStatusDirectory -Label "failure-test status root"
        [void](Write-SafeStatus -StatusDirectory $failureStatusDirectory -Payload @{
          status = "failure"
          encryptedFileName = $null
          encryptedByteSize = $null
          sha256 = $null
          safeFailureCode = "injected_pre_network_failure"
        })
        [void](Send-SafeFailureNotification `
          -StatusDirectory $failureStatusDirectory `
          -SafeFailureCode "injected_pre_network_failure" `
          -TestSinkPath $NotificationTestSinkPath)
        throw "Safe injected pre-network failure completed with expected nonzero outcome."
      }
      "MigrationPreflightExpected" {
        Assert-MigrationPreflightProcessResult `
          -ExitCode 0 `
          -Output '{"database_name":"postgres","terminal_migration":"20260714122230"}' `
          -ExpectedMigrationVersion "20260714122230"
        "fixture_migration_preflight_expected_ok"
        return
      }
      "MigrationPreflightWrong" {
        try {
          Assert-MigrationPreflightProcessResult `
            -ExitCode 0 `
            -Output '{"database_name":"postgres","terminal_migration":"20260714122229"}' `
            -ExpectedMigrationVersion "20260714122230"
          throw "fixture_wrong_migration_not_rejected"
        } catch {
          if ($_.Exception.Message -cne "migration_preflight_mismatch") { throw }
        }
        "fixture_migration_preflight_wrong_rejected"
        return
      }
      "MigrationPreflightMissing" {
        try {
          Assert-MigrationPreflightProcessResult `
            -ExitCode 0 `
            -Output '{"database_name":"postgres","terminal_migration":null}' `
            -ExpectedMigrationVersion "20260714122230"
          throw "fixture_missing_migration_not_rejected"
        } catch {
          if ($_.Exception.Message -cne "migration_preflight_history_invalid") { throw }
        }
        "fixture_migration_preflight_missing_rejected"
        return
      }
      "MigrationPreflightMalformed" {
        try {
          Assert-MigrationPreflightProcessResult `
            -ExitCode 0 `
            -Output '{"database_name":"postgres","terminal_migration":"not-a-migration"}' `
            -ExpectedMigrationVersion "20260714122230"
          throw "fixture_malformed_migration_not_rejected"
        } catch {
          if ($_.Exception.Message -cne "migration_preflight_history_invalid") { throw }
        }
        "fixture_migration_preflight_malformed_rejected"
        return
      }
      "MigrationPreflightQueryFailure" {
        try {
          Assert-MigrationPreflightProcessResult `
            -ExitCode 1 `
            -Output "" `
            -ExpectedMigrationVersion "20260714122230"
          throw "fixture_query_failure_not_rejected"
        } catch {
          if ($_.Exception.Message -cne "migration_preflight_query_failed") { throw }
        }
        "fixture_migration_preflight_query_failure_rejected"
        return
      }
      "MigrationPreflightLoopback" {
        if ([string]::IsNullOrWhiteSpace($FixtureConnectionUrl)) {
          throw "Migration preflight loopback fixture requires a connection URL."
        }
        $psql = Get-Command "psql" -ErrorAction Stop
        Invoke-ProjectLocalMigrationPreflight `
          -PsqlPath $psql.Source `
          -ConnectionUrl $FixtureConnectionUrl `
          -WorkingDirectory $tempRoot `
          -ExpectedMigrationVersion $ExpectedMigration `
          -AllowLoopbackFixture
        "fixture_migration_preflight_loopback_ok"
        return
      }
      default { throw "Unknown fixture scenario." }
    }
  } finally {
    if (Test-Path -LiteralPath $tempRoot) {
      Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
  }
}

if ($FixtureMode) {
  Invoke-FixtureScenario
  return
}

Assert-SafeTarget
Assert-NoServiceRoleRuntime

if ($ExecuteProductionPreflight) {
  $preflightRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("project-local-production-preflight-" + [guid]::NewGuid().ToString("N"))
  $preflightUrl = $null
  try {
    New-Item -ItemType Directory -Path $preflightRoot -Force | Out-Null
    $psql = Get-Command "psql" -ErrorAction Stop
    $preflightUrl = Read-SecretUrl
    Invoke-ProjectLocalMigrationPreflight `
      -PsqlPath $psql.Source `
      -ConnectionUrl $preflightUrl `
      -WorkingDirectory $preflightRoot `
      -ExpectedMigrationVersion $ExpectedMigration
    Write-Host "Project Local production preflight passed for database postgres at migration $ExpectedMigration."
    return
  } finally {
    $preflightUrl = $null
    if (Test-Path -LiteralPath $preflightRoot) {
      Remove-Item -LiteralPath $preflightRoot -Recurse -Force
    }
  }
}

Assert-AgeRecipient -Recipient $AgeRecipient

$destination = Resolve-DefaultDestinationRoot
$dailyDestination = Join-Path $destination "daily"
$weeklyDestination = Join-Path $destination "weekly"
$statusDestination = Join-Path $destination "status"
Assert-NotRepositoryPath -Path $dailyDestination -Label "daily destination"
Assert-NotRepositoryPath -Path $weeklyDestination -Label "weekly destination"
Assert-NotRepositoryPath -Path $statusDestination -Label "status destination"

$supabase = $null
$docker = $null
$age = $null
$psql = $null
$dbUrl = $null
$workRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("project-local-production-backup-" + [guid]::NewGuid().ToString("N"))
$partialPath = $null
$archivePath = $null
$safeFailureCode = "backup_failed"

try {
  New-Item -ItemType Directory -Path $workRoot -Force | Out-Null
  $safeFailureCode = "dependency_preflight_failed"
  $supabase = Get-Command "supabase" -ErrorAction Stop
  $docker = Get-Command "docker" -ErrorAction Stop
  $age = Get-Command "age" -ErrorAction Stop
  $psql = Get-Command "psql" -ErrorAction Stop
  Invoke-CheckedProcess -FilePath $docker.Source -WorkingDirectory $workRoot -SafeFailureCode "docker_preflight" -ArgumentList @("version")

  $safeFailureCode = "secret_validation_failed"
  $dbUrl = Read-SecretUrl
  $safeFailureCode = "migration_preflight_failed"
  Invoke-ProjectLocalMigrationPreflight `
    -PsqlPath $psql.Source `
    -ConnectionUrl $dbUrl `
    -WorkingDirectory $workRoot `
    -ExpectedMigrationVersion $ExpectedMigration
  $dumpDir = Join-Path $workRoot "dump"
  New-Item -ItemType Directory -Path $dumpDir -Force | Out-Null

  $safeFailureCode = "logical_dump_failed"
  Invoke-CheckedProcess -FilePath $supabase.Source -WorkingDirectory $workRoot -SafeFailureCode "dump_roles" -ArgumentList @("db", "dump", "--db-url", $dbUrl, "-f", (Join-Path $dumpDir "roles.sql"), "--role-only")
  Invoke-CheckedProcess -FilePath $supabase.Source -WorkingDirectory $workRoot -SafeFailureCode "dump_schema" -ArgumentList @("db", "dump", "--db-url", $dbUrl, "-f", (Join-Path $dumpDir "schema.sql"))
  Invoke-CheckedProcess -FilePath $supabase.Source -WorkingDirectory $workRoot -SafeFailureCode "dump_data" -ArgumentList @("db", "dump", "--db-url", $dbUrl, "-f", (Join-Path $dumpDir "data.sql"), "--use-copy", "--data-only", "-x", "storage.buckets_vectors", "-x", "storage.vector_indexes")
  Invoke-CheckedProcess -FilePath $supabase.Source -WorkingDirectory $workRoot -SafeFailureCode "dump_migrations_schema" -ArgumentList @("db", "dump", "--db-url", $dbUrl, "-f", (Join-Path $dumpDir "supabase_migrations_schema.sql"), "--schema", "supabase_migrations")
  Invoke-CheckedProcess -FilePath $supabase.Source -WorkingDirectory $workRoot -SafeFailureCode "dump_migrations_data" -ArgumentList @("db", "dump", "--db-url", $dbUrl, "-f", (Join-Path $dumpDir "supabase_migrations_data.sql"), "--schema", "supabase_migrations", "--use-copy", "--data-only")

  $manifest = [ordered]@{
    backupFormatVersion = $BackupFormatVersion
    utcTimestamp = (Get-Date).ToUniversalTime().ToString("o")
    expectedProjectName = $ProjectName
    expectedProjectRef = $ProjectRef
    expectedMigration = $ExpectedMigration
    repositoryCommit = (git -C $RepositoryRoot rev-parse --short HEAD 2>$null)
    supabaseCliVersion = (& $supabase.Source --version 2>$null)
    dockerPreflight = "passed"
    migrationPreflight = "passed"
    ageVersion = (& $age.Source --version 2>$null)
    dumpFileSizes = [ordered]@{}
  }
  foreach ($name in @("roles.sql", "schema.sql", "data.sql", "supabase_migrations_schema.sql", "supabase_migrations_data.sql")) {
    $manifest.dumpFileSizes[$name] = (Get-Item -LiteralPath (Join-Path $dumpDir $name)).Length
  }
  $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $dumpDir "manifest.json") -Encoding UTF8

  $stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
  $nonce = [guid]::NewGuid().ToString("N").Substring(0, 8)
  $baseName = "project-local-production-$stamp-$nonce.zip"
  $archivePath = Join-Path $workRoot $baseName
  Compress-Archive -Path (Join-Path $dumpDir "*") -DestinationPath $archivePath -CompressionLevel Optimal
  if ((Get-Item -LiteralPath $archivePath).Length -le 0) { throw "archive_empty" }

  New-Item -ItemType Directory -Path $dailyDestination -Force | Out-Null
  New-Item -ItemType Directory -Path $weeklyDestination -Force | Out-Null
  New-Item -ItemType Directory -Path $statusDestination -Force | Out-Null

  $finalPath = Join-Path $dailyDestination "$baseName.age"
  $partialPath = "$finalPath.partial"
  if (Test-Path -LiteralPath $partialPath) { Remove-Item -LiteralPath $partialPath -Force }

  $safeFailureCode = "encryption_failed"
  Invoke-CheckedProcess -FilePath $age.Source -WorkingDirectory $workRoot -SafeFailureCode "age_encrypt" -ArgumentList @("-r", $AgeRecipient, "-o", $partialPath, $archivePath)
  $header = Get-Content -LiteralPath $partialPath -TotalCount 1
  if ($header -notlike "age-encryption.org/v1*") { throw "encrypted_artifact_not_age" }
  $size = (Get-Item -LiteralPath $partialPath).Length
  if ($size -le 0) { throw "encrypted_artifact_empty" }
  $hash = Get-Sha256Hex -Path $partialPath
  Move-Item -LiteralPath $partialPath -Destination $finalPath -Force
  $partialPath = $null

  if ((Get-Date).DayOfWeek.ToString() -eq $WeeklyPromotionDay) {
    Copy-Item -LiteralPath $finalPath -Destination (Join-Path $weeklyDestination (Split-Path -Leaf $finalPath)) -Force
  }
  $safeFailureCode = "status_or_retention_failed"
  Remove-RecognizedBackups -Directory $dailyDestination -Keep $DailyRetention
  Remove-RecognizedBackups -Directory $weeklyDestination -Keep $WeeklyRetention

  [void](Write-SafeStatus -StatusDirectory $statusDestination -Payload @{
    status = "success"
    encryptedFileName = Split-Path -Leaf $finalPath
    encryptedByteSize = $size
    sha256 = $hash
    safeFailureCode = $null
  })
  exit 0
} catch {
  if ($_.Exception.Message -match "^migration_preflight_(?:query_failed|output_invalid|history_invalid|mismatch|target_invalid)$") {
    $safeFailureCode = $_.Exception.Message
  }
  if ($partialPath -and (Test-Path -LiteralPath $partialPath)) {
    Remove-Item -LiteralPath $partialPath -Force
  }
  try {
    [void](Write-SafeStatus -StatusDirectory $statusDestination -Payload @{
      status = "failure"
      encryptedFileName = $null
      encryptedByteSize = $null
      sha256 = $null
      safeFailureCode = $safeFailureCode
    })
  } catch {}
  if ($NotifyOnFailure) {
    [void](Send-SafeFailureNotification -StatusDirectory $statusDestination -SafeFailureCode $safeFailureCode)
  }
  throw "Project Local production backup failed with a safe failure code."
} finally {
  $dbUrl = $null
  if ($archivePath -and (Test-Path -LiteralPath $archivePath)) { Remove-Item -LiteralPath $archivePath -Force }
  if (Test-Path -LiteralPath $workRoot) { Remove-Item -LiteralPath $workRoot -Recurse -Force }
}
