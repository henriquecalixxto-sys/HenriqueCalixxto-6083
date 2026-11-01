/**
 * Retention windows, declared on their own.
 *
 * These constants live apart from the retention job itself because the admin
 * security console reports them, and the console's route is part of the API
 * type that the Expo app consumes. Importing the job would drag a Node CLI
 * entry point (process.argv, process.exit, the S3 client) into the mobile type
 * graph, where none of it exists. A plain constants module keeps the numbers
 * shared and the runtime surfaces separate.
 */

/** Client paperwork is deleted from storage and the database after this long. */
export const DOCUMENT_RETENTION_DAYS = Number(process.env.DOCUMENT_RETENTION_DAYS ?? 365);

/** Audit trail is kept slightly beyond a year so a full year is always reviewable. */
export const AUDIT_RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS ?? 400);

/** Failed sign-in telemetry is short-lived; it only serves lockout and triage. */
export const LOGIN_ATTEMPT_RETENTION_DAYS = 30;

/** Resolved contact enquiries, kept for two years for business follow-up. */
export const RESOLVED_INQUIRY_RETENTION_DAYS = Number(process.env.INQUIRY_RETENTION_DAYS ?? 730);
