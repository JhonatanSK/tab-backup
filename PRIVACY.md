# TabBackup privacy policy

Effective date: October 2, 2026. Applies to TabBackup 1.0.0.

TabBackup saves information about your open tabs so you can restore them. It handles tab URLs, optional tab titles, tab order and pinned status, normal-window structure/state/focus, group titles/colors/collapsed state, backup timestamps and extension/schema versions. URLs, titles and group names may reveal sensitive browsing activity. Recognizable authentication query parameters, URL usernames/passwords and token fragments are removed; arbitrary sensitive data elsewhere in a URL or title may remain.

Your tab data stays on this device. Snapshots use the extension's local IndexedDB database. Settings, scheduling state, limited error codes and restore progress use Chrome local extension storage. TabBackup does not use Chrome storage sync, an account, its own cloud, remote analytics, advertisements, remote error reporting or a backend. We do not receive, sell or share your tab data.

The extension does not read page content, form fields, site cookies, password stores or site localStorage. It does not record screenshots or access incognito windows. It does not collect browser history through the history API. Production logs do not contain tab URLs, titles or snapshot dumps.

Free retains up to 20 distinct snapshots. The oldest expire as new snapshots are saved. A 32 MiB serialized snapshot budget also applies; exceeding it rejects a new write. You can pause automatic backups, delete individual snapshots or delete all snapshots in Settings. Automatic backups may create new records after deletion unless you turn them off. Uninstalling removes internal extension data. Chrome profile removal, disk failure or browser storage eviction may also remove it.

Export is initiated by you and downloads an unencrypted JSON file containing selected backup records and export metadata. Import reads a file you select, validates it locally, shows a preview, and merges only after confirmation. Conflicting IDs are renamed; duplicate records are skipped; retention effects are shown. A checksum detects accidental changes, not authorship or tampering. You control where downloaded files are stored and whether they are shared or synchronized by other software. Deleting internal backups does not delete exported files; remove those yourself if needed.

Restoring opens the saved sites in new windows. Those sites can make ordinary network requests and use your existing browser sign-ins. TabBackup does not upload your backup to them or to us. Browser/operating-system activity outside the extension is governed by the respective provider's policies.

For questions, use the publisher contact shown on TabBackup's Chrome Web Store listing. Policy changes must reflect shipped behavior and be disclosed before introducing new data uses.
