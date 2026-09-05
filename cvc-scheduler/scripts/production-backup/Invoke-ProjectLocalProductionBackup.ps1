param(
  [switch]$ExecuteProductionBackup,
  [switch]$ExecuteProductionPreflight,
  [switch]$FixtureMode,
  [ValidateSet("GuardMissingOptIn", "GuardStagingRef", "GuardProductionMigrationContract", "GuardRepoDestination", "GuardMissingRecipient", "GuardMissingSecret", "GuardMalformedSecret", "ValidateConnectionUrl", "Retention", "CleanupAfterFailure", "StatusRedaction", "SafeInjectedFailure", "MigrationPreflightExpected", "MigrationPreflightFutureExpected", "MigrationPreflightPrivilegeHardeningExpected", "MigrationPreflightOperationalUsabilityExpected", "MigrationPreflightOperationalUsabilityPrivilegeHardeningExpected", "MigrationPreflightTransitionPending", "MigrationPreflightPrivilegeHardeningTransitionPending", "MigrationPreflightOperationalUsabilityTransitionPending", "MigrationPreflightOperationalUsabilityPrivilegeHardeningTransitionPending", "MigrationPreflightPartialProjectDay", "MigrationPreflightPartialAnonRevoke", "MigrationPreflightWrong", "MigrationPreflightMissing", "MigrationPreflightMalformed", "MigrationPreflightQueryFailure", "MigrationPreflightLoopback", "NativeDumpPackageLoopback", "NativeDumpConnectionFailure", "NativeDumpAuthenticationFailure", "NativeDumpLaunchFailure")]
  [string]$FixtureScenario,
  [string]$FixtureConnectionUrl,
  [string]$FixturePgDumpPath,
  [string]$FixturePgDumpAllPath,
  [string]$FixtureArgumentAuditPath,
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
$BackupFormatVersion = "project-local.logical-backup.v1"
. (Join-Path $ScriptRoot "ProjectLocalProductionMigrationContract.ps1")
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
    if ($ProjectName -ne $ExpectedProjectName -or $ProjectRef -ne $ExpectedProjectRef -or -not (Test-ProjectLocalApprovedTerminalMigration -Migration $ExpectedMigration)) {
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
    $null -eq $result.PSObject.Properties["migration_relation_present"] -or
    $null -eq $result.PSObject.Properties["terminal_migration"] -or
    $result.database_name -isnot [string] -or
    $result.migration_relation_present -isnot [bool]
  ) {
    throw "migration_preflight_history_invalid"
  }
  if ($result.database_name -cne "postgres") {
    throw "migration_preflight_mismatch"
  }
  if (-not $result.migration_relation_present) {
    throw "migration_preflight_history_missing"
  }
  if (
    $result.terminal_migration -isnot [string] -or
    $result.terminal_migration -notmatch "^[0-9]{14}$"
  ) {
    throw "migration_preflight_history_invalid"
  }
  if (
    $result.terminal_migration -cne $ExpectedMigrationVersion
  ) {
    if (Test-ProjectLocalPartialMigrationTerminal -Migration $result.terminal_migration) {
      throw "migration_preflight_partial_terminal"
    }
    if (
      (
        $ExpectedMigrationVersion -ceq $FollowUpContactProductionMigration -and
        $result.terminal_migration -ceq $ProjectQuickViewProductionMigration
      ) -or (
        $ExpectedMigrationVersion -ceq $ProjectQuickViewProductionMigration -and
        $result.terminal_migration -ceq $ProjectQuickViewPrivilegeHardeningProductionMigration
      ) -or (
        $ExpectedMigrationVersion -ceq $ProjectQuickViewPrivilegeHardeningProductionMigration -and
        $result.terminal_migration -ceq $OperationalUsabilityProductionMigration
      ) -or (
        $ExpectedMigrationVersion -ceq $OperationalUsabilityProductionMigration -and
        $result.terminal_migration -ceq $OperationalUsabilityPrivilegeHardeningProductionMigration
      )
    ) {
      throw "migration_lock_transition_pending"
    }
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
SELECT (to_regclass('supabase_migrations.schema_migrations') IS NOT NULL) AS migration_relation_present \gset
\if :migration_relation_present
SELECT json_build_object(
  'database_name', current_database(),
  'migration_relation_present', true,
  'terminal_migration', (
    SELECT version::text
    FROM supabase_migrations.schema_migrations
    ORDER BY version DESC
    LIMIT 1
  )
)::text;
\else
SELECT json_build_object(
  'database_name', current_database(),
  'migration_relation_present', false,
  'terminal_migration', NULL
)::text;
\endif
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

function Get-ProjectLocalDumpConnectionParts {
  param(
    [Parameter(Mandatory = $true)][string]$ConnectionUrl,
    [switch]$AllowLoopbackFixture
  )
  $uri = $null
  try {
    $uri = [System.Uri]$ConnectionUrl
  } catch {
    throw "dump_target_invalid"
  }
  if (
    -not $uri.IsAbsoluteUri -or
    $uri.Scheme -notin @("postgres", "postgresql") -or
    -not [string]::IsNullOrEmpty($uri.Query) -or
    -not [string]::IsNullOrEmpty($uri.Fragment) -or
    $uri.AbsolutePath -cne "/postgres"
  ) {
    throw "dump_target_invalid"
  }
  $separatorIndex = $uri.UserInfo.IndexOf(":", [System.StringComparison]::Ordinal)
  if ($separatorIndex -lt 1) { throw "dump_target_invalid" }
  $userName = $uri.UserInfo.Substring(0, $separatorIndex)
  $password = [System.Uri]::UnescapeDataString($uri.UserInfo.Substring($separatorIndex + 1))
  if ([string]::IsNullOrEmpty($password)) { throw "dump_target_invalid" }
  if ($AllowLoopbackFixture) {
    if ($uri.Host -notin @("127.0.0.1", "localhost")) {
      throw "dump_fixture_target_invalid"
    }
  } elseif (
    $uri.Host -notmatch "\.pooler\.supabase\.com$" -or
    $uri.Port -ne 5432 -or
    $userName -cne "postgres.$ExpectedProjectRef" -or
    $ConnectionUrl.IndexOf($ForbiddenStagingRef, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  ) {
    throw "dump_target_invalid"
  }
  return [pscustomobject]@{
    Host = $uri.Host
    Port = $uri.Port
    Database = "postgres"
    UserName = $userName
    Password = $password
    SslMode = if ($AllowLoopbackFixture) { "disable" } else { "require" }
  }
}

function Write-ProjectLocalDumpArgumentAudit {
  param(
    [string]$AuditPath,
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string[]]$ArgumentList,
    [Parameter(Mandatory = $true)][System.Diagnostics.ProcessStartInfo]$StartInfo,
    [Parameter(Mandatory = $true)][string]$Password
  )
  if ([string]::IsNullOrWhiteSpace($AuditPath)) { return }
  if (-not $FixtureMode) { throw "dump_argument_audit_fixture_only" }
  $fullAuditPath = [System.IO.Path]::GetFullPath($AuditPath)
  Assert-NotRepositoryPath -Path $fullAuditPath -Label "dump argument audit"
  $auditParent = Split-Path -Parent $fullAuditPath
  New-Item -ItemType Directory -Path $auditParent -Force | Out-Null
  $argumentText = $ArgumentList -join " "
  $record = [ordered]@{
    record_type = "process_arguments"
    label = $Label
    executable_name = [System.IO.Path]::GetFileName($StartInfo.FileName)
    arguments = $ArgumentList
    password_environment_present = $StartInfo.EnvironmentVariables["PGPASSWORD"] -ceq $Password
    fixture_url_environment_absent = -not $StartInfo.EnvironmentVariables.ContainsKey("PROJECT_LOCAL_NATIVE_DUMP_FIXTURE_URL")
    password_argument_present = $argumentText.IndexOf($Password, [System.StringComparison]::Ordinal) -ge 0
    credential_uri_argument_present = $argumentText -match "postgres(?:ql)?://"
    ssl_mode = $StartInfo.EnvironmentVariables["PGSSLMODE"]
  }
  [System.IO.File]::AppendAllText(
    $fullAuditPath,
    (($record | ConvertTo-Json -Depth 5 -Compress) + [Environment]::NewLine),
    (New-Object System.Text.UTF8Encoding($false))
  )
}

function Write-ProjectLocalDumpEnvironmentAudit {
  param(
    [string]$AuditPath,
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][hashtable]$Before
  )
  if ([string]::IsNullOrWhiteSpace($AuditPath)) { return }
  if (-not $FixtureMode) { throw "dump_argument_audit_fixture_only" }
  $fullAuditPath = [System.IO.Path]::GetFullPath($AuditPath)
  Assert-NotRepositoryPath -Path $fullAuditPath -Label "dump environment audit"
  $restored = $true
  foreach ($name in $Before.Keys) {
    if ([Environment]::GetEnvironmentVariable($name, "Process") -cne $Before[$name]) {
      $restored = $false
    }
  }
  $record = [ordered]@{
    record_type = "parent_environment"
    label = $Label
    parent_environment_restored = $restored
    pgpassword_present_before = $null -ne $Before["PGPASSWORD"]
    pgpassword_present_after = $null -ne [Environment]::GetEnvironmentVariable("PGPASSWORD", "Process")
    pgsslmode_present_before = $null -ne $Before["PGSSLMODE"]
    pgsslmode_present_after = $null -ne [Environment]::GetEnvironmentVariable("PGSSLMODE", "Process")
  }
  [System.IO.File]::AppendAllText(
    $fullAuditPath,
    (($record | ConvertTo-Json -Depth 5 -Compress) + [Environment]::NewLine),
    (New-Object System.Text.UTF8Encoding($false))
  )
}

function Invoke-ProjectLocalNativeDumpProcess {
  param(
    [Parameter(Mandatory = $true)][string]$ExecutablePath,
    [Parameter(Mandatory = $true)][string[]]$ArgumentList,
    [Parameter(Mandatory = $true)][pscustomobject]$Connection,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [Parameter(Mandatory = $true)][ValidatePattern("^[a-z][a-z0-9_]+$")][string]$Label,
    [string]$ArgumentAuditPath
  )
  $parentEnvironment = @{}
  foreach ($name in @("PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGSSLMODE", "PGOPTIONS", "PGCONNECT_TIMEOUT", "PROJECT_LOCAL_NATIVE_DUMP_FIXTURE_URL")) {
    $parentEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
  }
  if (-not (Test-Path -LiteralPath $ExecutablePath -PathType Leaf)) {
    Write-ProjectLocalDumpEnvironmentAudit -AuditPath $ArgumentAuditPath -Label $Label -Before $parentEnvironment
    throw "dump_executable_unavailable_$Label"
  }
  $argumentText = $ArgumentList -join " "
  if (
    $argumentText.IndexOf($Connection.Password, [System.StringComparison]::Ordinal) -ge 0 -or
    $argumentText -match "postgres(?:ql)?://"
  ) {
    throw "dump_argument_secret_detected_$Label"
  }
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo.FileName = $ExecutablePath
  $process.StartInfo.WorkingDirectory = $WorkingDirectory
  $process.StartInfo.Arguments = ConvertTo-NativeArgumentString -ArgumentList $ArgumentList
  $process.StartInfo.RedirectStandardOutput = $true
  $process.StartInfo.RedirectStandardError = $true
  $process.StartInfo.UseShellExecute = $false
  $process.StartInfo.EnvironmentVariables["PGHOST"] = $Connection.Host
  $process.StartInfo.EnvironmentVariables["PGPORT"] = [string]$Connection.Port
  $process.StartInfo.EnvironmentVariables["PGDATABASE"] = $Connection.Database
  $process.StartInfo.EnvironmentVariables["PGUSER"] = $Connection.UserName
  $process.StartInfo.EnvironmentVariables["PGPASSWORD"] = $Connection.Password
  $process.StartInfo.EnvironmentVariables["PGSSLMODE"] = $Connection.SslMode
  $process.StartInfo.EnvironmentVariables["PGOPTIONS"] = "-c default_transaction_read_only=on"
  $process.StartInfo.EnvironmentVariables["PGCONNECT_TIMEOUT"] = "10"
  [void]$process.StartInfo.EnvironmentVariables.Remove("PROJECT_LOCAL_NATIVE_DUMP_FIXTURE_URL")
  $stdout = $null
  $stderr = $null
  try {
    Write-ProjectLocalDumpArgumentAudit `
      -AuditPath $ArgumentAuditPath `
      -Label $Label `
      -ArgumentList $ArgumentList `
      -StartInfo $process.StartInfo `
      -Password $Connection.Password
    try {
      [void]$process.Start()
    } catch {
      throw "dump_process_launch_failed_$Label"
    }
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) {
      if ($stderr -match '(?i)(password authentication failed|authentication failed|no password supplied|connection to server .* failed|could not connect|connection refused|connection timed out|timeout expired|could not translate host name|server closed the connection unexpectedly)') {
        throw "dump_connection_or_authentication_failed_$Label"
      }
      throw "dump_process_failed_$Label"
    }
    if (-not (Test-Path -LiteralPath $OutputPath -PathType Leaf)) {
      throw "dump_output_missing_$Label"
    }
    if ((Get-Item -LiteralPath $OutputPath).Length -le 0) {
      throw "dump_output_empty_$Label"
    }
  } finally {
    foreach ($name in @("PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGSSLMODE", "PGOPTIONS", "PGCONNECT_TIMEOUT", "PROJECT_LOCAL_NATIVE_DUMP_FIXTURE_URL")) {
      [void]$process.StartInfo.EnvironmentVariables.Remove($name)
    }
    Write-ProjectLocalDumpEnvironmentAudit -AuditPath $ArgumentAuditPath -Label $Label -Before $parentEnvironment
    $stdout = $null
    $stderr = $null
    $argumentText = $null
    $process.Dispose()
  }
}

function Convert-ProjectLocalNativeDumpOutput {
  param(
    [Parameter(Mandatory = $true)][string]$RawPath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [Parameter(Mandatory = $true)][ValidateSet("roles", "schema", "data", "migrations_schema", "migrations_data")][string]$Kind
  )
  $reader = $null
  $writer = $null
  try {
    $reader = New-Object System.IO.StreamReader($RawPath, [System.Text.Encoding]::UTF8, $true)
    $writer = New-Object System.IO.StreamWriter($OutputPath, $false, (New-Object System.Text.UTF8Encoding($false)))
    if ($Kind -in @("data", "migrations_data")) {
      $writer.WriteLine("SET session_replication_role = replica;")
      $writer.WriteLine("")
    }
    $previousRoleLine = $null
    while (-not $reader.EndOfStream) {
      $line = $reader.ReadLine()
      if ($line -match '^\\(?:un)?restrict .*$') { $line = "-- $line" }
      if ($Kind -eq "roles") {
        if ($line -match '^CREATE ROLE "(anon|authenticated|authenticator|cli_login_.*|dashboard_user|pgbouncer|postgres|service_role|supabase_.*|pgsodium_keyholder|pgsodium_keyiduser|pgsodium_keymaker|pgtle_admin)"') { $line = "-- $line" }
        if ($line -match '^ALTER ROLE "(anon|authenticated|authenticator|cli_login_.*|dashboard_user|pgbouncer|postgres|service_role|supabase_.*|pgsodium_keyholder|pgsodium_keyiduser|pgsodium_keymaker|pgtle_admin)"') { $line = "-- $line" }
        $line = [regex]::Replace($line, ' (NOSUPERUSER|NOREPLICATION)', '')
        $line = [regex]::Replace($line, '^-- (.* SET "(pgaudit.*|pgrst.*|session_replication_role|statement_timeout|track_io_timing)" .*)', '$1')
        if ($line -match 'GRANT ".*" TO "(anon|authenticated|authenticator|cli_login_.*|dashboard_user|pgbouncer|postgres|service_role|supabase_.*|pgsodium_keyholder|pgsodium_keyiduser|pgsodium_keymaker|pgtle_admin)"') { $line = "-- $line" }
        if ($line -match '^--') { continue }
        if ($null -ne $previousRoleLine -and $line -ceq $previousRoleLine) { continue }
        $previousRoleLine = $line
      } elseif ($Kind -in @("schema", "migrations_schema")) {
        $line = [regex]::Replace($line, '^CREATE SCHEMA "', 'CREATE SCHEMA IF NOT EXISTS "')
        $line = [regex]::Replace($line, '^CREATE TABLE "', 'CREATE TABLE IF NOT EXISTS "')
        $line = [regex]::Replace($line, '^CREATE SEQUENCE "', 'CREATE SEQUENCE IF NOT EXISTS "')
        $line = [regex]::Replace($line, '^CREATE VIEW "', 'CREATE OR REPLACE VIEW "')
        $line = [regex]::Replace($line, '^CREATE FUNCTION "', 'CREATE OR REPLACE FUNCTION "')
        $line = [regex]::Replace($line, '^CREATE TRIGGER "', 'CREATE OR REPLACE TRIGGER "')
        if ($line -match '^CREATE PUBLICATION "supabase_realtime') { $line = "-- $line" }
        if ($line -match '^CREATE EVENT TRIGGER |^         WHEN TAG IN |^   EXECUTE FUNCTION |^ALTER EVENT TRIGGER |^ALTER PUBLICATION "supabase_realtime_|^ALTER FOREIGN DATA WRAPPER |^ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"|^GRANT ALL ON FOREIGN DATA WRAPPER .* TO "postgres" WITH GRANT OPTION') { $line = "-- $line" }
        if ($Kind -eq "schema") {
          $internalSchemaPattern = '(information_schema|pg_.*|_analytics|_realtime|_supavisor|auth|etl|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_.*|_timescaledb_.*|topology|vault)'
          if ($line -match ('^GRANT .* ON .* "' + $internalSchemaPattern + '"') -or $line -match ('^REVOKE .* ON .* "' + $internalSchemaPattern + '"')) { $line = "-- $line" }
        }
        $line = [regex]::Replace($line, '^(CREATE EXTENSION IF NOT EXISTS "(?:pg_tle|pgsodium|pgmq)").*', '$1;')
        if ($line -match '^COMMENT ON EXTENSION |^CREATE POLICY "cron_job_|^ALTER TABLE "cron"|^SET transaction_timeout = 0;') { $line = "-- $line" }
        if ($line -match '^--') { continue }
      }
      $writer.WriteLine($line)
    }
    if ($Kind -in @("roles", "data", "migrations_data")) {
      $writer.WriteLine("RESET ALL;")
    }
  } catch {
    throw "dump_package_construction_failed_$Kind"
  } finally {
    if ($null -ne $writer) { $writer.Dispose() }
    if ($null -ne $reader) { $reader.Dispose() }
    if (Test-Path -LiteralPath $RawPath) { Remove-Item -LiteralPath $RawPath -Force }
  }
  if (-not (Test-Path -LiteralPath $OutputPath -PathType Leaf)) {
    throw "dump_output_missing_$Kind"
  }
  if ((Get-Item -LiteralPath $OutputPath).Length -le 0) {
    throw "dump_output_empty_$Kind"
  }
}

function Invoke-ProjectLocalNativeDumpPackage {
  param(
    [Parameter(Mandatory = $true)][string]$PgDumpPath,
    [Parameter(Mandatory = $true)][string]$PgDumpAllPath,
    [Parameter(Mandatory = $true)][string]$ConnectionUrl,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$DumpDirectory,
    [switch]$AllowLoopbackFixture,
    [string]$ArgumentAuditPath
  )
  $connection = Get-ProjectLocalDumpConnectionParts -ConnectionUrl $ConnectionUrl -AllowLoopbackFixture:$AllowLoopbackFixture
  try {
    New-Item -ItemType Directory -Path $DumpDirectory -Force | Out-Null
    $common = @("--host", $connection.Host, "--port", [string]$connection.Port, "--username", $connection.UserName)
    $rawRoles = Join-Path $WorkingDirectory "raw-roles.sql"
    Invoke-ProjectLocalNativeDumpProcess -ExecutablePath $PgDumpAllPath -Connection $connection -WorkingDirectory $WorkingDirectory -OutputPath $rawRoles -Label "roles" -ArgumentAuditPath $ArgumentAuditPath -ArgumentList ($common + @("--database", $connection.Database, "--roles-only", "--role", "postgres", "--quote-all-identifiers", "--no-role-passwords", "--no-comments", "--file", $rawRoles))
    Convert-ProjectLocalNativeDumpOutput -RawPath $rawRoles -OutputPath (Join-Path $DumpDirectory "roles.sql") -Kind "roles"

    $rawSchema = Join-Path $WorkingDirectory "raw-schema.sql"
    $excludedSchemas = "information_schema|pg_*|_analytics|_realtime|_supavisor|auth|etl|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault"
    Invoke-ProjectLocalNativeDumpProcess -ExecutablePath $PgDumpPath -Connection $connection -WorkingDirectory $WorkingDirectory -OutputPath $rawSchema -Label "schema" -ArgumentAuditPath $ArgumentAuditPath -ArgumentList ($common + @("--dbname", $connection.Database, "--schema-only", "--quote-all-identifiers", "--role", "postgres", "--exclude-schema", $excludedSchemas, "--file", $rawSchema))
    Convert-ProjectLocalNativeDumpOutput -RawPath $rawSchema -OutputPath (Join-Path $DumpDirectory "schema.sql") -Kind "schema"

    $rawData = Join-Path $WorkingDirectory "raw-data.sql"
    $excludedDataSchemas = "information_schema|pg_*|graphql|graphql_public|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault|etl|extensions|pgbouncer|realtime|supabase_migrations|_analytics|_realtime|_supavisor"
    Invoke-ProjectLocalNativeDumpProcess -ExecutablePath $PgDumpPath -Connection $connection -WorkingDirectory $WorkingDirectory -OutputPath $rawData -Label "data" -ArgumentAuditPath $ArgumentAuditPath -ArgumentList ($common + @("--dbname", $connection.Database, "--data-only", "--quote-all-identifiers", "--role", "postgres", "--exclude-schema", $excludedDataSchemas, "--exclude-table", "auth.schema_migrations", "--exclude-table", "storage.migrations", "--exclude-table", "supabase_functions.migrations", "--schema", "*", "--exclude-table", "storage.buckets_vectors", "--exclude-table", "storage.vector_indexes", "--file", $rawData))
    Convert-ProjectLocalNativeDumpOutput -RawPath $rawData -OutputPath (Join-Path $DumpDirectory "data.sql") -Kind "data"

    $rawMigrationsSchema = Join-Path $WorkingDirectory "raw-migrations-schema.sql"
    Invoke-ProjectLocalNativeDumpProcess -ExecutablePath $PgDumpPath -Connection $connection -WorkingDirectory $WorkingDirectory -OutputPath $rawMigrationsSchema -Label "migrations_schema" -ArgumentAuditPath $ArgumentAuditPath -ArgumentList ($common + @("--dbname", $connection.Database, "--schema-only", "--quote-all-identifiers", "--role", "postgres", "--schema", "supabase_migrations", "--file", $rawMigrationsSchema))
    Convert-ProjectLocalNativeDumpOutput -RawPath $rawMigrationsSchema -OutputPath (Join-Path $DumpDirectory "supabase_migrations_schema.sql") -Kind "migrations_schema"

    $rawMigrationsData = Join-Path $WorkingDirectory "raw-migrations-data.sql"
    Invoke-ProjectLocalNativeDumpProcess -ExecutablePath $PgDumpPath -Connection $connection -WorkingDirectory $WorkingDirectory -OutputPath $rawMigrationsData -Label "migrations_data" -ArgumentAuditPath $ArgumentAuditPath -ArgumentList ($common + @("--dbname", $connection.Database, "--data-only", "--quote-all-identifiers", "--role", "postgres", "--exclude-table", "auth.schema_migrations", "--exclude-table", "storage.migrations", "--exclude-table", "supabase_functions.migrations", "--schema", "supabase_migrations", "--file", $rawMigrationsData))
    Convert-ProjectLocalNativeDumpOutput -RawPath $rawMigrationsData -OutputPath (Join-Path $DumpDirectory "supabase_migrations_data.sql") -Kind "migrations_data"
  } finally {
    $connection.Password = $null
    $connection = $null
  }
}

function Write-ProjectLocalDumpManifest {
  param(
    [Parameter(Mandatory = $true)][string]$DumpDirectory,
    [Parameter(Mandatory = $true)][string]$PgDumpPath,
    [Parameter(Mandatory = $true)][string]$PgDumpAllPath,
    [Parameter(Mandatory = $true)][string]$ManifestProjectName,
    [Parameter(Mandatory = $true)][string]$ManifestProjectRef,
    [Parameter(Mandatory = $true)][string]$ManifestMigration,
    [Parameter(Mandatory = $true)][string]$MigrationPreflightStatus,
    [string]$AgeVersion
  )
  $manifest = [ordered]@{
    backupFormatVersion = $BackupFormatVersion
    utcTimestamp = (Get-Date).ToUniversalTime().ToString("o")
    expectedProjectName = $ManifestProjectName
    expectedProjectRef = $ManifestProjectRef
    expectedMigration = $ManifestMigration
    repositoryCommit = (git -C $RepositoryRoot rev-parse --short HEAD 2>$null)
    dumpTool = "postgresql-native"
    pgDumpVersion = (& $PgDumpPath --version 2>$null)
    pgDumpAllVersion = (& $PgDumpAllPath --version 2>$null)
    dockerPreflight = "not_required_native_dump"
    migrationPreflight = $MigrationPreflightStatus
    ageVersion = $AgeVersion
    dumpFileSizes = [ordered]@{}
  }
  foreach ($name in @("roles.sql", "schema.sql", "data.sql", "supabase_migrations_schema.sql", "supabase_migrations_data.sql")) {
    $path = Join-Path $DumpDirectory $name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "dump_output_missing_manifest" }
    if ((Get-Item -LiteralPath $path).Length -le 0) { throw "dump_output_empty_manifest" }
    $manifest.dumpFileSizes[$name] = (Get-Item -LiteralPath $path).Length
  }
  [System.IO.File]::WriteAllText(
    (Join-Path $DumpDirectory "manifest.json"),
    ($manifest | ConvertTo-Json -Depth 6),
    (New-Object System.Text.UTF8Encoding($false))
  )
}

function Assert-ProjectLocalNativeDumpFixturePackage {
  param([Parameter(Mandatory = $true)][string]$DumpDirectory, [Parameter(Mandatory = $true)][string]$WorkingDirectory)
  $expected = @("data.sql", "manifest.json", "roles.sql", "schema.sql", "supabase_migrations_data.sql", "supabase_migrations_schema.sql")
  $actual = @(Get-ChildItem -LiteralPath $DumpDirectory -File | Select-Object -ExpandProperty Name | Sort-Object)
  if (($actual -join "|") -cne ($expected -join "|")) { throw "dump_fixture_package_members_invalid" }
  foreach ($name in $expected) {
    if ((Get-Item -LiteralPath (Join-Path $DumpDirectory $name)).Length -le 0) { throw "dump_fixture_package_file_empty" }
  }
  $roles = [System.IO.File]::ReadAllText((Join-Path $DumpDirectory "roles.sql"))
  $schema = [System.IO.File]::ReadAllText((Join-Path $DumpDirectory "schema.sql"))
  $data = [System.IO.File]::ReadAllText((Join-Path $DumpDirectory "data.sql"))
  $migrationSchema = [System.IO.File]::ReadAllText((Join-Path $DumpDirectory "supabase_migrations_schema.sql"))
  $migrationData = [System.IO.File]::ReadAllText((Join-Path $DumpDirectory "supabase_migrations_data.sql"))
  if ($roles -notmatch 'CREATE ROLE "project_local_dump_fixture_role"' -or $roles -notmatch 'RESET ALL;' -or $roles -match '(?i)PASSWORD\s+') { throw "dump_fixture_roles_semantics_invalid" }
  if ($schema -notmatch 'CREATE TABLE IF NOT EXISTS "public"\."project_local_dump_fixture"' -or $schema -match 'fixture-public-row') { throw "dump_fixture_schema_semantics_invalid" }
  if ($data -notmatch 'COPY "public"\."project_local_dump_fixture"' -or $data -notmatch 'fixture-public-row' -or $data -notmatch 'fixture-auth-row' -or $data -notmatch 'fixture-storage-row' -or $data -match 'fixture-vector-excluded' -or $data -match '20991231235959') { throw "dump_fixture_data_semantics_invalid" }
  if ($migrationSchema -notmatch 'CREATE TABLE IF NOT EXISTS "supabase_migrations"\."schema_migrations"') { throw "dump_fixture_migration_schema_semantics_invalid" }
  if ($migrationData -notmatch 'COPY "supabase_migrations"\."schema_migrations"' -or $migrationData -notmatch '20991231235959') { throw "dump_fixture_migration_data_semantics_invalid" }
  $manifest = Get-Content -LiteralPath (Join-Path $DumpDirectory "manifest.json") -Raw | ConvertFrom-Json
  if ($manifest.backupFormatVersion -cne $BackupFormatVersion -or $manifest.dumpTool -cne "postgresql-native") { throw "dump_fixture_manifest_semantics_invalid" }
  $zipPath = Join-Path $WorkingDirectory "fixture-package.zip"
  Compress-Archive -Path (Join-Path $DumpDirectory "*") -DestinationPath $zipPath -CompressionLevel Optimal
  if ((Get-Item -LiteralPath $zipPath).Length -le 0) { throw "dump_fixture_archive_empty" }
  $firstHash = Get-Sha256Hex -Path $zipPath
  $secondHash = Get-Sha256Hex -Path $zipPath
  if ($firstHash -cne $secondHash -or $firstHash -notmatch '^[a-f0-9]{64}$') { throw "dump_fixture_checksum_invalid" }
  $expanded = Join-Path $WorkingDirectory "expanded"
  Expand-Archive -LiteralPath $zipPath -DestinationPath $expanded -Force
  $expandedNames = @(Get-ChildItem -LiteralPath $expanded -File | Select-Object -ExpandProperty Name | Sort-Object)
  if (($expandedNames -join "|") -cne ($expected -join "|")) { throw "dump_fixture_archive_members_invalid" }
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

function Read-ProjectLocalNativeDumpFixtureUrl {
  if (-not $FixtureMode) { throw "dump_fixture_url_fixture_only" }
  $value = $env:PROJECT_LOCAL_NATIVE_DUMP_FIXTURE_URL
  Remove-Item Env:PROJECT_LOCAL_NATIVE_DUMP_FIXTURE_URL -ErrorAction SilentlyContinue
  if ([string]::IsNullOrWhiteSpace($value)) { $value = $FixtureConnectionUrl }
  if ([string]::IsNullOrWhiteSpace($value)) { throw "dump_fixture_url_missing" }
  return $value
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
      "GuardProductionMigrationContract" {
        $script:FixtureMode = $false
        $script:ExecuteProductionPreflight = $true
        Assert-SafeTarget
        "fixture_production_migration_contract_ok"
        return
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
          -Output '{"database_name":"postgres","migration_relation_present":true,"terminal_migration":"20260824123500"}' `
          -ExpectedMigrationVersion "20260824123500"
        "fixture_migration_preflight_expected_ok"
        return
      }
      "MigrationPreflightFutureExpected" {
        Assert-MigrationPreflightProcessResult `
          -ExitCode 0 `
          -Output '{"database_name":"postgres","migration_relation_present":true,"terminal_migration":"20260902120000"}' `
          -ExpectedMigrationVersion "20260902120000"
        "fixture_migration_preflight_future_expected_ok"
        return
      }
      "MigrationPreflightPrivilegeHardeningExpected" {
        Assert-MigrationPreflightProcessResult `
          -ExitCode 0 `
          -Output '{"database_name":"postgres","migration_relation_present":true,"terminal_migration":"20260903120000"}' `
          -ExpectedMigrationVersion "20260903120000"
        "fixture_migration_preflight_privilege_hardening_expected_ok"
        return
      }
      "MigrationPreflightOperationalUsabilityExpected" {
        Assert-MigrationPreflightProcessResult `
          -ExitCode 0 `
          -Output '{"database_name":"postgres","migration_relation_present":true,"terminal_migration":"20260904120000"}' `
          -ExpectedMigrationVersion "20260904120000"
        "fixture_migration_preflight_operational_usability_expected_ok"
        return
      }
      "MigrationPreflightOperationalUsabilityPrivilegeHardeningExpected" {
        Assert-MigrationPreflightProcessResult `
          -ExitCode 0 `
          -Output '{"database_name":"postgres","migration_relation_present":true,"terminal_migration":"20260904130000"}' `
          -ExpectedMigrationVersion "20260904130000"
        "fixture_migration_preflight_operational_usability_privilege_hardening_expected_ok"
        return
      }
      "MigrationPreflightTransitionPending" {
        try {
          Assert-MigrationPreflightProcessResult `
            -ExitCode 0 `
            -Output '{"database_name":"postgres","migration_relation_present":true,"terminal_migration":"20260902120000"}' `
            -ExpectedMigrationVersion "20260824123500"
          throw "fixture_pending_transition_not_rejected"
        } catch {
          if ($_.Exception.Message -cne "migration_lock_transition_pending") { throw }
        }
        "fixture_migration_preflight_transition_pending_rejected"
        return
      }
      "MigrationPreflightPrivilegeHardeningTransitionPending" {
        try {
          Assert-MigrationPreflightProcessResult `
            -ExitCode 0 `
            -Output '{"database_name":"postgres","migration_relation_present":true,"terminal_migration":"20260903120000"}' `
            -ExpectedMigrationVersion "20260902120000"
          throw "fixture_privilege_hardening_pending_transition_not_rejected"
        } catch {
          if ($_.Exception.Message -cne "migration_lock_transition_pending") { throw }
        }
        "fixture_migration_preflight_privilege_hardening_transition_pending_rejected"
        return
      }
      "MigrationPreflightOperationalUsabilityTransitionPending" {
        try {
          Assert-MigrationPreflightProcessResult `
            -ExitCode 0 `
            -Output '{"database_name":"postgres","migration_relation_present":true,"terminal_migration":"20260904120000"}' `
            -ExpectedMigrationVersion "20260903120000"
          throw "fixture_operational_usability_pending_transition_not_rejected"
        } catch {
          if ($_.Exception.Message -cne "migration_lock_transition_pending") { throw }
        }
        "fixture_migration_preflight_operational_usability_transition_pending_rejected"
        return
      }
      "MigrationPreflightOperationalUsabilityPrivilegeHardeningTransitionPending" {
        try {
          Assert-MigrationPreflightProcessResult `
            -ExitCode 0 `
            -Output '{"database_name":"postgres","migration_relation_present":true,"terminal_migration":"20260904130000"}' `
            -ExpectedMigrationVersion "20260904120000"
          throw "fixture_operational_usability_privilege_hardening_pending_transition_not_rejected"
        } catch {
          if ($_.Exception.Message -cne "migration_lock_transition_pending") { throw }
        }
        "fixture_migration_preflight_operational_usability_privilege_hardening_transition_pending_rejected"
        return
      }
      "MigrationPreflightPartialProjectDay" {
        try {
          Assert-MigrationPreflightProcessResult `
            -ExitCode 0 `
            -Output '{"database_name":"postgres","migration_relation_present":true,"terminal_migration":"20260829130000"}' `
            -ExpectedMigrationVersion "20260824123500"
          throw "fixture_partial_project_day_not_rejected"
        } catch {
          if ($_.Exception.Message -cne "migration_preflight_partial_terminal") { throw }
        }
        "fixture_migration_preflight_partial_project_day_rejected"
        return
      }
      "MigrationPreflightPartialAnonRevoke" {
        try {
          Assert-MigrationPreflightProcessResult `
            -ExitCode 0 `
            -Output '{"database_name":"postgres","migration_relation_present":true,"terminal_migration":"20260901120000"}' `
            -ExpectedMigrationVersion "20260824123500"
          throw "fixture_partial_anon_revoke_not_rejected"
        } catch {
          if ($_.Exception.Message -cne "migration_preflight_partial_terminal") { throw }
        }
        "fixture_migration_preflight_partial_anon_revoke_rejected"
        return
      }
      "MigrationPreflightWrong" {
        try {
          Assert-MigrationPreflightProcessResult `
            -ExitCode 0 `
            -Output '{"database_name":"postgres","migration_relation_present":true,"terminal_migration":"20260714122229"}' `
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
            -Output '{"database_name":"postgres","migration_relation_present":false,"terminal_migration":null}' `
            -ExpectedMigrationVersion "20260714122230"
          throw "fixture_missing_migration_not_rejected"
        } catch {
          if ($_.Exception.Message -cne "migration_preflight_history_missing") { throw }
        }
        "fixture_migration_preflight_missing_rejected"
        return
      }
      "MigrationPreflightMalformed" {
        try {
          Assert-MigrationPreflightProcessResult `
            -ExitCode 0 `
            -Output '{"database_name":"postgres","migration_relation_present":true,"terminal_migration":"not-a-migration"}' `
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
      "NativeDumpPackageLoopback" {
        $fixtureDumpUrl = Read-ProjectLocalNativeDumpFixtureUrl
        try {
          $pgDump = if ([string]::IsNullOrWhiteSpace($FixturePgDumpPath)) { (Get-Command "pg_dump" -ErrorAction Stop).Source } else { $FixturePgDumpPath }
          $pgDumpAll = if ([string]::IsNullOrWhiteSpace($FixturePgDumpAllPath)) { (Get-Command "pg_dumpall" -ErrorAction Stop).Source } else { $FixturePgDumpAllPath }
          $dump = Join-Path $tempRoot "dump"
          Invoke-ProjectLocalNativeDumpPackage `
            -PgDumpPath $pgDump `
            -PgDumpAllPath $pgDumpAll `
            -ConnectionUrl $fixtureDumpUrl `
            -WorkingDirectory $tempRoot `
            -DumpDirectory $dump `
            -AllowLoopbackFixture `
            -ArgumentAuditPath $FixtureArgumentAuditPath
          Write-ProjectLocalDumpManifest `
            -DumpDirectory $dump `
            -PgDumpPath $pgDump `
            -PgDumpAllPath $pgDumpAll `
            -ManifestProjectName "synthetic-loopback" `
            -ManifestProjectRef "loopback-only" `
            -ManifestMigration "20991231235959" `
            -MigrationPreflightStatus "synthetic-fixture" `
            -AgeVersion "synthetic-not-run"
          Assert-ProjectLocalNativeDumpFixturePackage -DumpDirectory $dump -WorkingDirectory $tempRoot
          "fixture_native_dump_package_ok"
          return
        } finally {
          $fixtureDumpUrl = $null
        }
      }
      "NativeDumpConnectionFailure" {
        $fixtureDumpUrl = Read-ProjectLocalNativeDumpFixtureUrl
        try {
          $dump = Join-Path $tempRoot "dump"
          Invoke-ProjectLocalNativeDumpPackage `
            -PgDumpPath (Get-Command "pg_dump" -ErrorAction Stop).Source `
            -PgDumpAllPath (Get-Command "pg_dumpall" -ErrorAction Stop).Source `
            -ConnectionUrl $fixtureDumpUrl `
            -WorkingDirectory $tempRoot `
            -DumpDirectory $dump `
            -AllowLoopbackFixture `
            -ArgumentAuditPath $FixtureArgumentAuditPath
          throw "dump_fixture_connection_failure_not_rejected"
        } finally {
          $fixtureDumpUrl = $null
        }
      }
      "NativeDumpAuthenticationFailure" {
        $fixtureDumpUrl = Read-ProjectLocalNativeDumpFixtureUrl
        try {
          $dump = Join-Path $tempRoot "dump"
          Invoke-ProjectLocalNativeDumpPackage `
            -PgDumpPath (Get-Command "pg_dump" -ErrorAction Stop).Source `
            -PgDumpAllPath (Get-Command "pg_dumpall" -ErrorAction Stop).Source `
            -ConnectionUrl $fixtureDumpUrl `
            -WorkingDirectory $tempRoot `
            -DumpDirectory $dump `
            -AllowLoopbackFixture `
            -ArgumentAuditPath $FixtureArgumentAuditPath
          throw "dump_fixture_authentication_failure_not_rejected"
        } finally {
          $fixtureDumpUrl = $null
        }
      }
      "NativeDumpLaunchFailure" {
        $fixtureDumpUrl = Read-ProjectLocalNativeDumpFixtureUrl
        try {
          $dump = Join-Path $tempRoot "dump"
          Invoke-ProjectLocalNativeDumpPackage `
            -PgDumpPath (Join-Path $tempRoot "missing-pg-dump.exe") `
            -PgDumpAllPath (Join-Path $tempRoot "missing-pg-dumpall.exe") `
            -ConnectionUrl $fixtureDumpUrl `
            -WorkingDirectory $tempRoot `
            -DumpDirectory $dump `
            -AllowLoopbackFixture `
            -ArgumentAuditPath $FixtureArgumentAuditPath
          throw "dump_fixture_launch_failure_not_rejected"
        } finally {
          $fixtureDumpUrl = $null
        }
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

$age = $null
$psql = $null
$pgDump = $null
$pgDumpAll = $null
$dbUrl = $null
$workRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("project-local-production-backup-" + [guid]::NewGuid().ToString("N"))
$partialPath = $null
$archivePath = $null
$safeFailureCode = "backup_failed"

try {
  New-Item -ItemType Directory -Path $workRoot -Force | Out-Null
  $safeFailureCode = "dependency_preflight_failed"
  $age = Get-Command "age" -ErrorAction Stop
  $psql = Get-Command "psql" -ErrorAction Stop
  try { $pgDump = Get-Command "pg_dump" -ErrorAction Stop } catch { throw "dump_executable_unavailable_pg_dump" }
  try { $pgDumpAll = Get-Command "pg_dumpall" -ErrorAction Stop } catch { throw "dump_executable_unavailable_pg_dumpall" }

  $safeFailureCode = "secret_validation_failed"
  $dbUrl = Read-SecretUrl
  $safeFailureCode = "migration_preflight_failed"
  Invoke-ProjectLocalMigrationPreflight `
    -PsqlPath $psql.Source `
    -ConnectionUrl $dbUrl `
    -WorkingDirectory $workRoot `
    -ExpectedMigrationVersion $ExpectedMigration
  $dumpDir = Join-Path $workRoot "dump"
  $safeFailureCode = "logical_dump_failed"
  Invoke-ProjectLocalNativeDumpPackage `
    -PgDumpPath $pgDump.Source `
    -PgDumpAllPath $pgDumpAll.Source `
    -ConnectionUrl $dbUrl `
    -WorkingDirectory $workRoot `
    -DumpDirectory $dumpDir
  Write-ProjectLocalDumpManifest `
    -DumpDirectory $dumpDir `
    -PgDumpPath $pgDump.Source `
    -PgDumpAllPath $pgDumpAll.Source `
    -ManifestProjectName $ProjectName `
    -ManifestProjectRef $ProjectRef `
    -ManifestMigration $ExpectedMigration `
    -MigrationPreflightStatus "passed" `
    -AgeVersion (& $age.Source --version 2>$null)

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
  if ($_.Exception.Message -match "^migration_preflight_(?:query_failed|output_invalid|history_missing|history_invalid|mismatch|target_invalid)$") {
    $safeFailureCode = $_.Exception.Message
  } elseif ($_.Exception.Message -match "^dump_(?:target_invalid|fixture_target_invalid|argument_audit_fixture_only|argument_secret_detected_[a-z0-9_]+|executable_unavailable_[a-z0-9_]+|process_launch_failed_[a-z0-9_]+|connection_or_authentication_failed_[a-z0-9_]+|process_failed_[a-z0-9_]+|output_missing_[a-z0-9_]+|output_empty_[a-z0-9_]+|package_construction_failed_[a-z0-9_]+)$") {
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
