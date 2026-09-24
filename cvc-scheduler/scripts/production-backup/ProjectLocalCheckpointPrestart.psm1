Set-StrictMode -Version Latest

function Resolve-ProjectLocalTaskPrincipalSid {
  param([Parameter(Mandatory = $true)][string]$UserId)
  try { return ([Security.Principal.NTAccount]::new($UserId)).Translate([Security.Principal.SecurityIdentifier]).Value }
  catch {
    try { return ([Security.Principal.SecurityIdentifier]::new($UserId)).Value }
    catch { return $null }
  }
}

function Test-ProjectLocalCheckpointPrestart {
  param(
    [Parameter(Mandatory = $true)]$Task,
    [Parameter(Mandatory = $true)]$TaskInfo,
    [Parameter(Mandatory = $true)]$ExpectedAction,
    [Parameter(Mandatory = $true)][string]$ExpectedOperatorSid,
    [Parameter(Mandatory = $true)][string]$MarkerPath
  )

  $failures = [System.Collections.Generic.List[string]]::new()
  # Task Scheduler represents a triggerless task as $null on some Windows hosts.
  # @($null).Count is 1; filter null elements before checking cardinality.
  $actions = @($Task.Actions | Where-Object { $null -ne $_ })
  $triggers = @($Task.Triggers | Where-Object { $null -ne $_ })
  if ($actions.Count -ne 1) { $failures.Add('action_count') }
  if ($triggers.Count -ne 0) { $failures.Add('unexpected_trigger') }

  if ($actions.Count -eq 1 -and (
      [string]$actions[0].Execute -cne [string]$ExpectedAction.Execute -or
      [string]$actions[0].Arguments -cne [string]$ExpectedAction.Arguments -or
      [string]$actions[0].WorkingDirectory -cne [string]$ExpectedAction.WorkingDirectory
    )) { $failures.Add('action_mismatch') }

  $actualSid = Resolve-ProjectLocalTaskPrincipalSid -UserId ([string]$Task.Principal.UserId)
  if ($null -eq $actualSid -or $actualSid -cne $ExpectedOperatorSid -or
      [string]$Task.Principal.LogonType -cne 'Interactive' -or
      [string]$Task.Principal.RunLevel -cne 'Limited') {
    $failures.Add('principal_mismatch')
  }
  if (-not [bool]$Task.Settings.Enabled -or [string]$Task.State -cne 'Ready' -or
      -not [bool]$Task.Settings.StartWhenAvailable -or
      [string]$Task.Settings.MultipleInstances -cne 'IgnoreNew') {
    $failures.Add('task_state_mismatch')
  }
  # On this reviewed Windows host, Task Scheduler reports 1999 / 267011
  # (SCHED_S_TASK_HAS_NOT_RUN) for a newly registered, never-started task.
  if ($TaskInfo.LastRunTime.Year -gt 2000 -or [int]$TaskInfo.LastTaskResult -ne 267011) {
    $failures.Add('task_already_run_or_unknown')
  }
  if (Test-Path -LiteralPath $MarkerPath) { $failures.Add('stale_marker') }

  [pscustomobject]@{ Pass = $failures.Count -eq 0; Failures = @($failures) }
}

Export-ModuleMember -Function Test-ProjectLocalCheckpointPrestart
