# Environment Separation Plan — Go-Live Blocker 2

**Calixto Agency · 25 August 2026**

Scope: separate development from production infrastructure. Blockers 1, 3, 4 and
5 from `GO-LIVE.md` are untouched.

**Nothing was migrated, deleted, renamed or rotated by this pass.** No production
data was read, copied or modified. No database or bucket was created or removed.
No credential was changed. Every infrastructure action below is yours to perform
from a provider dashboard.

No real secret value appears in this document.

---

## A. Current architecture

Bun workspace monorepo, Turborepo. One deployable service.

```
packages/web      Vite 7 dev server + Bun production server (one port, 4200)
                  /api/*  → Hono app (packages/web/src/api/index.ts)
                  /*      → React 19 SPA from packages/web/dist
packages/mobile   Expo, talks to the same /api over HTTPS
packages/desktop  Electron shell, loads the web app over HTTP(S)
```

**There is exactly one runtime configuration.** `packages/web/src/api/database/index.ts`
and `packages/web/src/api/lib/s3.ts` each construct a single module-level client
from `process.env` at import time. There is no per-environment branch anywhere in
the data layer, and no second client. Whatever is in the environment is what the
process talks to — dev and prod are the *same code path* reading the *same
variable names*.

Environment loading, per surface:

| Surface | How env is loaded | File |
| --- | --- | --- |
| Vite dev server | `loadEnv(mode, root, '')` then `Object.assign(process.env, env)` — reads the **repo-root** `.env` | `packages/web/vite.config.ts` |
| Bun production server | Bun auto-loads `.env` from the process cwd; pm2 sets `cwd: __dirname` (repo root) so the **same root `.env`** is picked up | `ecosystem.config.cjs` |
| Drizzle CLI (`db:push`, `db:migrate`, `db:studio`) | `bun --env-file=../../.env drizzle-kit …` — the **same root `.env`** | `packages/web/package.json` |
| Ops scripts (backup, restore, retention, checks) | `bun --env-file=../../.env …` — the **same root `.env`** | `packages/web/package.json` |
| Mobile | `packages/mobile/.env`, only `EXPO_PACKAGER_PROXY_URL`; API base URL comes from `packages/mobile/app.json` `extra.apiUrl` | — |

Every one of those five paths resolves to **one file: the repo-root `.env`**.

## B. Current database configuration

- Turso / libSQL, accessed through `@libsql/client` and Drizzle ORM.
- `packages/web/src/api/database/index.ts` — one `createClient({ url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN })`, evaluated once at module load, exported as `db`.
- `packages/web/drizzle.config.ts` — `dialect: "turso"`, same two variables. Schema at `src/api/database/schema.ts`, migrations out to `./drizzle`.
- Auth tables (`user`, `session`, `account`, `verification`, `two_factor`, `rate_limit`, `login_attempts`) live in the same database as business tables.
- **The dev server, the production server, the Drizzle CLI and every ops script read the same `DATABASE_URL` and `DATABASE_AUTH_TOKEN` from the same file.**

Consequence: `bun run db:push` from a developer's machine executes DDL against
whatever `DATABASE_URL` holds. Today that is the only database there is.

## C. Current storage configuration

- Tigris, S3-compatible, via `@aws-sdk/client-s3`.
- `packages/web/src/api/lib/s3.ts` — one `S3Client` with `region: "auto"`, `endpoint: S3_ENDPOINT`, `forcePathStyle: false`, credentials from `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`.
- Bucket name is read inline as `process.env.S3_BUCKET` at **8 call sites**: `routes/portal.ts` (upload presign, HEAD confirm, delete-on-failure ×2, download presign, delete), `ops/retention.ts` (retention delete), `purge-test-accounts.ts` (purge delete).
- Uploads and downloads are presigned; the browser talks to Tigris directly. Authorization is enforced server-side before a URL is minted.
- **One bucket, one key pair, one endpoint — shared by both environments.**

Three of those eight call sites issue `DeleteObjectCommand`. Two of the three
live in scripts a developer runs by hand.

## D. The exact security problem

**One database and one bucket serve both environments, reached through one set of
credentials held in one file.** Concretely:

