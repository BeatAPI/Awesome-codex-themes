## Outcome

Describe the user-visible result and why it belongs in the project's current scope.

## Verification

- [ ] `pnpm check` passes on the final diff.
- [ ] New or changed engine behavior has a test that failed before implementation.
- [ ] Theme changes pass schema validation and include honest compatibility evidence.
- [ ] Gallery changes were checked at desktop and mobile widths with reduced-motion considered.
- [ ] No secrets, conversations, account data, tokens, reference-repository files, or generated `dist/` output are included.
- [ ] Adapted code/assets are identified and all required license notices are preserved.
- [ ] README/help/recovery documentation matches the changed behavior.

## Safety and recovery

State which safety invariant is touched and how a user returns to the official UI if the change fails.
