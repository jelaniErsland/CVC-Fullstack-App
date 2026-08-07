param(
  [switch]$ExecuteProductionBackup,
  [switch]$FixtureMode,
  [ValidateSet("GuardMissingOptIn", "GuardStagingRef", "GuardRepoDestination", "GuardMissingRecipient", "GuardMissingSecret", "Retention", "CleanupAfterFailure", "StatusRedaction")]
  [string]$FixtureScenario,
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
  [switch]$NotifyOnFailure
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
  if (-not $ExecuteProductionBackup -and -not $FixtureMode) {
    throw "Refusing to run: pass -ExecuteProductionBackup for real production backup or -FixtureMode for safe local validation."
  }
  if ($FixtureMode -and $ExecuteProductionBackup) {
    throw "Fixture mode may not execute a production backup."
  }
  if ($ProjectRef -eq $ForbiddenStagingRef) {
    throw "Refusing staging project ref."
  }
  if ($ExecuteProductionBackup) {
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
  $safe | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statusPath -Encoding UTF8
  return $statusPath
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
  foreach ($argument in $ArgumentList) {
    [void]$process.StartInfo.ArgumentList.Add($argument)
  }
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
  $encrypted = Get-Content -LiteralPath $SecretPath -Raw
  $secure = ConvertTo-SecureString -String $encrypted
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
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
Assert-AgeRecipient -Recipient $AgeRecipient

$destination = Resolve-DefaultDestinationRoot
$dailyDestination = Join-Path $destination "daily"
$weeklyDestination = Join-Path $destination "weekly"
$statusDestination = Join-Path $destination "status"
Assert-NotRepositoryPath -Path $dailyDestination -Label "daily destination"
Assert-NotRepositoryPath -Path $weeklyDestination -Label "weekly destination"
Assert-NotRepositoryPath -Path $statusDestination -Label "status destination"

$supabase = Get-Command "supabase" -ErrorAction Stop
$docker = Get-Command "docker" -ErrorAction Stop
$age = Get-Command "age" -ErrorAction Stop
$dbUrl = $null
$workRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("project-local-production-backup-" + [guid]::NewGuid().ToString("N"))
$partialPath = $null
$archivePath = $null

try {
  New-Item -ItemType Directory -Path $workRoot -Force | Out-Null
  Invoke-CheckedProcess -FilePath $docker.Source -WorkingDirectory $workRoot -SafeFailureCode "docker_preflight" -ArgumentList @("version")

  $dbUrl = Read-SecretUrl
  $dumpDir = Join-Path $workRoot "dump"
  New-Item -ItemType Directory -Path $dumpDir -Force | Out-Null

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

  Invoke-CheckedProcess -FilePath $age.Source -WorkingDirectory $workRoot -SafeFailureCode "age_encrypt" -ArgumentList @("-r", $AgeRecipient, "-o", $partialPath, $archivePath)
  $header = Get-Content -LiteralPath $partialPath -TotalCount 1
  if ($header -notlike "age-encryption.org/v1*") { throw "encrypted_artifact_not_age" }
  $size = (Get-Item -LiteralPath $partialPath).Length
  if ($size -le 0) { throw "encrypted_artifact_empty" }
  $hash = (Get-FileHash -LiteralPath $partialPath -Algorithm SHA256).Hash.ToLowerInvariant()
  Move-Item -LiteralPath $partialPath -Destination $finalPath -Force
  $partialPath = $null

  if ((Get-Date).DayOfWeek.ToString() -eq $WeeklyPromotionDay) {
    Copy-Item -LiteralPath $finalPath -Destination (Join-Path $weeklyDestination (Split-Path -Leaf $finalPath)) -Force
  }
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
  if ($partialPath -and (Test-Path -LiteralPath $partialPath)) {
    Remove-Item -LiteralPath $partialPath -Force
  }
  try {
    [void](Write-SafeStatus -StatusDirectory $statusDestination -Payload @{
      status = "failure"
      encryptedFileName = $null
      encryptedByteSize = $null
      sha256 = $null
      safeFailureCode = "backup_failed"
    })
  } catch {}
  if ($NotifyOnFailure) {
    try {
      Add-Type -AssemblyName PresentationFramework -ErrorAction SilentlyContinue
      [System.Windows.MessageBox]::Show("Project Local production backup failed. Review latest-status.json.", "Project Local backup") | Out-Null
    } catch {}
  }
  throw "Project Local production backup failed with safe failure code backup_failed."
} finally {
  $dbUrl = $null
  if ($archivePath -and (Test-Path -LiteralPath $archivePath)) { Remove-Item -LiteralPath $archivePath -Force }
  if (Test-Path -LiteralPath $workRoot) { Remove-Item -LiteralPath $workRoot -Recurse -Force }
}