1. **Development has read access to every real client document.** A developer
   running the dev server holds the production Tigris key pair. Nothing in the
   code, the storage layer or the key's scope distinguishes a dev request from a
   prod request — the bucket cannot tell them apart, because they are literally
   the same credential.

2. **Development has write and delete access to production data.** `bun run db:push`
   applies schema changes to the live database. `bun run retention` and
   `bun run purge-test-accounts` delete rows *and* the corresponding S3 objects.
   `guardDestructiveScript` blocks those only when `NODE_ENV=production` — and a
   developer's `.env` says `development`. **The guard is disarmed in exactly the
   situation it was written for: a developer pointing dev tooling at prod data.**
   That is the single most dangerous fact in this report.

3. **A restore is cross-environment by construction.** `ops/restore.ts` writes to
   whatever `DATABASE_URL` names. Restoring a "dev" snapshot overwrites production.

4. **Seed data and real client data share tables.** Test accounts had to be
   removed with a dedicated purge script (`purge-test-accounts.ts`) because they
   were created in the same database as real records.

5. **Blast radius is undivided.** A leaked dev credential is a leaked prod
   credential. A dev mistake is a prod incident. There is no containment boundary
   to fall back on — that is what separation buys, and it does not exist yet.

6. **Compliance-adjacent exposure**, stated as fact and not as a compliance claim:
   client identity documents are accessible from developer workstations with no
   access-control step between the developer and the document.

## E. Target architecture

Two fully disjoint stacks. Nothing is shared — not a database, not a bucket, not
a key, not a file.

| | Development | Production |
| --- | --- | --- |
| Turso database | `calixto-dev` | `calixto-prod` |
| Turso token | dev-scoped, dev DB only | prod-scoped, prod DB only |
| Tigris bucket | `calixto-dev-docs` | `calixto-prod-docs` |
| Tigris key pair | scoped to the dev bucket only | scoped to the prod bucket only |
| `NODE_ENV` | `development` | `production` |
| `WEBSITE_URL` | `http://localhost:4200` | the production HTTPS origin |
| `BETTER_AUTH_SECRET` | dev-only value | prod-only value, never seen by a developer |
| Data | synthetic seed data only | real client data only |
| Env source | developer's local root `.env` | platform secret store, injected at deploy |
| Access to prod documents | **none, enforced by key scope** | full |

Two invariants, both non-negotiable:

- **Production never depends on a development credential.** Prod values exist only
  in the production secret store. A developer cannot read them, so a developer
  cannot leak them.
- **Development cannot reach a production document.** Enforced by the *key scope*
  at Tigris, not by application code. Code-level checks are bypassable by a
  mistake; a key that has no permission on the prod bucket is not.

Note on naming: bucket names must be globally unique on Tigris. Use a project
prefix (`calixto-`) and never reuse the current bucket name for the new dev
bucket.

## F. Data migration plan

**The safest migration is no migration.** The existing shared database *becomes*
production; development gets a new, empty database seeded with synthetic data.
Nothing is copied out of production, so there is no window in which client
documents sit in a second location.

| Step | Action | Touches production? |
| --- | --- | --- |
| 1 | Take a full backup of the current shared database: `bun run backup` | Read-only |
| 2 | Verify the snapshot is complete and restorable — see §K.1 | No |
| 3 | **Promote in place.** The current database and bucket are relabelled production. No data moves. | Label only |
| 4 | Create a NEW empty Turso database `calixto-dev` | No |
| 5 | Create a NEW empty Tigris bucket `calixto-dev-docs` | No |
| 6 | Create dev-scoped credentials for both | No |
| 7 | Point the developer `.env` at the new dev database and bucket | No |
| 8 | Apply the schema to dev: `bun run db:push` with the dev `.env` loaded | No |
| 9 | Seed synthetic data into dev: `bun run seed` | No |
| 10 | Move the production values into the platform secret store; remove them from any developer machine | Credential location only |
| 11 | Verify separation: §K | Read-only |

