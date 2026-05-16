# vendor/

This directory holds third-party binaries used by the collector at install time.

## nssm.exe — Non-Sucking Service Manager

NSSM wraps the collector as a proper Windows Service so it starts on boot and
restarts automatically after crashes.

### Currently bundled

| Version              | Build date | Binary         | SHA-256 (first 16) |
|----------------------|------------|----------------|--------------------|
| 2.24-101-g897c7ad    | 2017-04-26 | win64/nssm.exe | `eee9c44c29c2be01` |

The expected SHA-256 is stored in [nssm-sha256.txt](./nssm-sha256.txt) and
also pinned as `NSSM_SHA256` in [../src/daemon.ts](../src/daemon.ts).

### How to update

1. Download a new build from https://nssm.cc/ (the `ci/` directory has
   post-2.24 patched builds; `release/` has the 2014 stable).
2. Extract `win64/nssm.exe` and replace `packages/collector/vendor/nssm.exe`.
3. Recompute the SHA-256:
   ```sh
   shasum -a 256 packages/collector/vendor/nssm.exe
   ```
4. Update both `NSSM_SHA256` in `src/daemon.ts` and the hash in
   `vendor/nssm-sha256.txt`.

### License

NSSM is in the public domain. No attribution required.
