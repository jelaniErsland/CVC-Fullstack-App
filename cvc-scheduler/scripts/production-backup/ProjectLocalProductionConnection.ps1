Set-StrictMode -Version Latest

function Get-ProjectLocalProductionConnectionSafeDiagnostics {
  param(
    [string]$ConnectionInput,
    [Parameter(Mandatory = $true)][string]$ExpectedProjectRef
  )

  $inputValue = if ($null -eq $ConnectionInput) { "" } else { $ConnectionInput }
  $trimmedValue = $inputValue.Trim()
  $containsBom = $trimmedValue.IndexOf([char]0xFEFF) -ge 0
  $normalizedValue = $trimmedValue.TrimStart([char]0xFEFF).Trim()
  $containsOuterQuote = $false
  if ($normalizedValue.Length -ge 2) {
    $first = $normalizedValue[0]
    $last = $normalizedValue[$normalizedValue.Length - 1]
    $containsOuterQuote = ($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")
    if ($containsOuterQuote) {
      $normalizedValue = $normalizedValue.Substring(1, $normalizedValue.Length - 2).Trim()
    }
  }

  $diagnosticUri = $null
  $uriTryCreateSuccess = [System.Uri]::TryCreate(
    $normalizedValue,
    [System.UriKind]::Absolute,
    [ref]$diagnosticUri
  )

  return [ordered]@{
    plaintext_character_count = $inputValue.Length
    trimmed_character_count = $normalizedValue.Length
    starts_with_expected_scheme = $normalizedValue -match '^(?i)postgres(?:ql)?://'
    contains_exactly_one_scheme_separator = ([regex]::Matches($normalizedValue, '://').Count -eq 1)
    contains_expected_username_marker = $normalizedValue.IndexOf("postgres.$ExpectedProjectRef`:", [System.StringComparison]::Ordinal) -ge 0
    contains_at_separator = $normalizedValue.Contains("@")
    contains_expected_pooler_suffix = $normalizedValue.IndexOf(".pooler.supabase.com", [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    contains_expected_port_marker = $normalizedValue.IndexOf(":5432/", [System.StringComparison]::Ordinal) -ge 0
    ends_with_postgres_path = $normalizedValue.EndsWith("/postgres", [System.StringComparison]::Ordinal)
    contains_control_character = $normalizedValue -match '[\u0000-\u001f\u007f]'
    contains_BOM = $containsBom
    contains_outer_quote = $containsOuterQuote
    uri_trycreate_success = $uriTryCreateSuccess
  }
}

function ConvertTo-ProjectLocalProductionSessionPoolerUrl {
  param(
    [Parameter(Mandatory = $true)][string]$ConnectionInput,
    [Parameter(Mandatory = $true)][string]$ExpectedProjectRef,
    [Parameter(Mandatory = $true)][string]$ForbiddenStagingRef
  )

  if ([string]::IsNullOrWhiteSpace($ConnectionInput)) {
    throw "Production database connection validation failed: input_empty."
  }

  $normalized = $ConnectionInput.Trim().TrimStart([char]0xFEFF).Trim()
  if ($normalized.Length -ge 2) {
    $first = $normalized[0]
    $last = $normalized[$normalized.Length - 1]
    if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
      $normalized = $normalized.Substring(1, $normalized.Length - 2).Trim()
    }
  }
  if ([string]::IsNullOrWhiteSpace($normalized)) {
    throw "Production database connection validation failed: input_empty."
  }
  if ($normalized -match "[\r\n]") {
    throw "Production database connection validation failed: wrapper_text_not_allowed."
  }
  if ($normalized.IndexOf($ForbiddenStagingRef, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
    throw "Production database connection validation failed: staging_ref_not_allowed."
  }

  $match = [regex]::Match(
    $normalized,
    '^(?<scheme>postgres|postgresql)://(?<userinfo>.+)@(?<host>[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?):(?<port>[0-9]+)/(?<database>[^/?#]+)(?<remainder>.*)$',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [System.Text.RegularExpressions.RegexOptions]::CultureInvariant
  )
  if (-not $match.Success) {
    if ($normalized -notmatch '^(?i)postgres(?:ql)?://') {
      throw "Production database connection validation failed: scheme_prefix_missing."
    }
    throw "Production database connection validation failed: target_shape_invalid."
  }

  $scheme = $match.Groups["scheme"].Value.ToLowerInvariant()
  if ($scheme -notin @("postgres", "postgresql")) {
    throw "Production database connection validation failed: scheme_invalid."
  }
  $hostName = $match.Groups["host"].Value.ToLowerInvariant()
  if (
    $hostName -notmatch '^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+pooler\.supabase\.com$' -or
    -not $hostName.EndsWith(".pooler.supabase.com", [System.StringComparison]::OrdinalIgnoreCase)
  ) {
    throw "Production database connection validation failed: host_invalid."
  }
  if ($match.Groups["port"].Value -ne "5432") {
    throw "Production database connection validation failed: port_invalid."
  }
  if ($match.Groups["database"].Value -cne "postgres") {
    throw "Production database connection validation failed: database_invalid."
  }
  $remainder = $match.Groups["remainder"].Value
  if ($remainder.StartsWith("?")) {
    throw "Production database connection validation failed: query_not_allowed."
  }
  if ($remainder.StartsWith("#")) {
    throw "Production database connection validation failed: fragment_not_allowed."
  }
  if (-not [string]::IsNullOrEmpty($remainder)) {
    throw "Production database connection validation failed: database_invalid."
  }

  $userInfo = $match.Groups["userinfo"].Value
  $separatorIndex = $userInfo.IndexOf(":", [System.StringComparison]::Ordinal)
  if ($separatorIndex -lt 1) {
    throw "Production database connection validation failed: username_invalid."
  }
  $userName = $userInfo.Substring(0, $separatorIndex)
  if ($userName -cne "postgres.$ExpectedProjectRef") {
    throw "Production database connection validation failed: username_invalid."
  }
  $suppliedCredential = $userInfo.Substring($separatorIndex + 1)
  if ([string]::IsNullOrEmpty($suppliedCredential)) {
    throw "Production database connection validation failed: password_missing."
  }

  $credential = $null
  try {
    $credential = [System.Uri]::UnescapeDataString($suppliedCredential)
    if ([string]::IsNullOrEmpty($credential) -or $credential -match "[\u0000-\u001f\u007f]") {
      throw "Production database connection validation failed: password_invalid."
    }
    $encodedCredential = [System.Uri]::EscapeDataString($credential)
    $canonical = "${scheme}://${userName}:${encodedCredential}@${hostName}:5432/postgres"
  } finally {
    $credential = $null
  }

  $uri = $null
  if (-not [System.Uri]::TryCreate($canonical, [System.UriKind]::Absolute, [ref]$uri) -or -not $uri.IsAbsoluteUri) {
    throw "Production database connection validation failed: canonical_uri_parse_failed."
  }
  if (
    $uri.Scheme -notin @("postgres", "postgresql") -or
    $uri.Host -cne $hostName -or
    $uri.Port -ne 5432 -or
    $uri.AbsolutePath -cne "/postgres" -or
    -not [string]::IsNullOrEmpty($uri.Query) -or
    -not [string]::IsNullOrEmpty($uri.Fragment) -or
    -not $uri.UserInfo.StartsWith("postgres.$ExpectedProjectRef`:", [System.StringComparison]::Ordinal)
  ) {
    throw "Production database connection validation failed: canonical_validation_failed."
  }

  return $canonical
}