**Rejected alternative: copy production data into dev.** It is tempting — real
data makes for realistic testing — and it defeats the entire purpose. It would
place client identity documents on developer workstations, which is the exposure
this blocker exists to remove. If realistic dev data is ever needed, generate it
synthetically or anonymise irreversibly before it leaves production, and treat
that as a separate piece of work with its own review.

**Nothing is deleted at any point in this plan.** The current database and bucket
survive intact as production. No rename, no drop, no destructive migration. Even
step 3 is a labelling decision, not an operation.

## G. Environment variable changes

Same variable *names* in both environments — different values, different files.
Keeping the names identical is deliberate: it means zero code changes, and code
that cannot tell which environment it is in also cannot accidentally hardcode
one.

**Development (`/.env`, developer machine, gitignored):**

```
NODE_ENV=development
WEBSITE_URL=http://localhost:4200
DATABASE_URL=<dev database>
DATABASE_AUTH_TOKEN=<dev token>
DEV_DATABASE_URL=<dev database — identical to DATABASE_URL here, on purpose>
S3_BUCKET=<dev bucket>
DEV_S3_BUCKET=<dev bucket — identical to S3_BUCKET here, on purpose>
S3_ACCESS_KEY_ID=<dev key id>
S3_SECRET_ACCESS_KEY=<dev secret>
BETTER_AUTH_SECRET=<dev-only value>
```

`DEV_DATABASE_URL` and `DEV_S3_BUCKET` are the *evidence* variables. Their only
job is to let the guard prove a collision. In a developer's `.env` they duplicate
the real values; in production they must be **absent**. If a production
environment ever contains them and they match, the boot is refused — that is the
tripwire for "someone copied a dev `.env` into prod".

**Production (platform secret store, never a file in the repo):**

```
NODE_ENV=production
WEBSITE_URL=https://<production domain>
DATABASE_URL=<prod database>
DATABASE_AUTH_TOKEN=<prod token>
S3_BUCKET=<prod bucket>
S3_ACCESS_KEY_ID=<prod key id>
S3_SECRET_ACCESS_KEY=<prod secret>
BETTER_AUTH_SECRET=<prod-only value>
RESEND_API_KEY / MAIL_FROM      (Blocker 5)
DOCUMENT_/AUDIT_/INQUIRY_RETENTION_DAYS
APPLICATION_ID / VITE_APPLICATION_ID / VITE_RUNABLE_AUTH_ISSUER
# NOT set: DEV_DATABASE_URL, DEV_S3_BUCKET, ALLOW_DESTRUCTIVE, RUNABLE_URL
```

`RUNABLE_URL` is developer tooling and carries an embedded credential
(Blocker 1 §F-1). It has no place in a production runtime.

## H. Credential changes required after separation

Separation and rotation are two different jobs, and the order matters: **separate
first, rotate second.** Rotating before splitting means rotating the same
credentials again after the split.

| Credential | After separation |
| --- | --- |
| `DATABASE_AUTH_TOKEN` (prod) | Rotate — the current token was on developer machines and must be considered exposed |
| Tigris key pair (prod) | Rotate, and **scope the new pair to the prod bucket only** |
| `BETTER_AUTH_SECRET` (prod) | Rotate. Invalidates every session; forces 2FA re-enrolment. Do it before Blocker 4's admin enrolment |
| Dev credentials | Newly created during separation — nothing to rotate |
| `RUNABLE_URL` | Rotate per Blocker 1; remove from production entirely |
| `AI_GATEWAY_API_KEY`, `AUTUMN_SECRET_KEY` | Delete and revoke provider-side — unused (Blocker 1 §F-2) |

The full ordered procedure is `SECRET-ROTATION.md` §4. Its stated prerequisite is
this blocker. **Do not start it until separation is verified.**

One rule applies to every provider credential: create the new one, deploy it,
confirm it works, and *only then* revoke the old one. Creating a key is not
rotation — revoking the old one is.

## I. Manual actions required from you

None of these are automatable; each needs a provider dashboard login.

**Turso**
1. Create database `calixto-dev` in the same region as the existing one.
2. Create an auth token scoped to `calixto-dev` only.
3. Create a **new** auth token for the existing (production) database. Do not revoke the old one yet.
4. Confirm the production database has point-in-time recovery enabled (this is Blocker 3, but check it now — it costs nothing and separation is a good moment to look).

