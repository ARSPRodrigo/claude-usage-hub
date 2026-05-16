# vendor/

This directory holds third-party binaries used by the collector at install time.

## nssm.exe — Non-Sucking Service Manager

NSSM wraps the collector as a proper Windows Service so it starts on boot and
restarts automatically after crashes.

### How to obtain

1. Download **NSSM 2.24 (win64)** from https://nssm.cc/download
   - File: `nssm-2.24.zip`
   - Extract: `nssm-2.24/win64/nssm.exe`

2. Place the extracted binary here:
   ```
   packages/collector/vendor/nssm.exe
   ```

3. Compute its SHA-256 and record it:
   ```sh
   # macOS / Linux
   shasum -a 256 packages/collector/vendor/nssm.exe | tee vendor/nssm-sha256.txt

   # Windows PowerShell
   (Get-FileHash packages/collector/vendor/nssm.exe -Algorithm SHA256).Hash.ToLower() | Out-File vendor/nssm-sha256.txt
   ```

4. Update the `NSSM_SHA256` constant at the top of
   `packages/collector/src/daemon.ts` to match.

### License

NSSM is in the public domain. No attribution required.

### Version pinned

| Version | Build date    | Binary             |
|---------|---------------|--------------------|
| 2.24    | 2014-08-31    | win64/nssm.exe     |
