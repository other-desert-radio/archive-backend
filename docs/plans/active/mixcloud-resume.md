# Mixcloud queue resume

Mode: one-shot. Preserve unrelated date/DJ warning edits.

- [ ] Persist independent category cursors in browser preferences; restore by
      row ID.
- [ ] Display position/total by modal title; preserve navigation and import
      behavior.
- [ ] Match date border/text and unmatched DJ warning colors.
- [ ] Update authoritative UI guide and verify focused tests, checks, browser if
      available.

Decision: pending queue position/total uses the current opening snapshot; stored
ID avoids resuming the wrong row after imports. End of queue resets to the
beginning. User review remains pending.