**Tigris**
5. Create bucket `calixto-dev-docs`, private, no public access.
6. Create an access key pair restricted to `calixto-dev-docs` only.
7. Create a **new** access key pair restricted to the existing production bucket only. Do not delete the old pair yet.
8. Confirm the production bucket blocks all public access and has object versioning on.

**Environments**
9. Put the production values in the platform secret store — never in a committed file, a chat message or a ticket.
10. Replace your local `.env` with the dev values, plus `DEV_DATABASE_URL` and `DEV_S3_BUCKET`.
11. Set `NODE_ENV=production` in the production environment and `development` locally.
12. Confirm no developer machine still holds a production value. Grep local shells, `.env` backups, note apps and terminal history.

**Schema and seed for dev**
13. With the dev `.env` loaded: `bun run db:push`, then `bun run seed`.
14. Confirm the dev database contains **zero** real client records.

**Verification**
15. Run §K in full and keep the output.

**Explicitly do not:** delete the existing database, delete the existing bucket,
rename either, or run any destructive script while a production value is still in
your local `.env`.

## J. Automatic changes already implemented

Implemented and verified in this pass. All read-only or configuration-only —
nothing touches data.

1. **`packages/web/src/api/lib/env-guard.ts`** — three new boot checks:
   - `db.separation` rewritten. Previously a permanent `warn` that passed whenever `DEV_DATABASE_URL` was unset — meaning it passed by default and proved nothing. Now **fatal in production when a collision is proven** (`DATABASE_URL === DEV_DATABASE_URL`), warning when unproven. A missing value cannot fail the boot; a real collision cannot pass it.
   - `storage.separation` — new. Same logic for `S3_BUCKET` vs `DEV_S3_BUCKET`. There was no storage separation check at all before this.
   - `env.no_dev_vars_in_prod` — new. Flags `DEV_DATABASE_URL`, `DEV_S3_BUCKET` or `ALLOW_DESTRUCTIVE` present under `NODE_ENV=production`, which is the signature of a dev `.env` copied into production.

2. **`packages/web/src/api/ops/check-separation.ts`** — new read-only report. Prints the runtime profile and a truncated SHA-256 digest of the database host, DB token, bucket, storage key id and session secret, then the separation verdict. Digests let you diff the dev and prod environments without either output revealing an identifier or a secret. Exit code 1 on a proven collision, so it can gate a deploy.

3. **`bun run security:separation`** — wired into the root and web `package.json`.

4. **`.env.template`** — `DEV_DATABASE_URL` documented as development-only, with the fatal-on-collision behaviour and the instruction never to set it in production.

Verified after the changes: production-profile config guard **PASS 17 / WARN 0 /
FAIL 0**, separation report **PASS 4 / WARN 0 / FAIL 0** on the current
environment. Note that the two separation checks currently pass as *unproven* —
the evidence variables are not set yet, because dev infrastructure does not exist
yet. They start proving something at step 7 of §F.

**Deliberately not implemented:** any code that creates, copies, migrates or
deletes a database, bucket or object; any credential change; any schema change.
Provisioning is a manual, reviewable act on purpose — a script that creates
infrastructure is a script that can create it in the wrong place.

## K. Verification tests

### K.1 Before touching anything

```bash
bun run backup                    # snapshot the current shared database
```

Then confirm the snapshot is real: check that the row count per table is
non-zero and matches expectations, and that credential columns are `__REDACTED__`
(that is by design — see `GO-LIVE.md`, and note that a restore therefore requires
password resets and 2FA re-enrolment).

### K.2 After separation, with the dev `.env` loaded

```bash
bun run security:separation       # expect PASS, both separation checks "proven distinct"
bun run security:config           # dev profile
```

| # | Check | Pass condition |
| --- | --- | --- |
| 1 | Dev DB is empty of real data | Zero real client records; only seed rows |
| 2 | Dev bucket is empty of real documents | Zero objects, or only test uploads |
| 3 | Dev key cannot read the prod bucket | `HeadObject` against the prod bucket with the dev key → `403` |
| 4 | Dev token cannot reach the prod DB | Connection to the prod DB with the dev token → rejected |
| 5 | Fingerprints differ | Every digest in `security:separation` differs between dev and prod |
| 6 | Dev app works end to end | Sign in, upload, download, delete against dev infrastructure |

