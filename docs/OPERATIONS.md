# Operations

Use one server per institution. Department officers see institution-wide academic records; finance sees finance records; lecturers access assigned units. This is not a tenant-isolated service for unrelated institutions.

## Backups

Stop the server and administrative commands. Copy the entire data directory to an access-controlled backup, then restart. It includes attachments and sessions. Keep it out of public ZIPs and Git. Test restoring backups.

## Staff access

Staff sign up as lecturers. The operator assigns roles with:

```sh
node manage.mjs staff person@example.edu department
node manage.mjs staff person@example.edu finance
node manage.mjs staff person@example.edu lecturer
```

The third command removes office privileges. Role changes revoke sessions. Ordinary department approval cannot grant office roles via the public API.

## Payments

Verify references against actual finance records. A receipt is a claim. Verification adds its amount to the paid balance once. Reject claims already credited. Reconcile overpayments before adjusting statements.

## Evidence

PDF, PNG, JPEG or text; maximum 300 KB per file and five per case. Downloads require authentication and case access. Avoid unrelated sensitive material. Antivirus scanning and automated retention deletion are not included.

## Connectivity

Only static files are cached. Proxies must permit Server-Sent Events and reconnections. Downloaded calendars are snapshots; refresh them after schedule changes. Drafts retain text on the device; Save draft syncs it to the account when online. Attachments are not part of drafts.
