import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { WeatherReport } from '$lib/types/weather';

// spec-024 PR1 T012 — METAR cache (in-memory + disk fallback for offline ops).
// 15-min TTL on memory hits; disk cache survives process restarts and is
// served when the upstream fetch fails. Keys are uppercased ICAO codes.

const TTL_MS = 15 * 60 * 1000;
const DISK_DIR = path.join(process.cwd(), 'data', 'tmp', 'metar');
const KEY_RE = /^[A-Z0-9]{4}$/;

interface CacheRow {
	data: WeatherReport;
	expiresAt: number;
}

const memory = new Map<string, CacheRow>();

function safeKey(icao: string): string | null {
	const k = icao.trim().toUpperCase();
	return KEY_RE.test(k) ? k : null;
}

function diskPath(key: string): string {
	return path.join(DISK_DIR, `${key}.json`);
}

export function getFresh(icao: string): WeatherReport | null {
	const key = safeKey(icao);
	if (!key) return null;
	const row = memory.get(key);
	if (!row || row.expiresAt < Date.now()) return null;
	return row.data;
}

export async function getStale(icao: string): Promise<WeatherReport | null> {
	const key = safeKey(icao);
	if (!key) return null;
	const row = memory.get(key);
	if (row) return row.data;
	try {
		const buf = await fs.readFile(diskPath(key), 'utf8');
		return JSON.parse(buf) as WeatherReport;
	} catch {
		return null;
	}
}

export async function set(icao: string, data: WeatherReport): Promise<void> {
	const key = safeKey(icao);
	if (!key) return;
	memory.set(key, { data, expiresAt: Date.now() + TTL_MS });
	await fs.mkdir(DISK_DIR, { recursive: true });
	await fs.writeFile(diskPath(key), JSON.stringify(data));
}

export const __test = { TTL_MS, safeKey };
