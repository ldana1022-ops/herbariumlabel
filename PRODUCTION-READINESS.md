# Production readiness report

Date: 2026-09-08

## 1. Database

- Real managed PostgreSQL (Lovable Cloud), one instance serving preview and the published site. No mock data, no browser storage.
- 41 existing specimen records preserved unchanged, plus users, roles, permissions, requests, print log, notifications and activity log.
- Database size at audit: ~13 MB.
- Serial numbers come from a database sequence (`NCVCH######`), unique, never reused; accession number is kept in sync by a trigger.

## 2. Schema integrity

- Value checks: latitude -90..90, longitude -180..180, altitude range, non-empty scientific name and serial number.
- Trigger validation: collection/determination dates cannot be in the future; request due date cannot precede creation.
- Indexes added: specimen status/creator/collection date/updated time/serial, request assignee/creator/specimen/status, activity log actor/record, unread notifications, specimen access user.
- Trigram search indexes on scientific name, local name, Arabic local name, locality, collectors and family, so search stays fast as the collection grows.

## 3. Authentication and authorization

- Email/password sign-in with leaked-password protection enabled. No anonymous sign-ups.
- Roles: System Administrator (admin) plus per-action permissions per user (add, edit, delete, import, export, labels, status, send/receive requests, data scope).
- All authorization is enforced in the database through Row Level Security and private `SECURITY DEFINER` helper functions; the interface only hides controls.
- Editing specimens requires either System Administrator or an open request assigned to the user.
- Guests can read only a limited public specimen summary and a short-lived read-only image link.

## 4. Audit log

- Specimen, request and permission changes are recorded by database triggers.
- Public specimen page views are recorded (serial only — no IP address, user agent or referrer).
- Sign-in and sign-out are now recorded, and last sign-in time is stored on the profile.
- Log rows are readable by administrators only and cannot be inserted, changed or deleted by any client.

## 5. Storage

- Private bucket `specimen-images`, 10 MB per-file cap.
- Uploads are limited to JPG, PNG and WebP and validated before upload.
- Photos are now resized (long edge 2000 px) and re-encoded as WebP (quality 0.82) in the browser before upload, cutting typical file size from ~5 MB to a few hundred KB.
- Only the file owner or a System Administrator can replace or delete an image; all signed-in users can view.
- Existing 10 photos (49 MB total) were left untouched; a one-time re-compression can be run on request.

### Capacity estimate

| Samples | At ~5 MB/photo (legacy) | With new compression (~400 KB) |
| --- | --- | --- |
| 1,000 | ~5 GB | ~0.4 GB |
| 10,000 | ~50 GB | ~4 GB |
| 50,000 | ~250 GB | ~20 GB |
| 100,000 | ~500 GB | ~40 GB |

Row data is small: about 1.5 KB per specimen, so 100,000 samples stay well under 1 GB of database space.

## 6. Abuse protection

- Public barcode lookup and public image link are rate-limited per visitor (60 calls per minute per endpoint), keyed by a one-way hash of the caller address stored in a backend-only table that no client can read or write.

## 7. Backups and recovery

- Automatic daily database backups with point-in-time restore are handled by the platform; restore is performed from the backend settings.
- File storage is kept separately from the database.
- Longer retention or an off-platform copy of images must be arranged outside the platform and is not configured today.

## 8. Remaining items

- The specimen list still loads the full table into the browser and filters there. That is fine at the current 41 records and comfortable into the low thousands, but server-side paging is recommended before the collection passes roughly 5,000 records.
- Thumbnail generation for list views (a second small image per specimen) is not implemented; new uploads are already small enough that lists load quickly.
- Storage-level MIME restriction is enforced in the application, not in the bucket configuration, because the bucket MIME list is not exposed to the platform tooling.
