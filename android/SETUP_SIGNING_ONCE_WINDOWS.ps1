# YAWMI LifeOS: one-time setup for automatically signed GitHub Android releases.
# Run on YOUR Windows PC. Never paste the private key or password into chat.
# Prerequisites: GitHub CLI (gh), OpenSSL (often bundled with Git for Windows).
param([string]$BackupZip = "")

$ErrorActionPreference = 'Stop'
$repository = 'yawmi-life/home'
$expected = 'YAWMI_ANDROID_SIGNING_BACKUP_PRIVATE.pem'
$temp = Join-Path ([IO.Path]::GetTempPath()) ('yawmi-signing-' + [Guid]::NewGuid().ToString('N'))

function Check-Command([string]$name) {
  $command = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $command) { throw "Missing $name. Install official GitHub CLI and OpenSSL first." }
  return $command.Source
}

try {
  $gh = Check-Command 'gh'
  $openssl = Get-Command 'openssl' -ErrorAction SilentlyContinue
  if ($openssl) { $openssl = $openssl.Source }
  elseif (Test-Path 'C:\Program Files\Git\usr\bin\openssl.exe') {
    $openssl = 'C:\Program Files\Git\usr\bin\openssl.exe'
  } else {
    throw 'OpenSSL not found. Install Git for Windows or OpenSSL, then rerun this script.'
  }
  $tar = Check-Command 'tar'
  if (-not $BackupZip) {
    $BackupZip = Read-Host 'Full path to YAWMI_ANDROID_SIGNING_BACKUP_OWNER_ONLY.zip'
  }
  $BackupZip = (Resolve-Path -LiteralPath $BackupZip).Path
  if (-not (Test-Path -LiteralPath $BackupZip -PathType Leaf)) {
    throw 'YAWMI owner backup ZIP not found.'
  }

  New-Item -ItemType Directory -Path $temp -Force | Out-Null
  Expand-Archive -LiteralPath $BackupZip -DestinationPath $temp -Force

  $private = Join-Path $temp $expected
  $public  = Join-Path $temp 'YAWMI_ANDROID_SIGNING_BACKUP_PUBLIC.crt'
  $cms     = Join-Path $temp 'signing-backup.cms'
  $archive = Join-Path $temp 'recovered-original.tar.gz'
  foreach ($path in @($private,$public,$cms)) {
    if (-not (Test-Path -LiteralPath $path)) {throw 'Backup ZIP is missing one of the required original files.'}
  }
  & $openssl cms -decrypt -binary -inform DER -in $cms -recip $public -inkey $private -out $archive
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $archive)) {throw 'Decryption failed. Original backup not modified.'}
  & $tar -xzf $archive -C $temp
  if ($LASTEXITCODE -ne 0) {throw 'Unable to unpack original signing identity.'}

  $keystore = Join-Path $temp 'yawmi-release.jks'
  $passwordFile = Join-Path $temp 'signing-password.txt'
  if (-not (Test-Path $keystore) -or -not (Test-Path $passwordFile)) {
    throw 'Original keystore or password not found after recovery.'
  }
  $keyB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($keystore))
  $password = [IO.File]::ReadAllText($passwordFile).Trim()
  if ($keyB64.Length -lt 1000 -or $password.Length -lt 12) {
    throw 'Recovered signing material appears invalid.'
  }

  & $gh auth status 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Sign in to your GitHub account in the browser using GitHub CLI.'
    & $gh auth login --hostname github.com --web
    if ($LASTEXITCODE -ne 0) {throw 'GitHub sign-in not completed.'}
  }

  # gh encrypts secrets to GitHub's Actions public key. No secret is stored in the repository.
  $keyB64 | & $gh secret set YAWMI_ANDROID_KEYSTORE_B64 --repo $repository
  if ($LASTEXITCODE -ne 0) {throw 'Failed to save YAWMI_ANDROID_KEYSTORE_B64.'}
  $password | & $gh secret set YAWMI_ANDROID_KEYSTORE_PASSWORD --repo $repository
  if ($LASTEXITCODE -ne 0) {throw 'Failed to save YAWMI_ANDROID_KEYSTORE_PASSWORD.'}
  $keyB64 = $null
  $password = $null

  Write-Host 'Original signing identity stored in GitHub Actions Secrets.'
  Write-Host 'Starting official signed update workflow...'
  & $gh workflow run yawmi-android-apk.yml --repo $repository --ref main
  if ($LASTEXITCODE -ne 0) {
    throw 'Secrets saved, but workflow dispatch failed. Trigger it manually from GitHub Actions.'
  }
  Write-Host 'Done. Inspect https://github.com/yawmi-life/home/actions'
  Write-Host 'The workflow checks the ORIGINAL signing certificate before publishing any APK.'
}
finally {
  # Delete plaintext signing materials as soon as the setup finishes.
  $keyB64 = $null
  $password = $null
  if (Test-Path -LiteralPath $temp) {
    Remove-Item -LiteralPath $temp -Force -Recurse -ErrorAction SilentlyContinue
  }
}
