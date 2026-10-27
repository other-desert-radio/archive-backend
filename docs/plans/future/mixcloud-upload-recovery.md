# Mixcloud upload recovery

## Status

Partially implemented: confirmed uploads with no linked archive Show are listed
under pending uploads on Shows, with a shared count button before grid/table.
They survive reload and can resume preparation/review/save without uploading
again. Failed preparations remain pending; successful saves leave the queue.
Uncertain attempts, reconciliation, and provider upload retries remain deferred.

## Intended behavior

- Record the editorial draft and original Mixcloud account before contacting
  Mixcloud. Track active attempts, deadlines, returned keys, and safe errors.
- Extend the shared pending uploads action for editors and admins to include
  uncertain attempts, labeled clearly. Rejected uploads without a confirmed key
  do not contribute to the count.
- Resume from database state after reload or a lost response. Treat interrupted
  provider attempts as uncertain after their deadline.
- Reconcile an uncertain upload by accepting its existing Mixcloud URL,
  validating the original account, and fetching its metadata for review.
- Retry fetch and save independently without uploading the MP3 again. Actual
  upload retries require selecting the files again and connecting the original
  Mixcloud account. Never automatically repeat a provider upload.
- Prevent concurrent provider attempts and duplicate archive saves. Retain the
  existing transactional source tracking and save replay behavior.

## Acceptance

Cover browser reload, lost upload/save responses, interrupted server requests,
concurrent recovery, account mismatch, and uncertain reconciliation. Confirm
toolbar counts and shared access, and verify no recovery action silently repeats
a provider upload.

If Mixcloud accepts an upload but its response is lost before a pending record
is confirmed, check Mixcloud manually before considering another upload.
