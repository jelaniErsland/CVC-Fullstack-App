# Independent Production Backup Setup

Iteration 12.29 implements the Project Local independent encrypted production backup automation foundation. It does not run a production backup, restore data, register a scheduled task, create credentials, generate a real age private identity, or provision real Bozeman product data.

Launch conclusion: `NO-GO`.

## Why this path

Project Local's current policy is to minimize recurring subscriptions until there are multiple active users every month, while preserving security, recoverability, and architectural integrity. Supabase Pro managed backups remain optional. PITR is not required for the initial Bozeman beta.

The preferred near-term path is:

- Windows PowerShell on Jelani's reviewed Windows computer.
- Windows Task Scheduler for local automation.
- Current operator OneDrive folder for private encrypted backup storage.
- Supabase CLI logical dumps.
- Docker Desktop or another working Docker engine, because Supabase CLI dump commands require Docker.
- `age` public-key encryption.
- PostgreSQL client tools for reviewed local restore drills, including `psql`.
- No GitHub Actions artifacts, caches, or public repository storage for backups.

This design depends on the operator PC being available. Task Scheduler's "run as soon as possible after a scheduled start is missed" helps recover from a sleeping/offline PC, but it is not always-on infrastructure.

## Boundary definitions

| Item | Meaning | May be stored where |
| --- | --- | --- |
| DPAPI-protected database connection secret | Windows current-user protected production DB connection secret used by the backup script | `%LOCALAPPDATA%\ProjectLocal\ProductionBackup`; never in the repository or OneDrive backup destination |
| Public age recipient | Public encryption recipient, usually beginning with `age1...` | Config/operator notes; may be in task arguments after review because it cannot decrypt backups |
| Private age recovery identity | Secret recovery key needed to decrypt backup artifacts | At least two secure offline/private locations; never in repository, task arguments, logs, OneDrive backup destination, or chat transcripts |
| Encrypted backup artifact | `.age` encrypted package containing logical dumps and a credential-free manifest | Private OneDrive backup folder only after encryption |
| Plaintext dump/archive | Temporary SQL/zip files before encryption | Unique temp directory outside repository and outside OneDrive only; deleted in `finally` |

Key-loss consequence: if the private age recovery identity is lost, encrypted backups for that recipient cannot be restored. Keep at least two secure copies. If an age recipient is rotated, future backups use the new recipient, but old backups still require the old private identity.

## Scripts

- `scripts/production-backup/Initialize-ProjectLocalBackupSecret.ps1`
  - Interactive one-time DPAPI secret setup.
  - Prompts with secure input.
  - Refuses non-Windows execution.
  - Stores under `%LOCALAPPDATA%\ProjectLocal\ProductionBackup`.
  - Does not create or store the age private recovery identity.

- `scripts/production-backup/Invoke-ProjectLocalProductionBackup.ps1`
  - Requires `-ExecuteProductionBackup` for real production backup execution.
  - Requires exact production locks: `project-local-production`, `wdlaauzknfggoqldolmx`, migration `20260714122230`.
  - Refuses staging ref `kfuujcfxoayukywvtaeh`.
  - Refuses repository destinations.
  - Requires an age public recipient.
  - Fails safely when Supabase CLI, Docker, or age is unavailable before backup execution proceeds.
  - Uses Supabase CLI logical dumps and encrypts the package before OneDrive storage.
  - Writes credential-free status.

- `scripts/production-backup/Register-ProjectLocalBackupTask.ps1`
  - Prepares Windows Task Scheduler registration.
  - Requires explicit `-ConfirmTaskAction` for register/enable/disable/unregister.
  - Does not embed database credentials or private age identities.
  - Does not silently replace unrelated tasks.

- `scripts/production-backup/Test-ProjectLocalBackupRestore.ps1`
  - Safe restore-drill boundary.
  - Defaults to fixture/dry-run guard behavior.
  - Requires explicit `-ExecuteLocalRestore` before it will run a local restore.
  - Refuses production, staging, hosted, and non-loopback restore targets.
  - Requires age private identity only for reviewed local restore drills, never for the backup command.
  - Fails safely when `psql` or age is unavailable.

## Backup package contents

The encrypted backup package may contain only:

- `roles.sql`
- `schema.sql`
- `data.sql`
- `supabase_migrations_schema.sql`
- `supabase_migrations_data.sql`
- `manifest.json`

The manifest is credential-free and may include UTC timestamp, expected project name/ref/migration, repository commit hash, Supabase CLI version, age version, dump file sizes, and backup format version.

The manifest must not include database host, connection string, database password, user password, private age identity, service-role key, anon key, SQL contents, volunteer names/counts, Auth users, table row contents, bearer/token values, environment-variable dumps, machine username, or full local paths.

The independent database backup does not back up Supabase Storage object contents. Add a separate backup plan before enabling Storage-backed features such as volunteer photos.

## One-time setup sequence

Do not paste secrets into chat, Git, screenshots, logs, or shell history.

1. Install reviewed local dependencies:
   - PowerShell on Windows.
   - Supabase CLI.
   - Docker Desktop or another Docker engine reachable by the Supabase CLI.
   - `age`.
   - PostgreSQL client tools including `psql` for local restore drills.
   - A private OneDrive folder for encrypted artifacts.
2. Run safe dependency preflight commands. These commands must not print environment variables, local secret paths, or credentials:

   ```powershell
   supabase --version
   docker version
   age --version
   psql --version
   ```

