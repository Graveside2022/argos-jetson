<script lang="ts">
	import { Button, TextInput } from 'carbon-components-svelte';
	import Close from 'carbon-icons-svelte/lib/Close.svelte';

	interface Props {
		whitelistedMACs: string[];
		onAdd: (mac: string) => void;
		onRemove: (mac: string) => void;
	}

	let { whitelistedMACs, onAdd, onRemove }: Props = $props();

	let whitelistInput = $state('');

	function addToWhitelist() {
		const mac = whitelistInput.trim().toUpperCase();
		if (mac && !whitelistedMACs.includes(mac)) {
			onAdd(mac);
			whitelistInput = '';
		}
	}
</script>

<section class="whitelist-section">
	<div class="section-label">WHITELIST ({whitelistedMACs.length})</div>

	<div class="whitelist-input-row">
		<div class="input-wrap">
			<TextInput
				size="sm"
				labelText="MAC address"
				hideLabel
				placeholder="MAC address..."
				bind:value={whitelistInput}
				on:keydown={(e) => e.key === 'Enter' && addToWhitelist()}
			/>
		</div>
		<Button kind="secondary" size="small" on:click={addToWhitelist}>Add</Button>
	</div>

	{#if whitelistedMACs.length > 0}
		<div class="whitelist-items">
			{#each whitelistedMACs as mac (mac)}
				<div class="whitelist-item">
					<span class="whitelist-mac">{mac}</span>
					<Button
						kind="ghost"
						size="small"
						icon={Close}
						iconDescription="Remove {mac}"
						on:click={() => onRemove(mac)}
					/>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.whitelist-section {
		padding: var(--cds-spacing-04);
		border-top: 1px solid var(--cds-border-subtle);
		display: flex;
		flex-direction: column;
		gap: var(--cds-spacing-03);
		flex-shrink: 0;
	}

	.section-label {
		font-size: var(--cds-label-01-font-size);
		font-weight: 600;
		letter-spacing: 0.1em;
		color: var(--cds-text-secondary);
	}

	.whitelist-input-row {
		display: flex;
		gap: var(--cds-spacing-03);
		align-items: center;
	}

	.input-wrap {
		flex: 1;
	}

	.whitelist-items {
		display: flex;
		flex-direction: column;
		gap: var(--cds-spacing-02);
	}

	.whitelist-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--cds-spacing-02) var(--cds-spacing-03);
		background: var(--cds-layer);
	}

	.whitelist-mac {
		font-family: var(--cds-code-01-font-family);
		font-size: var(--cds-label-01-font-size);
		color: var(--cds-text-primary);
	}
</style>
