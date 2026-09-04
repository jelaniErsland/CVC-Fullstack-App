Set-StrictMode -Version Latest

$ProjectLocalProductionMigrationContractVersion = "20260902120000-transition-v1"
$ProductionBaselineMigration = "20260714122230"
$EstablishedProductionMigration = "20260812123430"
$FollowUpContactProductionMigration = "20260824123500"
$ProjectQuickViewProductionMigration = "20260902120000"
$PartialProductionMigrationTerminals = @(
  "20260829130000",
  "20260901120000"
)
$AllowedTerminalMigrations = @(
  $ProductionBaselineMigration,
  $EstablishedProductionMigration,
  $FollowUpContactProductionMigration,
  $ProjectQuickViewProductionMigration
)

function Test-ProjectLocalApprovedTerminalMigration {
  param([Parameter(Mandatory = $true)][string]$Migration)
  return $Migration -cin $AllowedTerminalMigrations
}

function Test-ProjectLocalPartialMigrationTerminal {
  param([Parameter(Mandatory = $true)][string]$Migration)
  return $Migration -cin $PartialProductionMigrationTerminals
}

function Test-ProjectLocalReviewedLockTransition {
  param(
    [Parameter(Mandatory = $true)][string]$CurrentMigration,
    [Parameter(Mandatory = $true)][string]$TargetMigration
  )
  return (
    ($CurrentMigration -ceq $ProductionBaselineMigration -and $TargetMigration -ceq $EstablishedProductionMigration) -or
    ($CurrentMigration -ceq $EstablishedProductionMigration -and $TargetMigration -ceq $FollowUpContactProductionMigration) -or
    ($CurrentMigration -ceq $FollowUpContactProductionMigration -and $TargetMigration -ceq $ProjectQuickViewProductionMigration)
  )
}

function Assert-ProjectLocalReviewedLockTransition {
  param(
    [Parameter(Mandatory = $true)][string]$CurrentMigration,
    [Parameter(Mandatory = $true)][string]$TargetMigration,
    [string[]]$SupportedTerminalMigrations = $AllowedTerminalMigrations,
    [string]$ContractVersion = $ProjectLocalProductionMigrationContractVersion
  )
  if ($ContractVersion -cne $ProjectLocalProductionMigrationContractVersion) {
    throw "The installed production backup runtime contract is not the reviewed version."
  }
  if (-not (Test-ProjectLocalReviewedLockTransition -CurrentMigration $CurrentMigration -TargetMigration $TargetMigration)) {
    throw "Only an explicit reviewed production backup-lock transition is supported."
  }
  if ($CurrentMigration -cnotin $SupportedTerminalMigrations -or $TargetMigration -cnotin $SupportedTerminalMigrations) {
    throw "The reviewed production backup-lock transition requires supported current and target terminals."
  }
  if (Test-ProjectLocalPartialMigrationTerminal -Migration $CurrentMigration) {
    throw "A partial production migration terminal cannot be used as the current backup-task lock."
  }
  if (Test-ProjectLocalPartialMigrationTerminal -Migration $TargetMigration) {
    throw "A partial production migration terminal cannot be used as the target backup-task lock."
  }
}
