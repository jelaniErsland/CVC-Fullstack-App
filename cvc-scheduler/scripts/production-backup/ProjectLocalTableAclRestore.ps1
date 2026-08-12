Set-StrictMode -Version Latest

function Get-ProjectLocalTablePrivilegeContract {
  param([Parameter(Mandatory = $true)][string]$ContractPath)

  if (-not (Test-Path -LiteralPath $ContractPath)) {
    throw "project_local_privilege_contract_missing"
  }
  $contract = Get-Content -LiteralPath $ContractPath -Raw | ConvertFrom-Json
  $expectedGrantees = @("PUBLIC", "anon", "authenticated") | Sort-Object
  $actualGrantees = @($contract.protectedGrantees | Sort-Object)
  $tables = @($contract.directPrivileges.PSObject.Properties.Name)

  if (
    $contract.version -cne "20260812123430" -or
    $contract.schema -cne "public" -or
    $contract.creatorRole -cne "postgres" -or
    ($actualGrantees -join ",") -cne ($expectedGrantees -join ",") -or
    $tables.Count -ne 13 -or
    (@($tables | Sort-Object -Unique)).Count -ne 13
  ) {
    throw "project_local_privilege_contract_invalid"
  }

  foreach ($table in $tables) {
    if ($table -notmatch '^[a-z][a-z0-9_]*$') { throw "project_local_privilege_contract_invalid" }
    $tableContract = $contract.directPrivileges.$table
    foreach ($grantee in $contract.protectedGrantees) {
      if ($null -eq $tableContract.$grantee) { throw "project_local_privilege_contract_invalid" }
    }
  }
  foreach ($grantee in $contract.protectedGrantees) {
    if ($null -eq $contract.defaultTablePrivileges.$grantee) { throw "project_local_privilege_contract_invalid" }
  }
  return $contract
}

function ConvertTo-ProjectLocalAclGrantee {
  param([Parameter(Mandatory = $true)][string]$Value)
  $normalized = $Value.Trim().Trim('"')
  if ($normalized -ieq "PUBLIC") { return "PUBLIC" }
  if ($normalized -ieq "anon") { return "anon" }
  if ($normalized -ieq "authenticated") { return "authenticated" }
  return $normalized
}

function ConvertTo-ProjectLocalAclTableName {
  param([Parameter(Mandatory = $true)][string]$Value)
  $match = [regex]::Match(
    $Value.Trim(),
    '^(?:"public"|public)\.(?:"(?<quoted>[a-z][a-z0-9_]*)"|(?<plain>[a-z][a-z0-9_]*))$',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )
  if (-not $match.Success) { throw "source_table_acl_target_unsupported" }
  if ($match.Groups["quoted"].Success) { return $match.Groups["quoted"].Value }
  return $match.Groups["plain"].Value
}

function Get-ProjectLocalContractPrivilegeRows {
  param([Parameter(Mandatory = $true)]$Contract)
  $rows = @()
  foreach ($table in $Contract.directPrivileges.PSObject.Properties.Name) {
    foreach ($grantee in $Contract.protectedGrantees) {
      foreach ($privilege in $Contract.directPrivileges.$table.$grantee) {
        $rows += [pscustomobject]@{
          table_name = $table
          grantee = [string]$grantee
          privilege_type = ([string]$privilege).ToUpperInvariant()
        }
      }
    }
  }
  return @($rows | Sort-Object table_name, grantee, privilege_type)
}

function ConvertTo-ProjectLocalPrivilegeKeys {
  param([Parameter(Mandatory = $true)][object[]]$Rows)
  return @($Rows | ForEach-Object {
    "$($_.table_name)|$(ConvertTo-ProjectLocalAclGrantee -Value ([string]$_.grantee))|$(([string]$_.privilege_type).ToUpperInvariant())"
  } | Sort-Object -Unique)
}

