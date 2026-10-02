# Free and planned Pro

Free 1.0 includes automatic/manual backups, up to 20 distinct snapshots, full restore, local file import/export, and a basic library text filter. The prompt lists search as both Pro and full-page MVP UI; this version includes the simple filter in Free. Advanced indexed search can be a future Pro feature.

Planned Pro: larger/configurable history, favorites, named snapshots, advanced search/selective restore, custom retention and migration tools. External backup/cloud is a separate future privacy and security decision, not an implied capability. None of these paid features is advertised as available or implemented in this release. No payments, account or licensing server.

EntitlementProvider exposes capabilities and storage/count limits. LocalEntitlementProvider always returns Free; tests can inject a provider. UI and repository have no distributed isPro flags. A local flag or provider can be changed by the device owner and is not secure DRM.

Future alternatives: manually provisioned signed offline licenses verified with a bundled public key (no runtime backend, but issuance/revocation/renewal infrastructure is a separate concern); a license vendor (external service and disclosure required); an owned account/license API (backend required); cloud sync or subscription billing (backend/vendor, explicit consent, retention and data-use review required). Do not ship a secret signing key or payment credential in an extension.
