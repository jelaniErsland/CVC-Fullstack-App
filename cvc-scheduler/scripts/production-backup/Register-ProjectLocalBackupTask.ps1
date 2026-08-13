param(
  [ValidateSet("Register", "Inspect", "Enable", "Disable", "Unregister")]
  [string]$Action = "Inspect",
  [switch]$ConfirmTaskAction,
  [string]$TaskName = "Project Local Production Backup",
  [string]$ProjectName = "project-local-production",
  [string]$ProjectRef = "wdlaauzknfggoqldolmx",
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
$ExpectedTerminalMigration = "20260714122230"
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
    $ExpectedMigration -cne $ExpectedTerminalMigration -or
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

function Test-ManagedTaskContract {
  param([Parameter(Mandatory = $true)]$Task)
  $actions = @($Task.Actions)
  $triggers = @($Task.Triggers)
  if ($actions.Count -ne 1) { return $false }
  $arguments = [string]$actions[0].Arguments
  return (
    [System.IO.Path]::GetFileName([string]$actions[0].Execute) -ieq "powershell.exe" -and
    $arguments -like "*Invoke-ProjectLocalProductionBackup.ps1*" -and
    $arguments -like "*-ProjectName*project-local-production*" -and
    $arguments -like "*-ProjectRef*wdlaauzknfggoqldolmx*" -and
    $arguments -notlike "*kfuujcfxoayukywvtaeh*" -and
    $arguments -like "*-ExpectedMigration*20260714122230*" -and
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

function Get-SafeTaskMetadata {
  param([Parameter(Mandatory = $true)]$Task)
  $taskInfo = Get-ScheduledTaskInfo -TaskName $Task.TaskName
  $actions = @($Task.Actions)
  $triggers = @($Task.Triggers)
  $arguments = if ($actions.Count -eq 1) { [string]$actions[0].Arguments } else { "" }
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
    ExactProductionLocksPresent = [bool]($arguments -like "*-ProjectName*project-local-production*" -and $arguments -like "*-ProjectRef*wdlaauzknfggoqldolmx*" -and $arguments -like "*-ExpectedMigration*20260714122230*")
    FailureNotificationEnabled = [bool]($arguments -like "*-NotifyOnFailure*")
    SecretBearingArgumentsPresent = [bool]($arguments -match "postgres(?:ql)?://|SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY" -or $arguments.Contains($PrivateAgeIdentityMarker))
    PrivateIdentityArgumentPresent = [bool]($arguments -match "(?i)-AgeIdentity" -or $arguments.Contains($PrivateAgeIdentityMarker))
  }
}

if ($env:OS -ne 'Windows_NT') {
  throw "Windows Task Scheduler registration is Windows-only."
}

if ($Action -eq "Inspect") {
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($task) {
    Get-SafeTaskMetadata -Task $task
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
}

Write-Host "Project Local backup task action completed: $Action"
