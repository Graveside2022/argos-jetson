<!-- @constitutional-exemption Article-IV-4.2 — overlay-close button uses custom micro icon, shadcn Button not appropriate for 12px close control -->
<script lang="ts">
	import { SelectItem } from 'carbon-components-svelte';
	import Close from 'carbon-icons-svelte/lib/Close.svelte';

	import Select from '$lib/components/chassis/forms/Select.svelte';
	import { isolateDevice } from '$lib/stores/dashboard/dashboard-store.svelte';
	import type { DeviceClassification } from '$lib/stores/tactical-map/kismet-store.svelte';
	import { setDeviceAffiliation } from '$lib/stores/tactical-map/kismet-store.svelte';

	import { formatFrequency, formatTimeAgo } from './map-helpers';

	interface Props {
		content: {
			ssid: string;
			mac: string;
			rssi: number;
			type: string;
			manufacturer: string;
			channel: number;
			frequency: number;
			packets: number;
			last_seen: number;
			clientCount: number;
			parentAP: string;
			affiliation: DeviceClassification;
		};
		onclose: () => void;
	}

	let { content, onclose }: Props = $props();
</script>

<div class="device-overlay">
	<button
		class="overlay-close"
		onclick={() => {
			onclose();
			isolateDevice(null);
		}}
	>
		<Close size={12} />
	</button>
	<div class="overlay-title">{content.ssid}</div>
	<div class="overlay-row">
		<span class="overlay-label">MAC</span>
		<span class="overlay-value">{content.mac}</span>
	</div>
	<div class="overlay-row">
		<span class="overlay-label">VENDOR</span>
		<span class="overlay-value">{content.manufacturer}</span>
	</div>
	<div class="overlay-row">
		<span class="overlay-label">TYPE</span>
		<span class="overlay-value">{content.type}</span>
	</div>
	<div class="overlay-row">
		<span class="overlay-label">AFFIL</span>
		<span class="overlay-value">
			<span class="affil-indicator affil-{content.affiliation}"></span>
			<Select
				hideLabel
				labelText="affiliation"
				value={content.affiliation}
				onChange={(v) => {
					if (v === undefined) return;
					const val = String(v) as DeviceClassification;
					setDeviceAffiliation(content.mac, val);
					content = { ...content, affiliation: val };
				}}
				size="sm"
			>
				<SelectItem value="unknown" text="Unknown" />
				<SelectItem value="friendly" text="Friendly" />
				<SelectItem value="hostile" text="Hostile" />
			</Select>
		</span>
	</div>
	<div class="overlay-divider"></div>
	<div class="overlay-row">
		<span class="overlay-label">RSSI</span>
		<span class="overlay-value">{content.rssi !== 0 ? `${content.rssi} dBm` : '—'}</span>
	</div>
	<div class="overlay-row">
		<span class="overlay-label">CH</span>
		<span class="overlay-value">{content.channel || '—'}</span>
	</div>
	<div class="overlay-row">
		<span class="overlay-label">FREQ</span>
		<span class="overlay-value">{formatFrequency(content.frequency)}</span>
	</div>
	<div class="overlay-divider"></div>
	<div class="overlay-row">
		<span class="overlay-label">PKTS</span>
		<span class="overlay-value">{content.packets.toLocaleString()}</span>
	</div>
	<div class="overlay-row">
		<span class="overlay-label">LAST</span>
		<span class="overlay-value">{formatTimeAgo(content.last_seen)}</span>
	</div>
	{#if content.clientCount > 0}
		<div class="overlay-divider"></div>
		<div class="overlay-row">
			<span class="overlay-label">CLIENTS</span>
			<span class="overlay-value overlay-accent">{content.clientCount}</span>
		</div>
	{/if}
	{#if content.parentAP}
		<div class="overlay-divider"></div>
		<div class="overlay-row">
			<span class="overlay-label">PARENT</span>
			<span class="overlay-value overlay-mono">{content.parentAP}</span>
		</div>
	{/if}
</div>

<style>
	.device-overlay {
		position: absolute;
		top: 10px;
		right: 10px;
		z-index: 10;
		background: var(--cds-layer);
		border: 1px solid var(--cds-border-subtle);
		border-radius: 8px;
		padding: 10px 12px;
		min-width: 180px;
		max-width: 220px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		pointer-events: auto;
	}

	.overlay-close {
		position: absolute;
		top: 6px;
		right: 6px;
		background: none;
		border: none;
		color: var(--cds-text-helper);
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
	}

	.overlay-close:hover {
		color: var(--cds-text-primary);
	}

	.overlay-title {
		font-weight: 600;
		font-size: 0.8125rem;
		margin-bottom: 6px;
		padding-right: 16px;
		color: var(--cds-text-primary);
	}

	.overlay-row {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		padding: 1.5px 0;
	}

	.overlay-label {
		color: var(--cds-text-helper);
		letter-spacing: 0.05em;
	}

	.overlay-value {
		color: var(--cds-text-secondary);
		font-family: var(--cds-code-01-font-family);
		font-size: 0.625rem;
	}

	.overlay-accent {
		color: var(--cds-link-primary);
	}

	.overlay-mono {
		font-size: 0.5625rem;
		word-break: break-all;
	}

	.overlay-divider {
		border-top: 1px solid var(--cds-border-subtle);
		margin: 3px 0;
	}

	/* Affiliation dropdown */
	.affil-select {
		background: var(--cds-layer);
		color: var(--cds-text-secondary);
		border: 1px solid var(--cds-border-subtle);
		border-radius: 3px;
		font-family: var(--cds-code-01-font-family);
		font-size: 0.625rem;
		padding: 1px 4px;
		cursor: pointer;
		outline: none;
		-webkit-appearance: none;
		appearance: none;
		padding-right: 14px;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 3px center;
	}

	.affil-select:hover {
		border-color: var(--cds-link-primary);
	}

	.affil-select:focus {
		border-color: var(--cds-link-primary);
		box-shadow: 0 0 0 1px var(--cds-link-primary);
	}

	.affil-indicator {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		margin-right: 4px;
		vertical-align: middle;
	}

	.affil-unknown {
		background: var(--cds-support-warning);
	}

	.affil-friendly {
		background: var(--cds-support-info);
	}

	.affil-hostile {
		background: var(--cds-support-error);
	}
</style>
