# Mixcloud upload recovery

## Status

Deferred. The initial upload/review/save workflow has no recovery queue, toolbar
action, reconciliation endpoint, or automatic upload retries.

## Intended behavior

- Record the editorial draft and original Mixcloud account before contacting
  Mixcloud. Track active attempts, deadlines, returned keys, and safe errors.
- Add a shared **ready to save [N]** action to the Shows toolbar for editors and
  admins. Include confirmed uploads awaiting review and uncertain attempts;
  label uncertain items clearly. Confirmed upload failures stay in the initial
  modal and do not contribute to the count.
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

Until implemented, a successful upload can remain pending without a resume UI.
If Mixcloud accepts an upload but its response is lost, check Mixcloud manually
before considering another upload.