Checks 3 and 4 are the only ones that actually prove separation. Everything else
proves the new environment works. **If 3 and 4 do not both fail closed, the
blocker is not resolved** — the two environments are still connected, whatever
the config files say.

### K.3 Against production

```bash
NODE_ENV=production bun run security:config       # expect FAIL: 0
NODE_ENV=production bun run security:separation   # expect FAIL: 0
bun run golive                                   # expect 9 steps, 0 failures
```

| # | Check | Pass condition |
| --- | --- | --- |
| 7 | Prod boots | No config-guard throw |
| 8 | Prod data intact | Row counts match the §K.1 backup |
| 9 | Prod documents intact | Object count matches pre-separation |
| 10 | Prod carries no dev variable | `env.no_dev_vars_in_prod` → PASS |
| 11 | Prod key scoped correctly | Prod key against the *dev* bucket → `403` |
| 12 | Ownership still enforced | Download as owner → 200; as another account → `404` |
| 13 | Collision tripwire works | Temporarily set `DEV_DATABASE_URL` to the prod URL under `NODE_ENV=production` → guard refuses to boot. **Unset it again.** |
| 14 | No regression | Public site, quote form, contact form, blog, portal, admin all load |

Check 13 is the one worth actually running. An untested guard is an assumption.

## L. Rollback plan

Rollback is straightforward precisely because nothing is destroyed: the
production database and bucket are never modified, so "rolling back" means
pointing configuration at what was always there.

| Failure | Rollback |
| --- | --- |
| Prod refuses to boot after the env move | Restore the previous production environment values in the secret store and redeploy. Config-only; no data involved |
| A separation check fails fatally in prod | Read the check name — it names the colliding variable. Remove the dev variable from prod, redeploy |
| New prod DB token does not work | Old token is still valid (§I step 3 says not to revoke it) — revert `DATABASE_AUTH_TOKEN` and redeploy |
| New prod Tigris pair does not work | Old pair is still valid (§I step 7) — revert both S3 variables and redeploy |
| Dev DB schema push went wrong | It only ever touched the empty dev database. Drop the dev database and recreate it. Production is untouched |
| Dev seed created bad data | Re-run the seed against dev. `guardDestructiveScript` blocks it against prod |
| Someone ran a destructive script against prod | Stop the process. Restore from the §K.1 backup and Turso PITR. This is the case the backup exists for |

Two properties make all of the above cheap, and both are deliberate:

- **Old credentials stay valid until the new ones are proven.** That is why §I
  says create-then-verify-then-revoke, and why revocation is Blocker 1's job
  rather than this one's.
- **No production data moves.** The production stack at the end of separation is
  byte-for-byte the stack that existed at the start, reached by a different
  credential from a different place. There is nothing to roll back but
  configuration.

**Point of no return:** revoking the old production credentials — which happens in
Blocker 1, not here. Everything in this plan is reversible by editing
configuration.

## M. Go-live Blocker 2 status

**Planned and instrumented, not resolved.** Development and production still
share one database, one bucket and one credential set. The tooling to prove
separation now exists and is verified; the separation itself has not been
performed, and cannot be from here — it requires creating infrastructure in the
Turso and Tigris dashboards.

Done: architecture inventoried across all five environment-loading paths; the
exact exposure identified, including the disarmed destructive-script guard; the
target architecture defined; a migration plan that copies no production data and
deletes nothing; boot-time collision detection made fatal-on-proof; a read-only
fingerprint report added.

Not done: dev database, dev bucket, dev credentials, production secret store,
verification run.

The dependency chain is: **Blocker 2 → Blocker 1 (rotation) → Blocker 4 (admin
2FA)**. Rotating before separating means doing it twice; enrolling 2FA before
rotating `BETTER_AUTH_SECRET` means enrolling twice.

**ENVIRONMENT SEPARATION REQUIRED — DO NOT GO LIVE YET**
