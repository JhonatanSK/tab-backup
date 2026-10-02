# Dashboard permission justifications

- tabs: Save the URL and title of open normal-window tabs for the user-visible automatic backup and session restore feature. No browsing-history API or page-content access.
- tabGroups: Save and recreate group membership, names, colors and collapsed state as part of the same backup/restore purpose.
- storage: Save local settings, pending backup work and restore progress across service-worker/browser restarts. Snapshot records themselves are in local IndexedDB.
- alarms: Wake the nonpersistent worker for deferred captures and a 15-minute safety check; suppress unchanged snapshots.

No host permissions. No remotely hosted executable code. All scripts ship in the ZIP. More detail: [security permission review](../security/permissions.md).
