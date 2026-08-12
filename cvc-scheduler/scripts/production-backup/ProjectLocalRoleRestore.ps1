Set-StrictMode -Version Latest

$ProjectLocalSqlIdentifierPattern = '(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)'
$ProjectLocalSqlStringLiteralPattern = "'(?:[^']|'')*'"
$ProjectLocalManagedRoles = @(
  "anon",
  "authenticated",
  "authenticator",
  "supabase_realtime_admin"
)

function Split-ProjectLocalSqlStatements {
  param([Parameter(Mandatory = $true)][string]$SqlText)

  $statements = New-Object System.Collections.Generic.List[string]
  $builder = New-Object System.Text.StringBuilder
  $state = "normal"
  $blockDepth = 0
  $dollarTag = ""
  $index = 0

  :sqlCharacters while ($index -lt $SqlText.Length) {
    $current = $SqlText[$index]
    $next = if ($index + 1 -lt $SqlText.Length) { $SqlText[$index + 1] } else { [char]0 }

    switch ($state) {
      "line_comment" {
        if ($current -eq "`n") {
          $state = "normal"
          [void]$builder.Append(" ")
        }
        $index++
        continue sqlCharacters
      }
      "block_comment" {
        if ($current -eq "/" -and $next -eq "*") {
          $blockDepth++
          $index += 2
          continue sqlCharacters
        }
        if ($current -eq "*" -and $next -eq "/") {
          $blockDepth--
          $index += 2
          if ($blockDepth -eq 0) {
            $state = "normal"
            [void]$builder.Append(" ")
          }
          continue sqlCharacters
        }
        $index++
        continue sqlCharacters
      }
      "single_quote" {
        [void]$builder.Append($current)
        if ($current -eq "'") {
          if ($next -eq "'") {
            [void]$builder.Append($next)
            $index += 2
            continue sqlCharacters
          }
          $state = "normal"
        }
        $index++
        continue sqlCharacters
      }
      "double_quote" {
        [void]$builder.Append($current)
        if ($current -eq '"') {
          if ($next -eq '"') {
            [void]$builder.Append($next)
            $index += 2
            continue sqlCharacters
          }
          $state = "normal"
        }
        $index++
        continue sqlCharacters
      }
      "dollar_quote" {
        if (
          $index + $dollarTag.Length -le $SqlText.Length -and
          $SqlText.Substring($index, $dollarTag.Length) -ceq $dollarTag
        ) {
          [void]$builder.Append($dollarTag)
          $index += $dollarTag.Length
          $state = "normal"
          continue sqlCharacters
        }
        [void]$builder.Append($current)
        $index++
        continue sqlCharacters
      }
    }

    if ($current -eq "-" -and $next -eq "-") {
      $state = "line_comment"
      $index += 2
      continue
    }
    if ($current -eq "/" -and $next -eq "*") {
      $state = "block_comment"
      $blockDepth = 1
      $index += 2
      continue
    }
    if ($current -eq "'") {
      $state = "single_quote"
      [void]$builder.Append($current)
      $index++
      continue
    }
    if ($current -eq '"') {
      $state = "double_quote"
      [void]$builder.Append($current)
      $index++
      continue
    }
    if ($current -eq '$') {
      $candidate = $SqlText.Substring($index)
      $tagMatch = [regex]::Match($candidate, '^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$')
      if ($tagMatch.Success) {
        $dollarTag = $tagMatch.Value
        $state = "dollar_quote"
        [void]$builder.Append($dollarTag)
        $index += $dollarTag.Length
        continue
      }
    }
    if ($current -eq ";") {
      $statement = $builder.ToString().Trim()
      if ($statement.Length -gt 0) {
        $statements.Add($statement)
      }
      [void]$builder.Clear()
      $index++
      continue
    }

    [void]$builder.Append($current)
    $index++
  }

  if ($state -notin @("normal", "line_comment")) {
    throw "roles_sql_lexically_unterminated_$state"
  }
  $lastStatement = $builder.ToString().Trim()
  if ($lastStatement.Length -gt 0) {
    $statements.Add($lastStatement)
  }
  return $statements.ToArray()
}

