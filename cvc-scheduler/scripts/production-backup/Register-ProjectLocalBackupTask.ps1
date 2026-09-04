param(
  [ValidateSet("Register", "Inspect", "Enable", "Disable", "Unregister", "ValidateExpectedMigrationTransition", "UpdateExpectedMigration")]
  [string]$Action = "Inspect",
  [switch]$ConfirmTaskAction,
  [switch]$FixtureMode,
  [ValidateSet("Success", "WrongCurrent", "WrongTarget", "Duplicate", "Enabled", "Running", "UnexpectedTaskIdentity", "UnsupportedRuntime")]
  [string]$FixtureScenario = "Success",
  [string]$TaskName = "Project Local Production Backup",
  [string]$ProjectName = "project-local-production",
  [string]$ProjectRef = "wdlaauzknfggoqldolmx",
  [string]$CurrentExpectedMigration = "20260714122230",
  [string]$ExpectedMigration = "20260714122230",
  [string]$AgeRecipient,
  [string]$DestinationRoot,
  [string]$SecretPath,
  [ValidatePattern("^(?:[01]\d|2[0-3]):[0-5]\d$")]
  [string]$DailyTime = "03:15"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepositoryRoot = (Resolve-Path (Join-Path $ScriptRoot "..\..")).Path
$BackupScript = Join-Path $ScriptRoot "Invoke-ProjectLocalProductionBackup.ps1"
$ExpectedProjectName = "project-local-production"
$ExpectedProjectRef = "wdlaauzknfggoqldolmx"
$ExpectedTaskName = "Project Local Production Backup"
. (Join-Path $ScriptRoot "ProjectLocalProductionMigrationContract.ps1")
$ForbiddenStagingRef = "kfuujcfxoayukywvtaeh"
$PrivateAgeIdentityMarker = ("AGE" + "-SECRET-KEY")

function Assert-ExplicitAction {
  if (-not $ConfirmTaskAction) {
    throw "Task Scheduler changes require -ConfirmTaskAction. Default behavior is inspection only."
  }
}

function Get-TaskActionArgument {
  $arguments = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$BackupScript`"",
    "-ExecuteProductionBackup",
    "-ProjectName", "`"$ProjectName`"",
    "-ProjectRef", "`"$ProjectRef`"",
    "-ExpectedMigration", "`"$ExpectedMigration`"",
    "-AgeRecipient", "`"$AgeRecipient`"",
    "-NotifyOnFailure"
  )
  if (-not [string]::IsNullOrWhiteSpace($DestinationRoot)) {
    $arguments += @("-DestinationRoot", "`"$DestinationRoot`"")
  }
  if (-not [string]::IsNullOrWhiteSpace($SecretPath)) {
    $arguments += @("-SecretPath", "`"$SecretPath`"")
  }
  return ($arguments -join " ")
}

function Assert-RegistrationContract {
  if (
    $ProjectName -cne $ExpectedProjectName -or
    $ProjectRef -cne $ExpectedProjectRef -or
    $ExpectedMigration -notin $AllowedTerminalMigrations -or
    $ProjectRef -ceq $ForbiddenStagingRef
  ) {
    throw "Refusing scheduled task because exact production locks do not match."
  }
  if (
    [string]::IsNullOrWhiteSpace($AgeRecipient) -or
    $AgeRecipient -notmatch "^age1[023456789acdefghjklmnpqrstuvwxyz]{20,}$" -or
    $AgeRecipient.Contains($PrivateAgeIdentityMarker)
  ) {
    throw "A valid public age recipient is required for task registration."
  }
  if (-not [string]::IsNullOrWhiteSpace($DestinationRoot)) {
    $destination = [System.IO.Path]::GetFullPath($DestinationRoot)
    if ($destination.StartsWith($RepositoryRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing scheduled backup destination inside the repository."
    }
  }
  if (-not [string]::IsNullOrWhiteSpace($SecretPath)) {
    throw "Scheduled task registration uses the reviewed default DPAPI secret path; do not embed a local secret path in task arguments."
  }
}

function Test-IsCurrentOperatorIdentity {
  param([Parameter(Mandatory = $true)][string]$Candidate)
  $currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  if ($Candidate -ieq $currentIdentity.Name -or $Candidate -eq $currentIdentity.User.Value) {
    return $true
  }
  try {
    $candidateSid = if ($Candidate -match "^S-1-") {
      [System.Security.Principal.SecurityIdentifier]::new($Candidate)
    } else {
      [System.Security.Principal.NTAccount]::new($Candidate).Translate([System.Security.Principal.SecurityIdentifier])
    }
    return $candidateSid.Value -eq $currentIdentity.User.Value
  } catch {
    return $false
  }
}

function Get-ExpectedMigrationArgumentValues {
  param([Parameter(Mandatory = $true)][string]$Arguments)
  $pattern = '(?i)(?:^|\s)-ExpectedMigration\s+(?:"([^"]+)"|''([^'']+)''|([^\s]+))'
  return @(
    [regex]::Matches($Arguments, $pattern) | ForEach-Object {
      if (-not [string]::IsNullOrEmpty($_.Groups[1].Value)) { $_.Groups[1].Value }
      elseif (-not [string]::IsNullOrEmpty($_.Groups[2].Value)) { $_.Groups[2].Value }
      else { $_.Groups[3].Value }
    }
  )
}

function Test-ManagedTaskContract {
  param(
    [Parameter(Mandatory = $true)]$Task,
    [string]$ExpectedMigrationLock = $ExpectedMigration
  )
  $actions = @($Task.Actions)
  $triggers = @($Task.Triggers)
  if ($actions.Count -ne 1) { return $false }
  $arguments = [string]$actions[0].Arguments
  $migrationLocks = @(Get-ExpectedMigrationArgumentValues -Arguments $arguments)
  return (
    [System.IO.Path]::GetFileName([string]$actions[0].Execute) -ieq "powershell.exe" -and
    $arguments -like "*Invoke-ProjectLocalProductionBackup.ps1*" -and
    $arguments -like "*-ProjectName*project-local-production*" -and
    $arguments -like "*-ProjectRef*wdlaauzknfggoqldolmx*" -and
    $arguments -notlike "*kfuujcfxoayukywvtaeh*" -and
    $migrationLocks.Count -eq 1 -and
    $migrationLocks[0] -ceq $ExpectedMigrationLock -and
    $arguments -like "*-NotifyOnFailure*" -and
    $arguments -notmatch "postgres(?:ql)?://|SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY" -and
    -not $arguments.Contains($PrivateAgeIdentityMarker) -and
    $triggers.Count -eq 1 -and
    $triggers[0].CimClass.CimClassName -eq "MSFT_TaskDailyTrigger" -and
    ([datetime]$triggers[0].StartBoundary).ToString("HH:mm") -eq "03:15" -and
    [bool]$Task.Settings.StartWhenAvailable -and
    [string]$Task.Principal.LogonType -eq "Interactive" -and
    [string]$Task.Principal.RunLevel -eq "Limited" -and
    (Test-IsCurrentOperatorIdentity -Candidate ([string]$Task.Principal.UserId))
  )
}

function Get-UpdatedExpectedMigrationArguments {
  param(
    [Parameter(Mandatory = $true)][string]$Arguments,
    [Parameter(Mandatory = $true)][string]$CurrentMigration,
    [Parameter(Mandatory = $true)][string]$TargetMigration
  )
  Assert-ProjectLocalReviewedLockTransition -CurrentMigration $CurrentMigration -TargetMigration $TargetMigration
  $argumentValues = @(Get-ExpectedMigrationArgumentValues -Arguments $Arguments)
  if ($argumentValues.Count -ne 1 -or $argumentValues[0] -cne $CurrentMigration) {
    throw "The managed task must contain exactly one current expected-migration argument."
  }
  $candidates = @(
    "-ExpectedMigration `"$CurrentMigration`"",
    "-ExpectedMigration '$CurrentMigration'",
    "-ExpectedMigration $CurrentMigration"
  )
  $matches = @($candidates | Where-Object { $Arguments.Contains($_) })
  if ($matches.Count -ne 1) {
    throw "The managed task must contain exactly one current expected-migration argument."
  }
  $currentToken = $matches[0]
  $updatedArguments = $Arguments.Replace($currentToken, "-ExpectedMigration `"$TargetMigration`"")
  $updatedValues = @(Get-ExpectedMigrationArgumentValues -Arguments $updatedArguments)
  if ($updatedValues.Count -ne 1 -or $updatedValues[0] -cne $TargetMigration) {
    throw "The managed task migration-lock transition did not produce exactly one reviewed target."
  }
  return $updatedArguments
}

function Assert-TransitionTaskIdentity {
  param([Parameter(Mandatory = $true)][string]$CandidateTaskName)
  if ($CandidateTaskName -cne $ExpectedTaskName) {
    throw "Migration-lock transition validation is restricted to the permanent production backup task."
  }
}

function Assert-BackupRuntimeTransitionContract {
  param(
    [Parameter(Mandatory = $true)][string]$CurrentMigration,
    [Parameter(Mandatory = $true)][string]$TargetMigration,
    [string]$ContractVersion = $ProjectLocalProductionMigrationContractVersion
  )
  if (-not (Test-Path -LiteralPath $BackupScript -PathType Leaf)) {
    throw "The production backup runtime is not installed at the reviewed path."
  }
  $runtimeSource = [System.IO.File]::ReadAllText($BackupScript)
  if (
    -not $runtimeSource.Contains('ProjectLocalProductionMigrationContract.ps1') -or
    -not $runtimeSource.Contains('Test-ProjectLocalApprovedTerminalMigration')
  ) {
    throw "The production backup runtime does not use the reviewed migration contract."
  }
  Assert-ProjectLocalReviewedLockTransition `
    -CurrentMigration $CurrentMigration `
    -TargetMigration $TargetMigration `
    -ContractVersion $ContractVersion
}

function Assert-MigrationLockUpdateWindow {
  param(
    [Parameter(Mandatory = $true)][bool]$Enabled,
    [Parameter(Mandatory = $true)][string]$State
  )
  if ($Enabled -or $State -eq "Running") {
    throw "The production backup task must be disabled and not running before its migration lock is updated."
  }
}

function Get-SafeTaskMetadata {
  param([Parameter(Mandatory = $true)]$Task)
  $taskInfo = Get-ScheduledTaskInfo -TaskName $Task.TaskName
  $actions = @($Task.Actions)
  $triggers = @($Task.Triggers)
  $arguments = if ($actions.Count -eq 1) { [string]$actions[0].Arguments } else { "" }
  $migrationLocks = @(Get-ExpectedMigrationArgumentValues -Arguments $arguments)
  [pscustomobject]@{
    TaskName = $Task.TaskName
    Enabled = [bool]$Task.Settings.Enabled
    State = switch ([int]$Task.State) {
      0 { "Unknown" }
      1 { "Disabled" }
      2 { "Queued" }
      3 { "Ready" }
      4 { "Running" }
      default { "Unexpected" }
    }
    TriggerCadence = if ($triggers.Count -eq 1 -and $triggers[0].CimClass.CimClassName -eq "MSFT_TaskDailyTrigger") { "Daily" } else { "Unexpected" }
    TriggerLocalTime = if ($triggers.Count -eq 1) { ([datetime]$triggers[0].StartBoundary).ToString("HH:mm") } else { $null }
    NextRunTime = $taskInfo.NextRunTime
    StartWhenAvailable = [bool]$Task.Settings.StartWhenAvailable
    LogonType = [string]$Task.Principal.LogonType
    RunAsIdentityClassification = if (Test-IsCurrentOperatorIdentity -Candidate ([string]$Task.Principal.UserId)) { "current_operator" } else { "unexpected" }
    ExecutableIdentity = if ($actions.Count -eq 1 -and [System.IO.Path]::GetFileName([string]$actions[0].Execute) -ieq "powershell.exe") { "powershell.exe" } else { "unexpected" }
    ScriptIdentity = if ($arguments -like "*Invoke-ProjectLocalProductionBackup.ps1*") { "Invoke-ProjectLocalProductionBackup.ps1" } else { "unexpected" }
    ExactProductionLocksPresent = [bool]($arguments -like "*-ProjectName*project-local-production*" -and $arguments -like "*-ProjectRef*wdlaauzknfggoqldolmx*" -and $migrationLocks.Count -eq 1 -and $migrationLocks[0] -in $AllowedTerminalMigrations)
    FailureNotificationEnabled = [bool]($arguments -like "*-NotifyOnFailure*")
    SecretBearingArgumentsPresent = [bool]($arguments -match "postgres(?:ql)?://|SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY" -or $arguments.Contains($PrivateAgeIdentityMarker))
    PrivateIdentityArgumentPresent = [bool]($arguments -match "(?i)-AgeIdentity" -or $arguments.Contains($PrivateAgeIdentityMarker))
  }
}

if ($env:OS -ne 'Windows_NT') {
  throw "Windows Task Scheduler registration is Windows-only."
}

if ($FixtureMode) {
  if ($Action -notin @("ValidateExpectedMigrationTransition", "UpdateExpectedMigration")) {
    throw "Fixture mode is available only for expected-migration transition validation or execution."
  }
  $fixtureCurrent = if ($FixtureScenario -ceq "WrongCurrent") { "20260824123501" } else { $CurrentExpectedMigration }
  $fixtureTarget = if ($FixtureScenario -ceq "WrongTarget") { "20260902120001" } else { $ExpectedMigration }
  $fixtureTaskName = if ($FixtureScenario -ceq "UnexpectedTaskIdentity") { "Unexpected Production Backup Task" } else { $TaskName }
  $fixtureContractVersion = if ($FixtureScenario -ceq "UnsupportedRuntime") { "unsupported-runtime-contract" } else { $ProjectLocalProductionMigrationContractVersion }
  Assert-TransitionTaskIdentity -CandidateTaskName $fixtureTaskName
  Assert-BackupRuntimeTransitionContract -CurrentMigration $fixtureCurrent -TargetMigration $fixtureTarget -ContractVersion $fixtureContractVersion
  if ($FixtureScenario -ceq "Running") {
    throw "The production backup task must not be running during transition validation or execution."
  }
  $fixtureArguments = "-NoProfile -File `"Synthetic-Invoke-ProjectLocalProductionBackup.ps1`" -ExpectedMigration `"$CurrentExpectedMigration`""
  if ($FixtureScenario -ceq "Duplicate") {
    $fixtureArguments += " -ExpectedMigration `"$CurrentExpectedMigration`""
  }
  if ($Action -ceq "ValidateExpectedMigrationTransition") {
    $fixtureValues = @(Get-ExpectedMigrationArgumentValues -Arguments $fixtureArguments)
    if ($fixtureValues.Count -ne 1 -or $fixtureValues[0] -cne $CurrentExpectedMigration) {
      throw "The dry-run fixture does not contain exactly the reviewed current lock."
    }
    Write-Host "fixture_backup_migration_lock_transition_dry_run_ok mutation_performed=false"
    return
  }
  Assert-MigrationLockUpdateWindow -Enabled ($FixtureScenario -ceq "Enabled") -State "Disabled"
  $updatedFixtureArguments = Get-UpdatedExpectedMigrationArguments -Arguments $fixtureArguments -CurrentMigration $fixtureCurrent -TargetMigration $fixtureTarget
  if (
    $updatedFixtureArguments -notlike "*-ExpectedMigration*$fixtureTarget*" -or
    $updatedFixtureArguments -like "*-ExpectedMigration*$fixtureCurrent*"
  ) {
    throw "Fixture expected-migration transition did not produce the exact reviewed target."
  }
  Write-Host "fixture_backup_migration_lock_transition_ok"
  return
}

if ($Action -eq "Inspect") {
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($task) {
    Get-SafeTaskMetadata -Task $task
  }
  return
}

if ($Action -eq "ValidateExpectedMigrationTransition") {
  Assert-TransitionTaskIdentity -CandidateTaskName $TaskName
  Assert-BackupRuntimeTransitionContract -CurrentMigration $CurrentExpectedMigration -TargetMigration $ExpectedMigration
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  if ([string]$task.State -eq "Running") {
    throw "The production backup task must not be running during transition validation."
  }
  if (-not [bool]$task.Settings.Enabled -or [string]$task.State -ne "Ready") {
    throw "The read-only transition validation requires the permanent production backup task to be enabled and Ready."
  }
  if (-not (Test-ManagedTaskContract -Task $task -ExpectedMigrationLock $CurrentExpectedMigration)) {
    throw "Refusing to validate an unexpected scheduled task."
  }
  [pscustomobject]@{
    TaskIdentity = "permanent_production_backup"
    CurrentLock = $CurrentExpectedMigration
    ApprovedTarget = $ExpectedMigration
    RuntimeContract = $ProjectLocalProductionMigrationContractVersion
    TransitionAuthorized = $true
    MutationPerformed = $false
  }
  return
}

Assert-ExplicitAction

switch ($Action) {
  "Register" {
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existing) {
      throw "Refusing to silently replace an existing scheduled task. Unregister it explicitly first."
    }
    Assert-RegistrationContract
    $trigger = New-ScheduledTaskTrigger -Daily -At $DailyTime
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
    $taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument (Get-TaskActionArgument)
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $trigger -Settings $settings -Principal $principal -Description "Project Local encrypted production backup. No database credential or age private identity is embedded in arguments." | Out-Null
  }
  "Enable" {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    if (-not (Test-ManagedTaskContract -Task $task)) { throw "Refusing to modify an unexpected scheduled task." }
    Enable-ScheduledTask -TaskName $TaskName | Out-Null
  }
  "Disable" {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    if (-not (Test-ManagedTaskContract -Task $task)) { throw "Refusing to modify an unexpected scheduled task." }
    Disable-ScheduledTask -TaskName $TaskName | Out-Null
  }
  "Unregister" {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    if (-not (Test-ManagedTaskContract -Task $task)) { throw "Refusing to modify an unexpected scheduled task." }
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  }
  "UpdateExpectedMigration" {
    Assert-TransitionTaskIdentity -CandidateTaskName $TaskName
    Assert-BackupRuntimeTransitionContract -CurrentMigration $CurrentExpectedMigration -TargetMigration $ExpectedMigration
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    Assert-MigrationLockUpdateWindow -Enabled ([bool]$task.Settings.Enabled) -State ([string]$task.State)
    if (-not (Test-ManagedTaskContract -Task $task -ExpectedMigrationLock $CurrentExpectedMigration)) {
      throw "Refusing to update an unexpected scheduled task."
    }
    $actions = @($task.Actions)
    $updatedArguments = Get-UpdatedExpectedMigrationArguments -Arguments ([string]$actions[0].Arguments) -CurrentMigration $CurrentExpectedMigration -TargetMigration $ExpectedMigration
    $updatedActionParameters = @{
      Execute = [string]$actions[0].Execute
      Argument = $updatedArguments
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$actions[0].WorkingDirectory)) {
      $updatedActionParameters.WorkingDirectory = [string]$actions[0].WorkingDirectory
    }
    $updatedAction = New-ScheduledTaskAction @updatedActionParameters
    Set-ScheduledTask -TaskName $TaskName -Action $updatedAction | Out-Null
    $updatedTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    if (-not (Test-ManagedTaskContract -Task $updatedTask -ExpectedMigrationLock $ExpectedMigration)) {
      throw "The production backup task did not retain the reviewed contract after migration-lock update."
    }
  }
}

Write-Host "Project Local backup task action completed: $Action"