function ConvertFrom-ProjectLocalAclQualifiedIdentifier {
  param([Parameter(Mandatory = $true)][string]$Value)
  $pattern = "^\s*(?<schema>$ProjectLocalSqlIdentifierPattern)\s*\.\s*(?<table>$ProjectLocalSqlIdentifierPattern)\s*$"
  $match = [regex]::Match($Value, $pattern)
  if (-not $match.Success) { throw "source_table_qualified_identifier_unsupported" }
  $schema = ConvertFrom-ProjectLocalSqlIdentifier -Identifier $match.Groups["schema"].Value
  $table = ConvertFrom-ProjectLocalSqlIdentifier -Identifier $match.Groups["table"].Value
  return [pscustomobject]@{
    schema = $schema
    table = $table
    schema_qualified = $true
    schema_quoted = $match.Groups["schema"].Value.StartsWith('"')
    table_quoted = $match.Groups["table"].Value.StartsWith('"')
  }
}

function ConvertTo-ProjectLocalAclPrivilegeList {
  param([Parameter(Mandatory = $true)][string]$Value)
  $privileges = @()
  foreach ($rawPrivilege in $Value.Split(',')) {
    $privilege = $rawPrivilege.Trim().ToUpperInvariant()
    if ($privilege -notmatch '^(?:ALL(?:\s+PRIVILEGES)?|[A-Z][A-Z_ ]*)$') {
      throw "source_table_privilege_syntax_unsupported"
    }
    $privileges += $privilege
  }
  return @($privileges | Sort-Object -Unique)
}

