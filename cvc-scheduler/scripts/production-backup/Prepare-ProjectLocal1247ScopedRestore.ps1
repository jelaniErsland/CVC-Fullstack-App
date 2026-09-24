param(
  [Parameter(Mandatory = $true)][string]$PackageDirectory,
  [Parameter(Mandatory = $true)][string]$OutputDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# The production package contains Auth/Storage data but no Auth/Storage table
# definitions. Keep the full package intact; derive a separately labeled
# Project Local application-data restore for a disposable local Supabase DB.
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$package = (Resolve-Path -LiteralPath $PackageDirectory).Path
$output = (Resolve-Path -LiteralPath $OutputDirectory).Path
$rootWithSlash = $repositoryRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
if ($output.Equals($repositoryRoot, [StringComparison]::OrdinalIgnoreCase) -or
    $output.StartsWith($rootWithSlash, [StringComparison]::OrdinalIgnoreCase) -or
    $output.Equals($package, [StringComparison]::OrdinalIgnoreCase) -or
    $output.StartsWith(($package.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Scoped restore output must be outside the repository and source package.'
}
foreach ($oneDriveRoot in @($env:OneDrive, $env:OneDriveConsumer) | Where-Object { $_ }) {
  $oneDrive = [IO.Path]::GetFullPath($oneDriveRoot).TrimEnd('\', '/')
  if ($output.Equals($oneDrive, [StringComparison]::OrdinalIgnoreCase) -or
      $output.StartsWith(($oneDrive + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Scoped restore output must not be placed in OneDrive.'
  }
}
$outputAcl = Get-Acl -LiteralPath $output
if (-not $outputAcl.AreAccessRulesProtected) {
  throw 'Scoped restore output directory must have inheritance-disabled access controls.'
}
$allowedIdentities = @([Security.Principal.WindowsIdentity]::GetCurrent().Name, 'BUILTIN\Administrators', 'NT AUTHORITY\SYSTEM')
foreach ($accessRule in $outputAcl.Access) {
  if ($accessRule.IdentityReference.Value -notin $allowedIdentities) {
    throw 'Scoped restore output directory grants access beyond the current operator and system administrators.'
  }
}

$required = @('roles.sql', 'schema.sql', 'data.sql', 'supabase_migrations_schema.sql', 'supabase_migrations_data.sql', 'manifest.json')
$actual = @(Get-ChildItem -LiteralPath $package -File | ForEach-Object Name | Sort-Object)
if (($actual -join '|') -cne (($required | Sort-Object) -join '|')) {
  throw 'Encrypted package member set is not the reviewed six-file format.'
}
$manifest = Get-Content -LiteralPath (Join-Path $package 'manifest.json') -Raw | ConvertFrom-Json
if ($manifest.backupFormatVersion -cne 'project-local.logical-backup.v1' -or
    $manifest.expectedMigration -cne '20260908130000') {
  throw 'Package format or migration terminal differs from the reviewed 12.47 source.'
}
foreach ($name in $required | Where-Object { $_ -ne 'manifest.json' }) {
  if ((Get-Item -LiteralPath (Join-Path $package $name)).Length -ne [long]$manifest.dumpFileSizes.$name) {
    throw 'Package file length differs from its encrypted manifest.'
  }
}

$authIds = [Collections.Generic.List[string]]::new()
$publicTables = [Collections.Generic.List[string]]::new()
$publicText = [Text.StringBuilder]::new()
$reader = [IO.StreamReader]::new((Join-Path $package 'data.sql'))
$mode = 'none'
$authIndex = -1
$table = ''
try {
  while (($line = $reader.ReadLine()) -ne $null) {
    if ($mode -eq 'auth') {
      if ($line -eq '\.') { $mode = 'none'; continue }
      $cells = $line.Split("`t")
      if ($authIndex -lt 0 -or $authIndex -ge $cells.Count -or
          $cells[$authIndex] -notmatch '^[0-9a-fA-F-]{36}$') {
        throw 'Malformed Auth identity reference in backup.'
      }
      $authIds.Add($cells[$authIndex])
      continue
    }
    if ($mode -eq 'public') {
      [void]$publicText.AppendLine($line)
      if ($line -eq '\.') { $publicTables.Add($table); $mode = 'none' }
      continue
    }
    if ($mode -eq 'other') {
      if ($line -eq '\.') { $mode = 'none' }
      continue
    }
    if ($line -match '^COPY "auth"\."users" \((?<columns>[^)]+)\) FROM stdin;$') {
      $columns = @($Matches.columns -split ', ' | ForEach-Object { $_.Trim('"') })
      $authIndex = [array]::IndexOf($columns, 'id')
      $mode = 'auth'
      continue
    }
    if ($line -match '^COPY "public"\."(?<table>[a-z_]+)" \(') {
      $table = $Matches.table
      $mode = 'public'
      [void]$publicText.AppendLine($line)
      continue
    }
    if ($line -match '^COPY "(?:auth|storage)"\."[a-z0-9_]+" \(') {
      $mode = 'other'
      continue
    }
    if ($line -match '^COPY ') { throw 'Unreviewed schema in backup data.' }
    if ($line -match '^SELECT pg_catalog\.setval\(' -and $line -match 'public') {
      [void]$publicText.AppendLine($line)
    }
  }
} finally {
  $reader.Dispose()
}
if ($mode -ne 'none' -or $authIds.Count -eq 0 -or $publicTables.Count -ne 18 -or
    @($publicTables | Sort-Object -Unique).Count -ne 18 -or
    @($authIds | Sort-Object -Unique).Count -ne $authIds.Count) {
  throw 'Scoped Auth/public data shape differs from the reviewed 12.47 backup.'
}

$stubPath = Join-Path $output 'auth-id-stubs.sql'
$dataPath = Join-Path $output 'project-local-data.sql'
if ((Test-Path -LiteralPath $stubPath) -or (Test-Path -LiteralPath $dataPath)) {
  throw 'Refusing to overwrite an existing scoped restore artifact.'
}
$encoding = [Text.UTF8Encoding]::new($false)
$stubWriter = [IO.StreamWriter]::new($stubPath, $false, $encoding)
try {
  $stubWriter.WriteLine('COPY auth.users (id) FROM stdin;')
  foreach ($id in $authIds) { $stubWriter.WriteLine($id) }
  $stubWriter.WriteLine('\.')
} finally { $stubWriter.Dispose() }
[IO.File]::WriteAllText($dataPath, $publicText.ToString(), $encoding)

[pscustomobject]@{
  result = 'scoped_restore_prepared'
  source_terminal = $manifest.expectedMigration
  public_table_blocks = $publicTables.Count
  auth_identity_references = $authIds.Count
  scope = 'Project Local public data with Auth ID stubs; not full Auth/Storage recovery'
}
