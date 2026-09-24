$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'production-backup/ProjectLocalCheckpointPrestart.psm1') -Force

$prefix = 'Project Local 12.47 Verifier Fixture ' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$names = @()
$operator = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $operator -LogonType Interactive -RunLevel Limited
$operatorSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -NonInteractive -Command "exit 0"'
$wrongAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -NonInteractive -Command "exit 1"'
$markerAbsent = Join-Path $env:TEMP ('project-local-absent-marker-' + [guid]::NewGuid().ToString('N'))
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$markerPresent = Join-Path $repositoryRoot 'AGENTS.md'
$results = [ordered]@{}
try {
  $goodName = $prefix + ' Good'
  $names += $goodName
  Register-ScheduledTask -TaskName $goodName -Action $action -Settings $settings -Principal $principal -Description 'Harmless verifier fixture; never started' | Out-Null
  $good = Get-ScheduledTask -TaskName $goodName
  $goodInfo = Get-ScheduledTaskInfo -TaskName $goodName
  $results.triggerlessAccepted = (Test-ProjectLocalCheckpointPrestart -Task $good -TaskInfo $goodInfo -ExpectedAction $action -ExpectedOperatorSid $operatorSid -MarkerPath $markerAbsent).Pass
  $results.goodChecks = [ordered]@{
    actionCount = @($good.Actions | Where-Object { $null -ne $_ }).Count
    triggerCount = @($good.Triggers | Where-Object { $null -ne $_ }).Count
    executeEqual = [string]$good.Actions[0].Execute -ceq [string]$action.Execute
    argumentsEqual = [string]$good.Actions[0].Arguments -ceq [string]$action.Arguments
    workingDirectoryEqual = [string]$good.Actions[0].WorkingDirectory -ceq [string]$action.WorkingDirectory
    userIdCanonicalized = [string]$good.Principal.UserId -cne [string]$principal.UserId
    logonType = [string]$good.Principal.LogonType
    runLevel = [string]$good.Principal.RunLevel
    enabled = [bool]$good.Settings.Enabled
    state = [string]$good.State
    startWhenAvailable = [bool]$good.Settings.StartWhenAvailable
    markerAbsent = -not (Test-Path -LiteralPath $markerAbsent)
    lastRunYear = $goodInfo.LastRunTime.Year
    lastTaskResult = $goodInfo.LastTaskResult
  }
  $results.staleMarkerRejected = (Test-ProjectLocalCheckpointPrestart -Task $good -TaskInfo $goodInfo -ExpectedAction $action -ExpectedOperatorSid $operatorSid -MarkerPath $markerPresent).Failures -contains 'stale_marker'
  $results.principalMismatchRejected = (Test-ProjectLocalCheckpointPrestart -Task $good -TaskInfo $goodInfo -ExpectedAction $action -ExpectedOperatorSid 'S-1-5-18' -MarkerPath $markerAbsent).Failures -contains 'principal_mismatch'
  $results.actionMismatchRejected = (Test-ProjectLocalCheckpointPrestart -Task $good -TaskInfo $goodInfo -ExpectedAction $wrongAction -ExpectedOperatorSid $operatorSid -MarkerPath $markerAbsent).Failures -contains 'action_mismatch'
  $differentWorkingDirectory = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -NonInteractive -Command "exit 0"' -WorkingDirectory $env:TEMP
  $results.workingDirectoryMismatchRejected = (Test-ProjectLocalCheckpointPrestart -Task $good -TaskInfo $goodInfo -ExpectedAction $differentWorkingDirectory -ExpectedOperatorSid $operatorSid -MarkerPath $markerAbsent).Failures -contains 'action_mismatch'
  $alreadyRunInfo = [pscustomobject]@{LastRunTime = Get-Date; LastTaskResult = 0}
  $results.priorRunRejected = (Test-ProjectLocalCheckpointPrestart -Task $good -TaskInfo $alreadyRunInfo -ExpectedAction $action -ExpectedOperatorSid $operatorSid -MarkerPath $markerAbsent).Failures -contains 'task_already_run_or_unknown'
  Disable-ScheduledTask -TaskName $goodName | Out-Null
  $disabled = Get-ScheduledTask -TaskName $goodName
  $disabledInfo = Get-ScheduledTaskInfo -TaskName $goodName
  $results.disabledStateRejected = (Test-ProjectLocalCheckpointPrestart -Task $disabled -TaskInfo $disabledInfo -ExpectedAction $action -ExpectedOperatorSid $operatorSid -MarkerPath $markerAbsent).Failures -contains 'task_state_mismatch'

  $triggerName = $prefix + ' Trigger'
  $names += $triggerName
  $futureTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddYears(10)
  Register-ScheduledTask -TaskName $triggerName -Action $action -Trigger $futureTrigger -Settings $settings -Principal $principal -Description 'Harmless future-trigger verifier fixture; never started' | Out-Null
  $withTrigger = Get-ScheduledTask -TaskName $triggerName
  $withTriggerInfo = Get-ScheduledTaskInfo -TaskName $triggerName
  $results.unexpectedTriggerRejected = (Test-ProjectLocalCheckpointPrestart -Task $withTrigger -TaskInfo $withTriggerInfo -ExpectedAction $action -ExpectedOperatorSid $operatorSid -MarkerPath $markerAbsent).Failures -contains 'unexpected_trigger'

  $results.oldCheckpointTaskAbsent = @(Get-ScheduledTask -TaskName 'Project Local 12.47 Controlled Checkpoint *' -ErrorAction SilentlyContinue).Count -eq 0
  $results.oldMarkerAbsent = -not (Test-Path -LiteralPath (Join-Path $repositoryRoot '.local/12-47-checkpoint-task-name.txt'))
  $results.legacyNullCount = @($null).Count
  $results.correctedNullCount = @($null | Where-Object { $null -ne $_ }).Count
  [pscustomobject]$results | ConvertTo-Json -Compress
  if (@($results.Values | Where-Object { $_ -is [bool] -and -not $_ }).Count -gt 0) { throw 'checkpoint_verifier_rehearsal_failed' }
} finally {
  foreach ($name in $names) {
    $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if ($task) { Unregister-ScheduledTask -TaskName $name -Confirm:$false }
  }
}
