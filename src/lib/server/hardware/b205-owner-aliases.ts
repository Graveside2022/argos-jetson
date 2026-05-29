/**
 * Process-name → canonical-owner mapping for B205 owners.
 *
 * The B205 mutex can be claimed either by a tool calling `acquire()` with
 * its canonical name (e.g. `"gnu-radio-vnc"`, `"bluedragon"`,
 * `"wardragon-fpv-detect"`) or by the background `refreshB205` /
 * `scanOrphans` paths detecting a running native process (e.g.
 * `"gnuradio-companion"`, `"blue-dragon"`, `"fpv_energy_scan.py"`).
 *
 * Without this map the scan would overwrite a named acquire with the bare
 * process name, breaking the `acquireWithPreempt` handler lookup which
 * is keyed on the canonical owner.
 *
 * Lives in its own module to avoid circular imports between
 * `resource-manager.ts`, `device-plugins.ts`, and the per-tool services.
 * Mirrors `hackrf-owner-aliases.ts` (Docker container → canonical tool).
 *
 * **Not aliased on purpose:**
 *   - `gnss-sdr` — the OS binary and the canonical owner constant
 *     (`GNSS_SDR_OWNER = 'gnss-sdr'`) are already identical.
 *   - `uhd_find_devices`, `uhd_usrp_probe`, `uhd_fft`,
 *     `rx_samples_to_file` — UHD diagnostic utilities. Short-lived
 *     operator-run probes, not long-running tool services; no canonical
 *     owner exists for them. The scan tags them under their bare name
 *     intentionally so the operator can see a probe is running.
 */

const B205_PROCESS_ALIASES: Record<string, string> = {
	// gnu-radio-vnc spawns `gnuradio-companion` as the user-visible binary.
	'gnuradio-companion': 'gnu-radio-vnc',
	// dragonsync FPV is spawned as `wardragon-fpv-detect.service` (systemd
	// unit) which runs `python3 fpv_energy_scan.py`. Match the python script
	// name so the systemd-spawned process gets canonicalised correctly.
	'fpv_energy_scan.py': 'wardragon-fpv-detect',
	fpv_energy_scan: 'wardragon-fpv-detect',
	// bluedragon ships as the `blue-dragon` Rust binary; the canonical
	// owner constant is `bluedragon` (no dash, matches the service slug).
	'blue-dragon': 'bluedragon'
};

export function canonicalizeB205Owner(owner: string): string {
	return B205_PROCESS_ALIASES[owner] ?? owner;
}