function ConvertFrom-ProjectLocalSqlIdentifier {
  param([Parameter(Mandatory = $true)][string]$Identifier)

  if ($Identifier -match '^[A-Za-z_][A-Za-z0-9_$]*$') {
    return $Identifier.ToLowerInvariant()
  }
  if ($Identifier.Length -ge 2 -and $Identifier[0] -eq '"' -and $Identifier[$Identifier.Length - 1] -eq '"') {
    $decoded = $Identifier.Substring(1, $Identifier.Length - 2).Replace('""', '"')
    if ([string]::IsNullOrWhiteSpace($decoded) -or $decoded.Length -gt 63 -or $decoded -match '[\u0000-\u001f\u007f]') {
      throw "roles_sql_identifier_invalid"
    }
    return $decoded
  }
  throw "roles_sql_identifier_invalid"
}

function Get-ProjectLocalNormalizedSqlStatement {
  param([Parameter(Mandatory = $true)][string]$Statement)
  return ([regex]::Replace($Statement, '\s+', ' ')).Trim()
}

function ConvertFrom-ProjectLocalSqlIdentifierList {
  param([Parameter(Mandatory = $true)][string]$IdentifierList)

  $listPattern = "^\s*(?<item>$ProjectLocalSqlIdentifierPattern)(?:\s*,\s*(?<item>$ProjectLocalSqlIdentifierPattern))*\s*$"
  $match = [regex]::Match($IdentifierList, $listPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if (-not $match.Success) { throw "roles_sql_identifier_list_invalid" }
  $items = @()
  foreach ($capture in $match.Groups["item"].Captures) {
    $items += ConvertFrom-ProjectLocalSqlIdentifier -Identifier $capture.Value
  }
  if ($items.Count -eq 0) { throw "roles_sql_identifier_list_empty" }
  return $items
}

function Get-ProjectLocalRolesSqlInspection {
  param([Parameter(Mandatory = $true)][string]$RolesSqlPath)

  $inspectionStage = "read"
  try {
    $sqlText = [System.IO.File]::ReadAllText($RolesSqlPath)
    $inspectionStage = "split"
    $statements = @(Split-ProjectLocalSqlStatements -SqlText $sqlText)
    $classes = @{}
    $roles = @{}
    $unclassifiedShapes = @()
    $passwordStatementCount = 0
    $configurationShapes = @()
    $membershipShapes = @()
    $parameterPrivilegeShapes = @()

    $inspectionStage = "classify"
    $identifierListPattern = "$ProjectLocalSqlIdentifierPattern(?:\s*,\s*$ProjectLocalSqlIdentifierPattern)*"
    foreach ($statement in $statements) {
    $inspectionStage = "classify_normalize"
    $normalized = Get-ProjectLocalNormalizedSqlStatement -Statement $statement
    $statementClass = $null
    if ($normalized -match '(?i)^SET\s+[A-Za-z_][A-Za-z0-9_.]*\s*=') {
      $statementClass = "session_set"
    } elseif ($normalized -match '(?i)^RESET\s+ALL$') {
      $statementClass = "session_reset"
    } elseif ($normalized -match '(?i)^SELECT\s+pg_catalog\.set_config\s*\(') {
      $statementClass = "session_set_config"
    } elseif ($normalized -match "(?i)^CREATE\s+ROLE\s+(?<role>$ProjectLocalSqlIdentifierPattern)$") {
      $inspectionStage = "classify_create_role"
      $statementClass = "create_role"
      $roles[(ConvertFrom-ProjectLocalSqlIdentifier -Identifier $Matches.role)] = $true
    } elseif ($normalized -match "(?i)^ALTER\s+ROLE\s+(?<role>$ProjectLocalSqlIdentifierPattern)\s+WITH\s+.+$") {
      $inspectionStage = "classify_alter_properties"
      $statementClass = "alter_role_properties"
      $roles[(ConvertFrom-ProjectLocalSqlIdentifier -Identifier $Matches.role)] = $true
      if ($normalized -match '(?i)\bPASSWORD\b') { $passwordStatementCount++ }
    } elseif ($normalized -match "(?i)^ALTER\s+ROLE\s+(?<role>$ProjectLocalSqlIdentifierPattern)(?:\s+IN\s+DATABASE\s+$ProjectLocalSqlIdentifierPattern)?\s+(?:SET|RESET)\s+.+$") {
      $inspectionStage = "classify_alter_configuration"
      $statementClass = "alter_role_configuration"
      $configurationRole = ConvertFrom-ProjectLocalSqlIdentifier -Identifier $Matches.role
      $roles[$configurationRole] = $true
      $configurationMatch = [regex]::Match(
        $normalized,
        "(?i)^ALTER\s+ROLE\s+$ProjectLocalSqlIdentifierPattern(?<database>\s+IN\s+DATABASE\s+$ProjectLocalSqlIdentifierPattern)?\s+(?<action>SET|RESET)\s+(?<parameter>$ProjectLocalSqlIdentifierPattern)(?:\s+(?:TO|=)\s+(?<value>.+))?$"
      )
      if (-not $configurationMatch.Success) { throw "roles_sql_configuration_syntax_unsupported" }
      $configurationShapes += [ordered]@{
        role = $configurationRole
        database_scoped = -not [string]::IsNullOrWhiteSpace($configurationMatch.Groups["database"].Value)
        action = $configurationMatch.Groups["action"].Value.ToUpperInvariant()
        parameter = ConvertFrom-ProjectLocalSqlIdentifier -Identifier $configurationMatch.Groups["parameter"].Value
        value_kind = if ([string]::IsNullOrWhiteSpace($configurationMatch.Groups["value"].Value)) { "none" } elseif ($configurationMatch.Groups["value"].Value -match "^'(?:[^']|'')*'$") { "single_quoted" } else { "other" }
        value_length = $configurationMatch.Groups["value"].Value.Length
      }
    } elseif ($normalized -match "(?i)^GRANT\s+(?<granted>$identifierListPattern)\s+TO\s+(?<members>$identifierListPattern)(?<admin>\s+WITH\s+ADMIN\s+OPTION)?(?:\s+GRANTED\s+BY\s+(?<grantor>$ProjectLocalSqlIdentifierPattern))?$") {
      $inspectionStage = "classify_grant_membership"
      $statementClass = "grant_role_membership"
      $grantedText = $Matches.granted
      $membersText = $Matches.members
      $adminOption = $Matches.ContainsKey("admin") -and -not [string]::IsNullOrWhiteSpace($Matches.admin)
      $grantorText = if ($Matches.ContainsKey("grantor")) { $Matches.grantor } else { $null }
      $grantedRoles = @(ConvertFrom-ProjectLocalSqlIdentifierList -IdentifierList $grantedText)
      $memberRoles = @(ConvertFrom-ProjectLocalSqlIdentifierList -IdentifierList $membersText)
      foreach ($roleName in @($grantedRoles + $memberRoles)) { $roles[$roleName] = $true }
      $grantorName = $null
      if (-not [string]::IsNullOrWhiteSpace($grantorText)) {
        $grantorName = ConvertFrom-ProjectLocalSqlIdentifier -Identifier $grantorText
        $roles[$grantorName] = $true
      }
      $membershipShapes += [ordered]@{
        granted_roles = $grantedRoles
        member_roles = $memberRoles
        admin_option = $adminOption
        grantor = $grantorName
      }
    } elseif ($normalized -match "(?i)^GRANT\s+SET\s+ON\s+PARAMETER\s+(?<parameter>$ProjectLocalSqlIdentifierPattern)\s+TO\s+(?<grantees>$identifierListPattern)$") {
      $inspectionStage = "classify_grant_parameter_set"
      $statementClass = "grant_parameter_set"
      $parameterName = ConvertFrom-ProjectLocalSqlIdentifier -Identifier $Matches.parameter
      $granteeRoles = @(ConvertFrom-ProjectLocalSqlIdentifierList -IdentifierList $Matches.grantees)
      foreach ($roleName in $granteeRoles) { $roles[$roleName] = $true }
      $parameterPrivilegeShapes += [ordered]@{
        parameter = $parameterName
        grantees = $granteeRoles
      }
    } elseif ($normalized -match '(?i)^REVOKE\s+.+\s+FROM\s+.+$') {
      $statementClass = "revoke_role_membership"
    } elseif ($normalized -match "(?i)^COMMENT\s+ON\s+ROLE\s+(?<role>$ProjectLocalSqlIdentifierPattern)\s+IS\s+.+$") {
      $inspectionStage = "classify_comment_role"
      $statementClass = "comment_role"
      $roles[(ConvertFrom-ProjectLocalSqlIdentifier -Identifier $Matches.role)] = $true
    } elseif ($normalized -match '(?i)^ALTER\s+(?:DATABASE|SCHEMA|TABLE|FUNCTION|SEQUENCE|TYPE)\b') {
      $statementClass = "ownership_or_object_alter"
    } else {
      $statementClass = "unclassified"
      $firstKeyword = [regex]::Match($normalized, '^[A-Za-z]+').Value.ToUpperInvariant()
      $unclassifiedShapes += [ordered]@{
        length = $normalized.Length
        first_keyword = $firstKeyword
        contains_password = $normalized -match '(?i)\bPASSWORD\b'
        contains_grant = $normalized -match '(?i)\bGRANT\b'
        contains_alter = $normalized -match '(?i)\bALTER\b'
        contains_to = $normalized -match '(?i)\bTO\b'
        contains_granted_by = $normalized -match '(?i)\bGRANTED\s+BY\b'
        contains_admin_option = $normalized -match '(?i)\bADMIN\s+OPTION\b'
        contains_set_option = $normalized -match '(?i)\bSET\s+OPTION\b'
        contains_inherit_option = $normalized -match '(?i)\bINHERIT\s+OPTION\b'
        contains_on_parameter = $normalized -match '(?i)\bON\s+PARAMETER\b'
        contains_on = $normalized -match '(?i)\bON\b'
      }
    }
    if (-not $classes.ContainsKey($statementClass)) { $classes[$statementClass] = 0 }
    $inspectionStage = "classify_count"
    $classes[$statementClass]++
    }

    $inspectionStage = "result"
    return [ordered]@{
      statement_count = $statements.Count
      classes = $classes
      role_count = $roles.Count
      roles = @($roles.Keys | Sort-Object)
      password_or_verifier_statement_count = $passwordStatementCount
      configurations = $configurationShapes
      memberships = $membershipShapes
      parameter_privileges = $parameterPrivilegeShapes
      unclassified_statement_count = $unclassifiedShapes.Count
      unclassified_shapes = $unclassifiedShapes
    }
  } catch {
    if ($_.Exception.Message -match '^roles_sql_[a-z0-9_]+$') { throw }
    throw "roles_sql_inspection_$inspectionStage"
  }
}

function ConvertTo-ProjectLocalSqlIdentifier {
  param([Parameter(Mandatory = $true)][string]$Identifier)
  return '"' + $Identifier.Replace('"', '""') + '"'
}

function ConvertTo-ProjectLocalSqlLiteral {
  param([AllowEmptyString()][string]$Value)
  return "'" + $Value.Replace("'", "''") + "'"
}

function ConvertFrom-ProjectLocalSqlStringLiteral {
  param([Parameter(Mandatory = $true)][string]$Literal)
  if ($Literal -notmatch "^$ProjectLocalSqlStringLiteralPattern$") {
    throw "roles_sql_string_literal_invalid"
  }
  return $Literal.Substring(1, $Literal.Length - 2).Replace("''", "'")
}

function Get-ProjectLocalRolePropertyPlan {
  param(
    [Parameter(Mandatory = $true)][string]$Properties,
    [Parameter(Mandatory = $true)][bool]$ManagedRole
  )

  $simpleProperties = @{
    "SUPERUSER" = @{ column = "rolsuper"; expected = $true; privileged = $true }
    "NOSUPERUSER" = @{ column = "rolsuper"; expected = $false; privileged = $false }
    "INHERIT" = @{ column = "rolinherit"; expected = $true; privileged = $false }
    "NOINHERIT" = @{ column = "rolinherit"; expected = $false; privileged = $false }
    "CREATEROLE" = @{ column = "rolcreaterole"; expected = $true; privileged = $true }
    "NOCREATEROLE" = @{ column = "rolcreaterole"; expected = $false; privileged = $false }
    "CREATEDB" = @{ column = "rolcreatedb"; expected = $true; privileged = $true }
    "NOCREATEDB" = @{ column = "rolcreatedb"; expected = $false; privileged = $false }
    "LOGIN" = @{ column = "rolcanlogin"; expected = $true; privileged = $false }
    "NOLOGIN" = @{ column = "rolcanlogin"; expected = $false; privileged = $false }
    "REPLICATION" = @{ column = "rolreplication"; expected = $true; privileged = $true }
    "NOREPLICATION" = @{ column = "rolreplication"; expected = $false; privileged = $false }
    "BYPASSRLS" = @{ column = "rolbypassrls"; expected = $true; privileged = $true }
    "NOBYPASSRLS" = @{ column = "rolbypassrls"; expected = $false; privileged = $false }
  }
  $tokens = New-Object System.Collections.Generic.List[object]
  $seen = @{}
  $offset = 0
  $tokenPattern = "\G\s*(?:(?<simple>(?:NO)?SUPERUSER|(?:NO)?INHERIT|(?:NO)?CREATEROLE|(?:NO)?CREATEDB|(?:NO)?LOGIN|(?:NO)?REPLICATION|(?:NO)?BYPASSRLS)|CONNECTION\s+LIMIT\s+(?<limit>-?\d+)|PASSWORD\s+(?<password>NULL|$ProjectLocalSqlStringLiteralPattern)|VALID\s+UNTIL\s+(?<valid>$ProjectLocalSqlStringLiteralPattern))"
  $tokenRegex = New-Object System.Text.RegularExpressions.Regex($tokenPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase, [timespan]::FromSeconds(1))
  while ($offset -lt $Properties.Length) {
    $match = $tokenRegex.Match($Properties, $offset)
    if (-not $match.Success -or $match.Index -ne $offset) { throw "roles_sql_role_properties_unsupported" }
    if ($match.Groups["simple"].Success) {
      $name = $match.Groups["simple"].Value.ToUpperInvariant()
      if ($seen.ContainsKey($simpleProperties[$name].column)) { throw "roles_sql_role_property_duplicate" }
      if (-not $ManagedRole -and $simpleProperties[$name].privileged) { throw "roles_sql_user_privileged_property_refused" }
      $seen[$simpleProperties[$name].column] = $true
      $tokens.Add([ordered]@{
        kind = "boolean"
        sql = $name
        column = $simpleProperties[$name].column
        expected = $simpleProperties[$name].expected
      })
    } elseif ($match.Groups["limit"].Success) {
      if ($seen.ContainsKey("rolconnlimit")) { throw "roles_sql_role_property_duplicate" }
      $limit = [int]$match.Groups["limit"].Value
      if ($limit -lt -1) { throw "roles_sql_connection_limit_invalid" }
      $seen["rolconnlimit"] = $true
      $tokens.Add([ordered]@{ kind = "integer"; sql = "CONNECTION LIMIT $limit"; column = "rolconnlimit"; expected = $limit })
    } elseif ($match.Groups["password"].Success) {
      if ($seen.ContainsKey("password")) { throw "roles_sql_role_property_duplicate" }
      if ($ManagedRole) { throw "roles_sql_managed_password_unsupported" }
      $seen["password"] = $true
      $tokens.Add([ordered]@{ kind = "credential"; sql = "PASSWORD $($match.Groups['password'].Value)" })
    } elseif ($match.Groups["valid"].Success) {
      if ($seen.ContainsKey("rolvaliduntil")) { throw "roles_sql_role_property_duplicate" }
      $valid = ConvertFrom-ProjectLocalSqlStringLiteral -Literal $match.Groups["valid"].Value
      if ($valid -match '[\u0000-\u001f\u007f]') { throw "roles_sql_valid_until_invalid" }
      $seen["rolvaliduntil"] = $true
      $tokens.Add([ordered]@{ kind = "valid_until"; sql = "VALID UNTIL $($match.Groups['valid'].Value)"; column = "rolvaliduntil"; expected = $valid })
    }
    $offset = $match.Index + $match.Length
  }
  if ($tokens.Count -eq 0) { throw "roles_sql_role_properties_empty" }
  return $tokens.ToArray()
}

function New-ProjectLocalRoleRestorePlan {
  param([Parameter(Mandatory = $true)][string]$RolesSqlPath)

  $sqlText = [System.IO.File]::ReadAllText($RolesSqlPath)
  $statements = @(Split-ProjectLocalSqlStatements -SqlText $sqlText)
  $records = New-Object System.Collections.Generic.List[object]
  $createdRoles = @{}
  $identifierListPattern = "$ProjectLocalSqlIdentifierPattern(?:\s*,\s*$ProjectLocalSqlIdentifierPattern)*"
  $approvedSessionStatements = @(
    "SET default_transaction_read_only = off",
    "SET client_encoding = 'UTF8'",
    "SET standard_conforming_strings = on",
    "RESET ALL"
  )

  foreach ($statement in $statements) {
    $normalized = Get-ProjectLocalNormalizedSqlStatement -Statement $statement
    if ($approvedSessionStatements -ccontains $normalized) {
      $records.Add([ordered]@{ kind = "session"; sql = $normalized })
      continue
    }
    if ($normalized -match "(?i)^CREATE\s+ROLE\s+(?<role>$ProjectLocalSqlIdentifierPattern)$") {
      $roleName = ConvertFrom-ProjectLocalSqlIdentifier -Identifier $Matches.role
      if ($createdRoles.ContainsKey($roleName)) { throw "roles_sql_duplicate_create_role" }
      $createdRoles[$roleName] = $true
      $records.Add([ordered]@{ kind = "create"; role = $roleName })
      continue
    }
    if ($normalized -match "(?i)^ALTER\s+ROLE\s+(?<role>$ProjectLocalSqlIdentifierPattern)\s+WITH\s+(?<properties>.+)$") {
      $records.Add([ordered]@{
        kind = "properties"
        role = ConvertFrom-ProjectLocalSqlIdentifier -Identifier $Matches.role
        properties_text = $Matches.properties
      })
      continue
    }
    $configurationMatch = [regex]::Match(
      $normalized,
      "(?i)^ALTER\s+ROLE\s+(?<role>$ProjectLocalSqlIdentifierPattern)(?<database>\s+IN\s+DATABASE\s+$ProjectLocalSqlIdentifierPattern)?\s+(?<action>SET|RESET)\s+(?<parameter>$ProjectLocalSqlIdentifierPattern)(?:\s+(?:TO|=)\s+(?<value>.+))?$"
    )
    if ($configurationMatch.Success) {
      if ($configurationMatch.Groups["database"].Success) { throw "roles_sql_database_scoped_configuration_unsupported" }
      $action = $configurationMatch.Groups["action"].Value.ToUpperInvariant()
      $parameter = ConvertFrom-ProjectLocalSqlIdentifier -Identifier $configurationMatch.Groups["parameter"].Value
      $value = $null
      if ($action -eq "SET") {
        if (-not $configurationMatch.Groups["value"].Success) { throw "roles_sql_configuration_value_missing" }
        $value = ConvertFrom-ProjectLocalSqlStringLiteral -Literal $configurationMatch.Groups["value"].Value
      } elseif ($configurationMatch.Groups["value"].Success) {
        throw "roles_sql_reset_value_unsupported"
      }
      $records.Add([ordered]@{
        kind = "configuration"
        role = ConvertFrom-ProjectLocalSqlIdentifier -Identifier $configurationMatch.Groups["role"].Value
        action = $action
        parameter = $parameter
        value = $value
      })
      continue
    }
    if ($normalized -match "(?i)^GRANT\s+SET\s+ON\s+PARAMETER\s+(?<parameter>$ProjectLocalSqlIdentifierPattern)\s+TO\s+(?<grantees>$identifierListPattern)$") {
      $records.Add([ordered]@{
        kind = "parameter_privilege"
        parameter = ConvertFrom-ProjectLocalSqlIdentifier -Identifier $Matches.parameter
        grantees = @(ConvertFrom-ProjectLocalSqlIdentifierList -IdentifierList $Matches.grantees)
      })
      continue
    }
    if ($normalized -match "(?i)^GRANT\s+(?<granted>$identifierListPattern)\s+TO\s+(?<members>$identifierListPattern)(?<admin>\s+WITH\s+ADMIN\s+OPTION)?(?:\s+GRANTED\s+BY\s+(?<grantor>$ProjectLocalSqlIdentifierPattern))?$") {
      $grantedText = $Matches.granted
      $membersText = $Matches.members
      $adminOption = $Matches.ContainsKey("admin") -and -not [string]::IsNullOrWhiteSpace($Matches.admin)
      $grantor = $null
      if ($Matches.ContainsKey("grantor") -and -not [string]::IsNullOrWhiteSpace($Matches.grantor)) {
        $grantor = ConvertFrom-ProjectLocalSqlIdentifier -Identifier $Matches.grantor
      }
      $records.Add([ordered]@{
        kind = "membership"
        granted = @(ConvertFrom-ProjectLocalSqlIdentifierList -IdentifierList $grantedText)
        members = @(ConvertFrom-ProjectLocalSqlIdentifierList -IdentifierList $membersText)
        admin = $adminOption
        grantor = $grantor
      })
      continue
    }
    throw "roles_sql_statement_class_unsupported"
  }

  $managedRoles = @{}
  $userRoles = @{}
  foreach ($roleName in $createdRoles.Keys) {
    if ($ProjectLocalManagedRoles -ccontains $roleName) { $managedRoles[$roleName] = $true } else { $userRoles[$roleName] = $true }
  }
  foreach ($record in $records) {
    $referenced = @()
    if ($record.Contains("role")) { $referenced += $record.role }
    if ($record.kind -eq "parameter_privilege") { $referenced += $record.grantees }
    if ($record.kind -eq "membership") {
      $referenced += $record.granted
      $referenced += $record.members
      if ($null -ne $record.grantor) { $referenced += $record.grantor }
    }
    foreach ($roleName in $referenced) {
      if ($ProjectLocalManagedRoles -ccontains $roleName) {
        $managedRoles[$roleName] = $true
      } elseif ($createdRoles.ContainsKey($roleName)) {
        $userRoles[$roleName] = $true
      } else {
        throw "roles_sql_uncreated_user_role_reference"
      }
    }
  }

  $derived = New-Object System.Collections.Generic.List[string]
  foreach ($record in $records | Where-Object { $_.kind -eq "session" }) { $derived.Add($record.sql + ";") }

  foreach ($roleName in @($managedRoles.Keys | Sort-Object)) {
    $literal = ConvertTo-ProjectLocalSqlLiteral -Value $roleName
    $derived.Add("DO `$project_local`$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $literal) THEN RAISE EXCEPTION 'project_local_managed_role_missing'; END IF; END `$project_local`$;")
  }

  foreach ($roleName in @($userRoles.Keys | Sort-Object)) {
    $derived.Add("CREATE ROLE $(ConvertTo-ProjectLocalSqlIdentifier -Identifier $roleName);")
  }

  foreach ($record in $records | Where-Object { $_.kind -eq "properties" }) {
    $managed = $managedRoles.ContainsKey($record.role)
    $propertyPlan = @(Get-ProjectLocalRolePropertyPlan -Properties $record.properties_text -ManagedRole $managed)
    if ($managed) {
      $roleLiteral = ConvertTo-ProjectLocalSqlLiteral -Value $record.role
      foreach ($property in $propertyPlan) {
        if ($property.kind -eq "credential") { throw "roles_sql_managed_password_unsupported" }
        if ($property.kind -eq "valid_until") { throw "roles_sql_managed_valid_until_unsupported" }
        $expectedSql = if ($property.kind -eq "boolean") { if ($property.expected) { "true" } else { "false" } } else { [string]$property.expected }
        $derived.Add("DO `$project_local`$ DECLARE actual_value text; BEGIN SELECT $($property.column)::text INTO actual_value FROM pg_catalog.pg_roles WHERE rolname = $roleLiteral; IF actual_value IS DISTINCT FROM '$expectedSql' THEN RAISE EXCEPTION 'project_local_managed_role_property_mismatch'; END IF; END `$project_local`$;")
      }
    } else {
      $propertySql = ($propertyPlan | ForEach-Object { $_.sql }) -join " "
      $derived.Add("ALTER ROLE $(ConvertTo-ProjectLocalSqlIdentifier -Identifier $record.role) WITH $propertySql;")
    }
  }

  foreach ($record in $records | Where-Object { $_.kind -eq "configuration" }) {
    if ($record.parameter -cne "statement_timeout") { throw "roles_sql_configuration_parameter_unsupported" }
    if ($record.action -eq "SET" -and $record.value -notmatch '^[0-9]+(?:ms|s|min|h)?$') { throw "roles_sql_statement_timeout_value_invalid" }
    if ($managedRoles.ContainsKey($record.role)) {
      $roleLiteral = ConvertTo-ProjectLocalSqlLiteral -Value $record.role
      $settingValue = if ($record.action -eq "SET") { "$($record.parameter)=$($record.value)" } else { $record.parameter }
      $settingLiteral = ConvertTo-ProjectLocalSqlLiteral -Value $settingValue
      $condition = if ($record.action -eq "SET") {
        "EXISTS (SELECT 1 FROM pg_catalog.pg_roles AS r CROSS JOIN LATERAL unnest(COALESCE(r.rolconfig, ARRAY[]::text[])) AS setting WHERE r.rolname = $roleLiteral AND setting = $settingLiteral)"
      } else {
        "NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles AS r CROSS JOIN LATERAL unnest(COALESCE(r.rolconfig, ARRAY[]::text[])) AS setting WHERE r.rolname = $roleLiteral AND setting LIKE $(ConvertTo-ProjectLocalSqlLiteral -Value ($record.parameter + '=%')))"
      }
      $derived.Add("DO `$project_local`$ BEGIN IF NOT ($condition) THEN RAISE EXCEPTION 'project_local_managed_role_configuration_mismatch'; END IF; END `$project_local`$;")
    } else {
      $roleIdentifier = ConvertTo-ProjectLocalSqlIdentifier -Identifier $record.role
      $parameterIdentifier = ConvertTo-ProjectLocalSqlIdentifier -Identifier $record.parameter
      if ($record.action -eq "SET") {
        $derived.Add("ALTER ROLE $roleIdentifier SET $parameterIdentifier TO $(ConvertTo-ProjectLocalSqlLiteral -Value $record.value);")
      } else {
        $derived.Add("ALTER ROLE $roleIdentifier RESET $parameterIdentifier;")
      }
    }
  }

  foreach ($record in $records | Where-Object { $_.kind -eq "parameter_privilege" }) {
    if ($record.parameter -cne "log_min_messages") { throw "roles_sql_parameter_privilege_unsupported" }
    foreach ($grantee in $record.grantees) {
      if (-not $managedRoles.ContainsKey($grantee)) { throw "roles_sql_user_parameter_privilege_refused" }
      $granteeLiteral = ConvertTo-ProjectLocalSqlLiteral -Value $grantee
      $parameterLiteral = ConvertTo-ProjectLocalSqlLiteral -Value $record.parameter
      $derived.Add("DO `$project_local`$ BEGIN IF NOT pg_catalog.has_parameter_privilege($granteeLiteral, $parameterLiteral, 'SET') THEN RAISE EXCEPTION 'project_local_managed_parameter_privilege_mismatch'; END IF; END `$project_local`$;")
    }
  }

  foreach ($record in $records | Where-Object { $_.kind -eq "membership" }) {
    $allRoles = @($record.granted + $record.members)
    if ($null -ne $record.grantor) { $allRoles += $record.grantor }
    $allManaged = @($allRoles | Where-Object { -not $managedRoles.ContainsKey($_) }).Count -eq 0
    $allUser = @($allRoles | Where-Object { -not $userRoles.ContainsKey($_) }).Count -eq 0
    if (-not $allManaged -and -not $allUser) { throw "roles_sql_mixed_membership_unsupported" }
    foreach ($grantedRole in $record.granted) {
      foreach ($memberRole in $record.members) {
        if ($allManaged) {
          $grantedLiteral = ConvertTo-ProjectLocalSqlLiteral -Value $grantedRole
          $memberLiteral = ConvertTo-ProjectLocalSqlLiteral -Value $memberRole
          $adminSql = if ($record.admin) { "true" } else { "false" }
          $grantorCondition = ""
          if ($null -ne $record.grantor) {
            $grantorCondition = " AND grantor.rolname = $(ConvertTo-ProjectLocalSqlLiteral -Value $record.grantor)"
          }
          $derived.Add("DO `$project_local`$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members AS membership JOIN pg_catalog.pg_roles AS granted ON granted.oid = membership.roleid JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member LEFT JOIN pg_catalog.pg_roles AS grantor ON grantor.oid = membership.grantor WHERE granted.rolname = $grantedLiteral AND member.rolname = $memberLiteral AND membership.admin_option = $adminSql$grantorCondition) THEN RAISE EXCEPTION 'project_local_managed_role_membership_mismatch'; END IF; END `$project_local`$;")
        } else {
          $adminSql = if ($record.admin) { " WITH ADMIN OPTION" } else { "" }
          if ($null -ne $record.grantor) { throw "roles_sql_user_membership_grantor_unsupported" }
          $derived.Add("GRANT $(ConvertTo-ProjectLocalSqlIdentifier -Identifier $grantedRole) TO $(ConvertTo-ProjectLocalSqlIdentifier -Identifier $memberRole)$adminSql;")
        }
      }
    }
  }

  return [ordered]@{
    statement_count = $statements.Count
    managed_role_count = $managedRoles.Count
    managed_roles = @($managedRoles.Keys | Sort-Object)
    user_role_count = $userRoles.Count
    user_roles = @($userRoles.Keys | Sort-Object)
    derived_statement_count = $derived.Count
    derived_sql = $derived.ToArray()
  }
}

function Write-ProjectLocalRoleRestoreSql {
  param(
    [Parameter(Mandatory = $true)][string]$RolesSqlPath,
    [Parameter(Mandatory = $true)][string]$OutputPath
  )

  $plan = New-ProjectLocalRoleRestorePlan -RolesSqlPath $RolesSqlPath
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($OutputPath, (($plan.derived_sql -join "`n") + "`n"), $encoding)
  return [ordered]@{
    statement_count = $plan.statement_count
    managed_role_count = $plan.managed_role_count
    managed_roles = $plan.managed_roles
    user_role_count = $plan.user_role_count
    user_roles = $plan.user_roles
    derived_statement_count = $plan.derived_statement_count
  }
}