3. Generate or provide a reviewed age key pair outside this repository.
4. Store the private age recovery identity in at least two secure places.
5. Keep the public age recipient ready for backup configuration.
6. Run the DPAPI secret setup:

   ```powershell
   .\scripts\production-backup\Initialize-ProjectLocalBackupSecret.ps1
   ```

7. Confirm no credential, private identity, plaintext dump, or backup artifact was created in the public repository.

## First manual backup procedure

Do not run this until the operator has reviewed credentials, recipient, destination, and the no-production-data timing.

```powershell
.\scripts\production-backup\Invoke-ProjectLocalProductionBackup.ps1 `
  -ExecuteProductionBackup `
  -ProjectName 'project-local-production' `
  -ProjectRef 'wdlaauzknfggoqldolmx' `
  -ExpectedMigration '20260714122230' `
  -AgeRecipient '<reviewed-age1-public-recipient>' `
  -DestinationRoot "$env:OneDrive\Project Local Backups\production"
```

Expected destination layout:

- `Project Local Backups\production\daily`
- `Project Local Backups\production\weekly`
- `Project Local Backups\production\status`

Plaintext SQL and plaintext archives must never be synced to OneDrive. They belong only in a unique temp directory and must be removed by the script's cleanup path.

## Scheduled task registration

The repository does not register the task automatically. Use explicit operator action only:

```powershell
.\scripts\production-backup\Register-ProjectLocalBackupTask.ps1 `
  -Action Register `
  -ConfirmTaskAction `
  -AgeRecipient '<reviewed-age1-public-recipient>' `
  -DestinationRoot "$env:OneDrive\Project Local Backups\production"
```

The task should run under the current reviewed Windows user. It should use "run as soon as possible after a scheduled start is missed." Do not embed database credentials, decrypted secrets, or private age identities in task arguments.

## Retention

Default proposed retention:

- 14 daily encrypted backups.
- 8 weekly encrypted backups.

Retention deletes only recognized Project Local encrypted backup artifacts. It must not delete operator notes or unrecognized files.

## Status and failure review

The backup script writes a credential-free `latest-status.json` outside the repository. It may include success/failure, UTC timestamp, encrypted filename, encrypted byte size, SHA-256 checksum, and safe failure code.

It must not include raw exception text, SQL, connection values, credentials, local usernames, full sensitive paths, or database contents.

An optional Windows operator notification seam exists. Notification failure must not hide backup failure. Observability remains incomplete until the operator validates notification behavior.

## Restore drill

Before real Bozeman product data is provisioned, perform a separately reviewed restore test into local Supabase or another approved disposable non-production target:

1. Verify encrypted artifact checksum.
2. Supply the age private identity interactively or by explicit local path outside the repository.
3. Decrypt only into a unique temp directory.
4. Restore roles, schema, migration history, and data in reviewed order.
5. Use `psql --single-transaction` and `ON_ERROR_STOP=1` where applicable.
6. Verify schema, terminal migration `20260714122230`, Project Local tables, RLS/security assumptions, no unsafe broad mutation grants, app compatibility, and cleanup.
7. Remove decrypted files.

Do not restore to production or staging. Do not restore to a hosted target without a future exact reviewed opt-in.

The executable local restore boundary is intentionally explicit:

```powershell
.\scripts\production-backup\Test-ProjectLocalBackupRestore.ps1 `
  -ExecuteLocalRestore `
  -EncryptedBackupPath '<encrypted-backup.age-outside-repo>' `
  -ExpectedSha256 '<64-character-sha256>' `
  -AgeIdentityPath '<private-age-identity-outside-repo-and-backup-folder>' `
  -BackupDestinationRoot "$env:OneDrive\Project Local Backups\production" `
  -TargetHost '127.0.0.1' `
  -TargetPort 54322 `
  -TargetDatabase 'postgres' `
  -TargetUser 'postgres' `
  -ExpectedMigration '20260714122230'
```

The restore script prompts securely for the local disposable database password with `Read-Host -AsSecureString` only after target, checksum, dependency, identity-path, decrypt, and archive-member guards pass. The password is not placed in PowerShell history, normal process arguments, repository config, task arguments, or inherited environment variables; it is exposed only to each `psql` child process through child-scoped `PGPASSWORD` and cleared from temporary process setup afterward.

The script verifies the encrypted checksum before decrypting, decrypts only into a unique temp directory, rejects unexpected archive members and path traversal, restores only to loopback targets, uses `psql --single-transaction --set ON_ERROR_STOP=1`, verifies terminal migration, verifies Project Local tables/RLS/no unsafe broad mutation grants, and removes decrypted material in `finally`. The command must not be run against production, staging, hosted databases, or any non-loopback target.

## Future replacement path

A later always-on design using a private runner or private object storage may replace the Windows PC dependency without changing the encrypted logical-backup format. GitHub Actions artifacts/caches and the public repository are not approved backup storage.

## Current 12.29 status

- Backup automation foundation exists.
- Backup dependency preflights now explicitly cover Supabase CLI, Docker, age, and psql.
- No production backup has run.
- A guarded executable local restore boundary exists, but no restore has passed.
- No real age recipient/private identity/database credential is committed.
- Scheduled task is not registered.
- Preferred independent path remains incomplete pending operator key creation, safe secret setup, first successful encrypted production backup, checksum/status evidence, retention confirmation, notification confirmation, local/disposable restore test, post-restore verification, and recovery ownership.
- Supabase Pro remains optional.
- PITR remains non-blocking.
- Real Bozeman data remains unprovisioned.
- Launch remains `NO-GO`.
