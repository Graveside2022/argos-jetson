/**
 * RTKLIB launcher helpers — pre-seed `rtknavi_qt` + `rtkplot_qt` config so
 * the operator does NOT have to click through wizards.
 *
 * `rtknavi_qt` reads RTCM3 from `tcpcli://127.0.0.1:2101` (gnss-sdr's PVT
 * block exposes it via `PVT.flag_rtcm_server=true` + `PVT.rtcm_tcp_port`).
 * `rtkplot_qt` reads NMEA from the named pipe at
 * `/tmp/argos-gnss-sdr.nmea` (also written by gnss-sdr's PVT block).
 *
 * The .ini files are written under {@link GNSS_SDR_CONF_DIR}; rtknavi_qt
 * and rtkplot_qt accept `--ini <path>` for first-launch state. We do not
 * pass that flag here — instead the .ini files live at the well-known
 * locations the GUIs check by default (`~/.config/rtknavi_qt.ini` and
 * `~/.config/rtkplot_qt.ini`). This keeps spawn argv stable and the
 * config readable on disk.
 *
 * IMPORTANT: this module currently only WRITES the templates. The actual
 * launch is in {@link ./gnss-sdr-vnc-processes.ts} via `spawnRtknavi()` and
 * `spawnRtkplot()`. Reason: the spawn helpers already centralise child-
 * process bookkeeping (refs, exit handlers, error tracking) so duplicating
 * launch logic here would be drift.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join as joinPath } from 'path';

import { GNSS_SDR_CONF_DIR, GNSS_SDR_RTCM_PORT } from './gnss-sdr-vnc-types';

/** Where the running rtknavi_qt/rtkplot_qt look for their default .ini. */
function defaultIniPath(name: string): string {
	return joinPath(homedir(), '.config', name);
}

/** Template path under our managed dir, kept on disk for auditability. */
function templatePath(name: string): string {
	return joinPath(GNSS_SDR_CONF_DIR, name);
}

/**
 * Write the rtknavi_qt .ini that points its primary input stream at the
 * gnss-sdr RTCM TCP server. Idempotent.
 *
 * The .ini is also copied into `~/.config/` so rtknavi_qt picks it up on
 * next launch without command-line flags. gnss-sdr-monitor (which replaced
 * rtkplot_qt in the stack) listens on UDP 1234 by default and needs no
 * pre-seeded config.
 */
export function writeRtklibTemplates(): { rtknaviPath: string } {
	mkdirSync(GNSS_SDR_CONF_DIR, { recursive: true });
	mkdirSync(joinPath(homedir(), '.config'), { recursive: true });

	const rtknaviIni = buildRtknaviIni();
	const rtknaviTemplate = templatePath('rtknavi_qt.ini');
	const rtknaviRuntime = defaultIniPath('rtknavi_qt.ini');

	writeFileSync(rtknaviTemplate, rtknaviIni, { mode: 0o644 });
	writeFileSync(rtknaviRuntime, rtknaviIni, { mode: 0o644 });

	return { rtknaviPath: rtknaviRuntime };
}

/**
 * rtknavi_qt input stream config — `inpstr1` is the rover, set to
 * `tcpcli` reading RTCM3 from localhost:2101. `inpstr2`/`inpstr3` left
 * empty (no base / correction stream).
 */
function buildRtknaviIni(): string {
	return [
		'; Argos-generated rtknavi_qt.ini — points input stream 1 at gnss-sdr RTCM3 server.',
		'[setting1]',
		'positioning_mode=0',
		'frequencies=1',
		'elevation_mask=15',
		'snr_mask_rover_on=0',
		'rec_dynamics=0',
		'earth_tide=0',
		'iono_option=1',
		'tropo_option=1',
		'sat_ephemeris=0',
		'',
		'[setting2]',
		'amb_resolution=1',
		'gloamb_resolution=0',
		'bdsamb_resolution=0',
		'val_threshold=3.0',
		'',
		'[input]',
		'inpstr1_type=4',
		'inpstr1_path=127.0.0.1:' + GNSS_SDR_RTCM_PORT,
		'inpstr1_format=4',
		'inpstr2_type=0',
		'inpstr3_type=0',
		'',
		'[output]',
		'outstr1_type=0',
		'outstr2_type=0',
		'',
		'[log]',
		'logstr1_type=0',
		'logstr2_type=0',
		'logstr3_type=0',
		''
	].join('\n');
}