function Get-ProjectLocalSourceTableAclPlan {
  param(
    [Parameter(Mandatory = $true)][string]$SchemaSqlPath,
    [Parameter(Mandatory = $true)]$Contract
  )

  $schemaSql = [System.IO.File]::ReadAllText($SchemaSqlPath)
  $statements = @(Split-ProjectLocalSqlStatements -SqlText $schemaSql)
  $tables = @($Contract.directPrivileges.PSObject.Properties.Name)
  $protectedGrantees = @($Contract.protectedGrantees)
  $identifier = $ProjectLocalSqlIdentifierPattern
  $qualified = "(?<qualified>(?<schema>$identifier)\s*\.\s*(?<table>$identifier))"
  $createPattern = "^CREATE\s+TABLE\s+(?<if_not_exists>IF\s+NOT\s+EXISTS\s+)?$qualified\s*\("
  $alterPattern = "^ALTER\s+TABLE\s+(?<only>ONLY\s+)?$qualified\s+(?<action>.+)$"
  $tableAclPattern = "^(?<verb>GRANT|REVOKE)\s+(?<privileges>.+?)\s+ON\s+TABLE\s+$qualified\s+(?<direction>TO|FROM)\s+(?<grantees>.+?)(?:\s+WITH\s+GRANT\s+OPTION)?$"
  $defaultAclPattern = "^ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+(?<owner>$identifier)(?:\s+IN\s+SCHEMA\s+(?<default_schema>$identifier))?\s+(?<verb>GRANT|REVOKE)\s+(?<privileges>.+?)\s+ON\s+(?<object_type>TABLES|SEQUENCES|FUNCTIONS|TYPES|SCHEMAS)\s+(?<direction>TO|FROM)\s+(?<grantees>.+?)(?:\s+WITH\s+GRANT\s+OPTION)?$"
  $tableState = @{}
  foreach ($table in $tables) {
    $tableState[$table] = [ordered]@{
      table_name = $table
      create_statement_count = 0
      create_grammar = @()
      create_schema_qualified = $false
      create_schema_quoted = $false
      create_table_quoted = $false
      create_normalized_length = 0
      ownership_statement_count = 0
      ownership_grammar = @()
      ownership_has_only = $false
      ownership_schema_quoted = $false
      ownership_table_quoted = $false
      ownership_normalized_length = 0
      explicit_table_acl_statement_count = 0
      explicit_table_acl_grammar = @()
      protected_grants = @()
      service_role_acl_statement_count = 0
    }
  }
  $rows = @()
  $sourceDefaultPrivilegeStatements = @()
  $unclassifiedSecurityStatements = @()
  foreach ($rawStatement in $statements) {
    $statement = Get-ProjectLocalNormalizedSqlStatement -Statement $rawStatement
    $createMatch = [regex]::Match($statement, $createPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($createMatch.Success) {
      $target = ConvertFrom-ProjectLocalAclQualifiedIdentifier -Value $createMatch.Groups["qualified"].Value
      if ($target.schema -cne "public") { continue }
      if ($target.table -notin $tables) { throw "source_unexpected_public_table_definition" }
      $state = $tableState[$target.table]
      $state.create_statement_count++
      $state.create_grammar += if ($createMatch.Groups["if_not_exists"].Success) { "CREATE_TABLE_IF_NOT_EXISTS" } else { "CREATE_TABLE" }
      $state.create_schema_qualified = $target.schema_qualified
      $state.create_schema_quoted = $target.schema_quoted
      $state.create_table_quoted = $target.table_quoted
      $state.create_normalized_length = $statement.Length
      continue
    }
    if ($statement -match '^(?i)CREATE\s+TABLE\b') {
      $unclassifiedSecurityStatements += "CREATE_TABLE_UNSUPPORTED"
      continue
    }

    $alterMatch = [regex]::Match($statement, $alterPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($alterMatch.Success) {
      $target = ConvertFrom-ProjectLocalAclQualifiedIdentifier -Value $alterMatch.Groups["qualified"].Value
      if ($target.schema -cne "public") { continue }
      if ($target.table -notin $tables) { throw "source_unexpected_public_table_alteration" }
      $state = $tableState[$target.table]
      $action = $alterMatch.Groups["action"].Value
      $ownerMatch = [regex]::Match($action, "^OWNER\s+TO\s+(?<owner>$identifier)$", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      if ($ownerMatch.Success) {
        $owner = ConvertFrom-ProjectLocalSqlIdentifier -Identifier $ownerMatch.Groups["owner"].Value
        if ($owner -cne "postgres") { throw "source_table_owner_mismatch" }
        $state.ownership_statement_count++
        $state.ownership_grammar += "ALTER_TABLE_OWNER"
        $state.ownership_has_only = $alterMatch.Groups["only"].Success
        $state.ownership_schema_quoted = $target.schema_quoted
        $state.ownership_table_quoted = $target.table_quoted
        $state.ownership_normalized_length = $statement.Length
        continue
      }
      if (
        $action -match "^(?i)ADD\s+CONSTRAINT\s+$identifier\s+" -or
        $action -match "^(?i)ALTER\s+COLUMN\s+$identifier\s+SET\s+DEFAULT\s+" -or
        $action -match '^(?i)(?:ENABLE|FORCE)\s+ROW\s+LEVEL\s+SECURITY$'
      ) {
        continue
      }
      $unclassifiedSecurityStatements += "ALTER_TABLE_ACTION_UNSUPPORTED"
      continue
    }
    if ($statement -match '^(?i)ALTER\s+TABLE\b') {
      $unclassifiedSecurityStatements += "ALTER_TABLE_UNSUPPORTED"
      continue
    }

    $aclMatch = [regex]::Match($statement, $tableAclPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($aclMatch.Success) {
      $target = ConvertFrom-ProjectLocalAclQualifiedIdentifier -Value $aclMatch.Groups["qualified"].Value
      if ($target.schema -cne "public") { continue }
      if ($target.table -notin $tables) { throw "source_unexpected_public_table_acl" }
      $state = $tableState[$target.table]
      $state.explicit_table_acl_statement_count++
      $state.explicit_table_acl_grammar += "$($aclMatch.Groups['verb'].Value.ToUpperInvariant())_TABLE"
      $privileges = ConvertTo-ProjectLocalAclPrivilegeList -Value $aclMatch.Groups["privileges"].Value
      foreach ($rawGrantee in $aclMatch.Groups["grantees"].Value.Split(',')) {
        $grantee = ConvertTo-ProjectLocalAclGrantee -Value $rawGrantee
        if ($grantee -notin @($protectedGrantees + @("service_role", "postgres"))) {
          throw "source_table_acl_grantee_unsupported"
        }
        if ($grantee -ceq "service_role") { $state.service_role_acl_statement_count++ }
        if ($aclMatch.Groups["verb"].Value -ieq "GRANT" -and $grantee -in $protectedGrantees) {
          foreach ($privilege in $privileges) {
            if ($privilege -match '^ALL(?:\s+PRIVILEGES)?$') { throw "source_protected_table_grant_all_unsupported" }
            $rows += [pscustomobject]@{ table_name = $target.table; grantee = $grantee; privilege_type = $privilege }
            $state.protected_grants += "$grantee`:$privilege"
          }
        }
      }
      continue
    }
    if ($statement -match '^(?i)(?:GRANT|REVOKE)\b[\s\S]*\bON\s+(?:ALL\s+)?TABLES?\b') {
      $unclassifiedSecurityStatements += "TABLE_ACL_UNSUPPORTED"
      continue
    }

    $defaultMatch = [regex]::Match($statement, $defaultAclPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($defaultMatch.Success) {
      $owner = ConvertFrom-ProjectLocalSqlIdentifier -Identifier $defaultMatch.Groups["owner"].Value
      $defaultSchema = if ($defaultMatch.Groups["default_schema"].Success) { ConvertFrom-ProjectLocalSqlIdentifier -Identifier $defaultMatch.Groups["default_schema"].Value } else { "<global>" }
      $privileges = ConvertTo-ProjectLocalAclPrivilegeList -Value $defaultMatch.Groups["privileges"].Value
      foreach ($rawGrantee in $defaultMatch.Groups["grantees"].Value.Split(',')) {
        $grantee = ConvertTo-ProjectLocalAclGrantee -Value $rawGrantee
        $sourceDefaultPrivilegeStatements += [pscustomobject]@{
          owner = $owner
          schema = $defaultSchema
          object_type = $defaultMatch.Groups["object_type"].Value.ToUpperInvariant()
          verb = $defaultMatch.Groups["verb"].Value.ToUpperInvariant()
          direction = $defaultMatch.Groups["direction"].Value.ToUpperInvariant()
          grantee = $grantee
          privileges = ($privileges -join ',')
        }
      }
      continue
    }
    if ($statement -match '^(?i)ALTER\s+DEFAULT\s+PRIVILEGES\b') {
      $unclassifiedSecurityStatements += "DEFAULT_ACL_UNSUPPORTED"
    }
  }

  if ($unclassifiedSecurityStatements.Count -ne 0) { throw "source_security_statement_shape_unclassified" }
  foreach ($table in $tables) {
    $state = $tableState[$table]
    if ($state.create_statement_count -ne 1) { throw "source_table_shape_mismatch" }
    if ($state.ownership_statement_count -ne 1) { throw "source_table_owner_mismatch" }
  }

  $actualKeys = ConvertTo-ProjectLocalPrivilegeKeys -Rows $rows
  $contractRows = Get-ProjectLocalContractPrivilegeRows -Contract $Contract
  $contractKeys = ConvertTo-ProjectLocalPrivilegeKeys -Rows $contractRows
  if (($actualKeys -join ',') -cne ($contractKeys -join ',')) {
    throw "source_table_acl_contract_mismatch"
  }

  $quotedTables = $tables | ForEach-Object { 'public."' + $_ + '"' }
  $neutralizationSql = @"
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, PUBLIC;
"@
  $reconciliationLines = @(
    "REVOKE ALL PRIVILEGES ON TABLE $($quotedTables -join ', ') FROM anon, authenticated, PUBLIC;"
  )
  foreach ($grantee in $protectedGrantees) {
    $granteeRows = @($rows | Where-Object { $_.grantee -ceq $grantee } | Sort-Object privilege_type, table_name)
    foreach ($group in @($granteeRows | Group-Object privilege_type)) {
      $grantTables = @($group.Group | ForEach-Object { 'public."' + $_.table_name + '"' } | Sort-Object -Unique)
      if ($grantTables.Count -gt 0) {
        $granteeSql = if ($grantee -ceq "PUBLIC") { "PUBLIC" } else { '"' + $grantee + '"' }
        $reconciliationLines += "GRANT $($group.Name) ON TABLE $($grantTables -join ', ') TO $granteeSql;"
      }
    }
  }

  $tableDefinitionCount = 0
  $ownershipStatementCount = 0
  $explicitTableAclStatementCount = 0
  $serviceRoleAclStatementCount = 0
  foreach ($table in $tables) {
    $tableDefinitionCount += [int]$tableState[$table].create_statement_count
    $ownershipStatementCount += [int]$tableState[$table].ownership_statement_count
    $explicitTableAclStatementCount += [int]$tableState[$table].explicit_table_acl_statement_count
    $serviceRoleAclStatementCount += [int]$tableState[$table].service_role_acl_statement_count
  }

  return [pscustomobject]@{
    table_count = $tables.Count
    table_definition_count = $tableDefinitionCount
    ownership_statement_count = $ownershipStatementCount
    explicit_table_acl_statement_count = $explicitTableAclStatementCount
    service_role_acl_statement_count = $serviceRoleAclStatementCount
    source_default_privilege_statement_count = $sourceDefaultPrivilegeStatements.Count
    source_default_privileges = $sourceDefaultPrivilegeStatements
    table_diagnostics = @($tableState.Values | ForEach-Object { [pscustomobject]$_ } | Sort-Object table_name)
    unclassified_security_relevant_statement_count = $unclassifiedSecurityStatements.Count
    protected_grantee_count = $protectedGrantees.Count
    expected_direct_privilege_count = $actualKeys.Count
    expected_direct_privilege_keys = $actualKeys
    neutralization_sql = $neutralizationSql.Trim()
    reconciliation_sql = ($reconciliationLines -join "`r`n")
  }
}

function Write-ProjectLocalSourceTableAclSql {
  param(
    [Parameter(Mandatory = $true)][string]$SchemaSqlPath,
    [Parameter(Mandatory = $true)][string]$ContractPath,
    [Parameter(Mandatory = $true)][string]$NeutralizationPath,
    [Parameter(Mandatory = $true)][string]$ReconciliationPath
  )
  $contract = Get-ProjectLocalTablePrivilegeContract -ContractPath $ContractPath
  $plan = Get-ProjectLocalSourceTableAclPlan -SchemaSqlPath $SchemaSqlPath -Contract $contract
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($NeutralizationPath, $plan.neutralization_sql + "`r`n", $utf8)
  [System.IO.File]::WriteAllText($ReconciliationPath, $plan.reconciliation_sql + "`r`n", $utf8)
  return $plan
}

function Get-ProjectLocalDirectPrivilegeMetadataSql {
  param([Parameter(Mandatory = $true)]$Contract)
  $tableList = ($Contract.directPrivileges.PSObject.Properties.Name | ForEach-Object { "'$_'" }) -join ","
  $granteeList = ($Contract.protectedGrantees | ForEach-Object { "'$_'" }) -join ","
  return "select coalesce(string_agg(relation.relname || '|' || coalesce(grantee.rolname, 'PUBLIC') || '|' || expanded.privilege_type, ',' order by relation.relname, coalesce(grantee.rolname, 'PUBLIC'), expanded.privilege_type), '') from pg_catalog.pg_class as relation join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace cross join lateral pg_catalog.aclexplode(coalesce(relation.relacl, pg_catalog.acldefault('r', relation.relowner))) as expanded left join pg_catalog.pg_roles as grantee on grantee.oid = expanded.grantee where namespace.nspname = 'public' and relation.relkind in ('r','p') and relation.relname in ($tableList) and coalesce(grantee.rolname, 'PUBLIC') in ($granteeList);"
}

function Get-ProjectLocalDefaultPrivilegeMetadataSql {
  param([Parameter(Mandatory = $true)]$Contract)
  $granteeList = ($Contract.protectedGrantees | ForEach-Object { "'$_'" }) -join ","
  return "select coalesce(string_agg(owner_role.rolname || '|' || namespace.nspname || '|' || coalesce(grantee.rolname, 'PUBLIC') || '|' || expanded.privilege_type, ',' order by coalesce(grantee.rolname, 'PUBLIC'), expanded.privilege_type), '') from pg_catalog.pg_default_acl as defaults join pg_catalog.pg_roles as owner_role on owner_role.oid = defaults.defaclrole join pg_catalog.pg_namespace as namespace on namespace.oid = defaults.defaclnamespace cross join lateral pg_catalog.aclexplode(defaults.defaclacl) as expanded left join pg_catalog.pg_roles as grantee on grantee.oid = expanded.grantee where defaults.defaclobjtype = 'r' and owner_role.rolname = 'postgres' and namespace.nspname = 'public' and coalesce(grantee.rolname, 'PUBLIC') in ($granteeList);"
}
