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
  [string]$DailyTime = "03:15"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackupScript = Join-Path $ScriptRoot "Invoke-ProjectLocalProductionBackup.ps1"

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
    "-AgeRecipient", "`"$AgeRecipient`""
  )
  if (-not [string]::IsNullOrWhiteSpace($DestinationRoot)) {
    $arguments += @("-DestinationRoot", "`"$DestinationRoot`"")
  }
  if (-not [string]::IsNullOrWhiteSpace($SecretPath)) {
    $arguments += @("-SecretPath", "`"$SecretPath`"")
  }
  return ($arguments -join " ")
}

if ($env:OS -ne 'Windows_NT') {
  throw "Windows Task Scheduler registration is Windows-only."
}

if ($Action -eq "Inspect") {
  Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Select-Object TaskName, State, Author
  return
}

Assert-ExplicitAction

switch ($Action) {
  "Register" {
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existing) {
      throw "Refusing to silently replace an existing scheduled task. Unregister it explicitly first."
    }
    if ([string]::IsNullOrWhiteSpace($AgeRecipient)) {
      throw "Age recipient is required for task registration."
    }
    $trigger = New-ScheduledTaskTrigger -Daily -At $DailyTime
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument (Get-TaskActionArgument)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Project Local encrypted production backup. No database credential or age private identity is embedded in arguments." -User $env:USERNAME | Out-Null
  }
  "Enable" { Enable-ScheduledTask -TaskName $TaskName | Out-Null }
  "Disable" { Disable-ScheduledTask -TaskName $TaskName | Out-Null }
  "Unregister" { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false }
}

Write-Host "Project Local backup task action completed: $Action"
