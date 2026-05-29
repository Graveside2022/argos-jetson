<script lang="ts">
	import Checkmark from 'carbon-icons-svelte/lib/Checkmark.svelte';
	import Close from 'carbon-icons-svelte/lib/Close.svelte';
	import Upload from 'carbon-icons-svelte/lib/Upload.svelte';

	import PasswordInput from '$lib/components/chassis/forms/PasswordInput.svelte';
	import type { TakServerConfig } from '$lib/types/tak';

	interface Props {
		config: TakServerConfig;
		onUploaded: (data: { truststorePath: string; caPath?: string; id?: string }) => void;
		onTruststoreCleared?: () => void;
	}

	let { config, onUploaded, onTruststoreCleared }: Props = $props();

	let truststoreFile: FileList | undefined = $state();
	let truststoreStatus = $state('');

	/** Handle the truststore upload API response. */
	function handleTruststoreResponse(data: Record<string, unknown>): void {
		if (!data.success) {
			truststoreStatus = (data.error as string) ?? 'Invalid truststore file';
			return;
		}
		const paths = data.paths as { truststorePath: string; caPath?: string };
		onUploaded({
			truststorePath: paths.truststorePath,
			caPath: paths.caPath,
			id: data.id as string | undefined
		});
		truststoreStatus = 'Truststore validated';
	}

	// fallow-ignore-next-line complexity
	async function uploadTruststore() {
		if (!truststoreFile || truststoreFile.length === 0) {
			truststoreStatus = 'Select a .p12 file';
			return;
		}
		const formData = new FormData();
		formData.append('p12File', truststoreFile[0]);
		formData.append('password', config.truststorePass);
		if (config.id) formData.append('id', config.id);

		truststoreStatus = 'Validating...';
		try {
			const res = await fetch('/api/tak/truststore', { method: 'POST', body: formData });
			handleTruststoreResponse(await res.json());
		} catch {
			truststoreStatus = 'Upload error';
		}
	}
</script>

<div class="trust-section">
	<span class="trust-label">TRUST STORE</span>
	<p class="trust-help">
		Upload the <strong class="trust-help-strong">root CA truststore</strong> (.p12) — e.g.
		<code class="trust-help-code">truststore-root.p12</code>
	</p>

	<!-- File picker -->
	<label class="trust-field">
		Truststore File (.p12)
		<label class="trust-dropzone">
			<Upload size={16} class="trust-icon" />
			<span class="trust-filename">
				{truststoreFile && truststoreFile.length > 0
					? truststoreFile[0].name
					: 'Choose .p12 file...'}
			</span>
			<input type="file" accept=".p12" bind:files={truststoreFile} class="sr-only" />
		</label>
	</label>

	<!-- Password -->
	<PasswordInput
		labelText="Truststore Password"
		placeholder="atakatak"
		bind:value={config.truststorePass}
		size="sm"
	/>

	<!-- Upload button -->
	<div class="trust-actions">
		<button class="trust-upload-btn" onclick={uploadTruststore}>
			<Upload size={14} />
			Upload Truststore
		</button>
		{#if truststoreStatus}
			<span class="trust-status">{truststoreStatus}</span>
		{/if}
	</div>

	<!-- Status indicator -->
	{#if config.truststorePath}
		<div class="trust-loaded">
			<div class="trust-loaded-info">
				<Checkmark size={14} class="trust-check" />
				<span class="trust-loaded-text">Truststore loaded</span>
			</div>
			<button class="trust-clear-btn" onclick={() => onTruststoreCleared?.()}>
				<Close size={12} />
				Clear
			</button>
		</div>
	{/if}
</div>

<style>
	.trust-section {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.trust-label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: var(--cds-text-helper);
	}

	.trust-help {
		font-size: 0.625rem;
		line-height: 1.625;
		color: color-mix(in srgb, var(--cds-text-helper) 70%, transparent);
	}

	.trust-help-strong {
		color: var(--cds-text-helper);
	}

	.trust-help-code {
		border-radius: 0.25rem;
		padding: 0 0.25rem;
		background: color-mix(in srgb, var(--cds-layer) 50%, transparent);
		color: color-mix(in srgb, var(--cds-text-primary) 80%, transparent);
		font-family: var(--cds-code-01-font-family);
	}

	.trust-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--cds-text-helper);
	}

	.trust-dropzone {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px dashed color-mix(in srgb, var(--cds-border-subtle) 60%, transparent);
		border-radius: 0.375rem;
		background: color-mix(in srgb, var(--cds-layer) 10%, transparent);
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			background-color 0.15s ease;
	}

	.trust-dropzone:hover {
		border-color: color-mix(in srgb, var(--cds-link-primary) 50%, transparent);
		background: color-mix(in srgb, var(--cds-layer) 20%, transparent);
	}

	.trust-dropzone :global(.trust-icon) {
		flex-shrink: 0;
		color: color-mix(in srgb, var(--cds-text-helper) 60%, transparent);
	}

	.trust-dropzone:hover :global(.trust-icon) {
		color: var(--cds-link-primary);
	}

	.trust-filename {
		font-size: 0.6875rem;
		color: var(--cds-text-helper);
	}

	.trust-dropzone:hover .trust-filename {
		color: var(--cds-text-primary);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.trust-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.trust-upload-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		border: 1px solid color-mix(in srgb, var(--cds-link-primary) 50%, transparent);
		border-radius: 0.375rem;
		background: color-mix(in srgb, var(--cds-link-primary) 15%, transparent);
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--cds-text-primary);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.trust-upload-btn:hover {
		background: color-mix(in srgb, var(--cds-link-primary) 30%, transparent);
	}

	.trust-status {
		font-size: 0.625rem;
		color: var(--cds-text-helper);
	}

	.trust-loaded {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.375rem 0.625rem;
		border: 1px solid color-mix(in srgb, var(--cds-support-success) 30%, transparent);
		border-radius: 0.375rem;
		background: color-mix(in srgb, var(--cds-support-success) 10%, transparent);
	}

	.trust-loaded-info {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.trust-loaded :global(.trust-check) {
		color: var(--cds-support-success);
	}

	.trust-loaded-text {
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--cds-support-success);
	}

	.trust-clear-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		border: 1px solid color-mix(in srgb, var(--cds-support-error) 40%, transparent);
		border-radius: 0.25rem;
		background: color-mix(in srgb, var(--cds-support-error) 10%, transparent);
		padding: 0.125rem 0.5rem;
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--cds-support-error);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.trust-clear-btn:hover {
		background: color-mix(in srgb, var(--cds-support-error) 25%, transparent);
	}
</style>
