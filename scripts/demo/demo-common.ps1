Set-StrictMode -Version Latest

function Assert-DemoName {
  param([Parameter(Mandatory)][string]$DatabaseName)
  if ($DatabaseName -cnotmatch '^travelmate_demo_\d{8}$') {
    throw 'Only a full travelmate_demo_YYYYMMDD database name is allowed.'
  }
}

function Test-DemoPortOpen {
  param([Parameter(Mandatory)][int]$Port)
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $attempt = $client.ConnectAsync('127.0.0.1', $Port)
    return $attempt.Wait(500) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Get-DemoConnection {
  param([Parameter(Mandatory)][string]$DatabaseName, [string]$EnvironmentFile = '')
  Assert-DemoName $DatabaseName
  $repository = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
  if (-not $EnvironmentFile) { $EnvironmentFile = Join-Path $repository 'backend\.env' }
  $setting = Get-Content -LiteralPath $environmentFile |
    Where-Object { $_ -match '^DATABASE_URL=' } |
    Select-Object -First 1
  if (-not $setting) { throw 'The existing database setting is missing.' }

  $raw = $setting.Substring('DATABASE_URL='.Length).Trim().Trim('"').Trim("'")
  try { $uri = [Uri]$raw } catch { throw 'The existing database setting is invalid.' }
  if ($uri.Scheme -notin @('postgresql', 'postgres') -or
      [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/')) -cne 'travelmate') {
    throw 'The existing database setting has an unexpected source database.'
  }
  $userInfo = $uri.UserInfo.Split(':', 2)
  if ($userInfo.Count -ne 2) { throw 'The existing database setting lacks credentials.' }
  $demoUrl = $raw -creplace '/travelmate(?=\?|$)', "/$DatabaseName"
  if ($demoUrl -ceq $raw) { throw 'The demo database substitution failed.' }

  [pscustomobject]@{
    Name = $DatabaseName
    Url = $demoUrl
    Host = $uri.Host
    Port = $uri.Port
    User = [Uri]::UnescapeDataString($userInfo[0])
    Password = [Uri]::UnescapeDataString($userInfo[1])
    Repository = $repository
  }
}

function Invoke-DemoPsql {
  param(
    [Parameter(Mandatory)]$Connection,
    [Parameter(Mandatory)][string]$Sql,
    [ValidateSet('demo', 'postgres')][string]$Target = 'demo'
  )
  Assert-DemoName $Connection.Name
  $previousPassword = $env:PGPASSWORD
  $sqlFile = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText($sqlFile, $Sql, (New-Object System.Text.UTF8Encoding($false)))
    $env:PGPASSWORD = $Connection.Password
    $database = if ($Target -eq 'postgres') { 'postgres' } else { $Connection.Name }
    $output = & psql -X -A -t -v ON_ERROR_STOP=1 -h $Connection.Host -p $Connection.Port -U $Connection.User -d $database -f $sqlFile
    if ($LASTEXITCODE -ne 0) { throw 'The demo database check failed.' }
    return $output
  } finally {
    Remove-Item -LiteralPath $sqlFile -ErrorAction SilentlyContinue
    if ($null -eq $previousPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
    else { $env:PGPASSWORD = $previousPassword }
  }
}

function Assert-DemoDatabase {
  param([Parameter(Mandatory)]$Connection)
  Assert-DemoName $Connection.Name
  $actual = Invoke-DemoPsql $Connection 'SELECT current_database()'
  if ($actual.Trim() -cne $Connection.Name) {
    throw 'The connected database does not match the approved demo name.'
  }
}

function Assert-CleanDemoCounts {
  param([Parameter(Mandatory)]$Connection, [ValidateSet('preseed', 'seeded', 'seeded-v6', 'seeded-v7')][string]$SnapshotKind = 'seeded')
  $query = @'
SELECT (SELECT count(*) FROM users),
       (SELECT count(*) FROM user_preferences),
       (SELECT count(*) FROM destinations),
       (SELECT count(*) FROM places),
       (SELECT count(*) FROM saved_places),
       (SELECT count(*) FROM itineraries),
       (SELECT count(*) FROM itinerary_items),
       (SELECT count(*) FROM admin_audit_logs),
       (SELECT count(*) FROM places WHERE "deletedAt" IS NULL AND lower(btrim(category)) <> 'test');
'@
  $actual = (Invoke-DemoPsql $Connection $query).Trim()
  $expected = if ($SnapshotKind -eq 'preseed') { '0|0|6|40|0|0|0|0|40' } else { '2|1|6|40|0|1|3|0|40' }
  if ($SnapshotKind -in @('seeded-v6', 'seeded-v7')) { $expected = '2|1|6|56|0|1|3|0|56' }
  if ($actual -cne $expected) {
    throw "The clean demo snapshot has unexpected row counts: $actual"
  }
  return $actual
}
