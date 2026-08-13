$ErrorActionPreference = 'Stop'

$frontendDirectory = Split-Path -Parent $PSScriptRoot
$infraDirectory = [System.IO.Path]::GetFullPath(
  (Join-Path $PSScriptRoot '..\..\finance-control-infra')
)
$composeFile = Join-Path $infraDirectory 'docker-compose.yml'
$localEnvFile = Join-Path $infraDirectory '.env'
$exampleEnvFile = Join-Path $infraDirectory '.env.example'
$envFile = if (Test-Path $localEnvFile) { $localEnvFile } else { $exampleEnvFile }
$projectName = 'finance-control-e2e'

if (-not (Test-Path $composeFile)) {
  throw "Infraestrutura não encontrada em $infraDirectory."
}

$managedVariables = @(
  'FRONTEND_PORT',
  'BFF_PORT',
  'MAILPIT_WEB_PORT',
  'BFF_AUTH_SENSITIVE_PERMIT_LIMIT',
  'AI_PROVIDER',
  'AI_API_KEY',
  'E2E_BASE_URL',
  'E2E_ISOLATED'
)
$previousValues = @{}
foreach ($name in $managedVariables) {
  $previousValues[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

$composeArguments = @(
  'compose',
  '--project-name', $projectName,
  '--env-file', $envFile,
  '--file', $composeFile
)

try {
  $env:FRONTEND_PORT = '4280'
  $env:BFF_PORT = '8180'
  $env:MAILPIT_WEB_PORT = '8125'
  $env:BFF_AUTH_SENSITIVE_PERMIT_LIMIT = '1000'
  $env:AI_PROVIDER = 'Mock'
  $env:AI_API_KEY = ''
  $env:E2E_BASE_URL = 'http://localhost:4280'
  $env:E2E_ISOLATED = 'true'

  & docker @composeArguments up --build --detach --wait
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível iniciar o ambiente Docker E2E."
  }

  Push-Location $frontendDirectory
  try {
    & npm exec playwright test
    if ($LASTEXITCODE -ne 0) {
      throw "A suíte E2E falhou."
    }
  }
  finally {
    Pop-Location
  }
}
catch {
  $diagnosticsDirectory = Join-Path $frontendDirectory 'test-results'
  New-Item -ItemType Directory -Path $diagnosticsDirectory -Force | Out-Null
  $composeLog = Join-Path $diagnosticsDirectory 'docker-compose.log'
  & docker @composeArguments logs --no-color 2>&1 |
    Out-File -FilePath $composeLog -Encoding utf8
  throw
}
finally {
  & docker @composeArguments down --volumes --remove-orphans
  foreach ($name in $managedVariables) {
    [Environment]::SetEnvironmentVariable($name, $previousValues[$name], 'Process')
  }
}
