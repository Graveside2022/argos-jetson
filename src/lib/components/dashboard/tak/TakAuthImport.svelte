<script lang="ts">
	import Checkmark from 'carbon-icons-svelte/lib/Checkmark.svelte';
	import Close from 'carbon-icons-svelte/lib/Close.svelte';
	import Upload from 'carbon-icons-svelte/lib/Upload.svelte';

	import PasswordInput from '$lib/components/chassis/forms/PasswordInput.svelte';
	import type { TakServerConfig } from '$lib/types/tak';

	interface Props {
		config: TakServerConfig;
		onCertUploaded: (data: {
			id: string;
			paths: { certPath: string; keyPath: string; caPath?: string };
		}) => void;
		onCertCleared?: () => void;
	}

	let { config, onCertUploaded, onCertCleared }: Props = $props();

	let p12File: FileList | undefined = $state();
	let p12Password = $state('');
	let uploadStatus = $state('');

	/** Handle the cert upload API response. */
	function handleCertResponse(data: Record<string, unknown>): void {
		if (data.success) {
			onCertUploaded({
				id: data.id as string,
				paths: data.paths as { certPath: string; keyPath: string; caPath?: string }
			});
			uploadStatus = 'Certificate uploaded';
		} else {
			uploadStatus = 'Failed: ' + ((data.error as string) ?? 'Unknown error');
		}
	}

	/** Build FormData for cert upload, returning null if inputs are missing. */
	// fallow-ignore-next-line complexity
	function buildCertFormData(): FormData | null {
		if (!p12File || p12File.length === 0 || !p12Password) return null;
		const formData = new FormData();
		formData.append('p12File', p12File[0]);
		formData.append('password', p12Password);
		if (config.id) formData.append('id', config.id);
		return formData;
	}

	async function uploadCert() {
		const formData = buildCertFormData();
		if (!formData) {
			uploadStatus = 'Select file and enter password';
			return;
		}
		uploadStatus = 'Uploading...';
		try {
			const res = await fetch('/api/tak/certs', { method: 'POST', body: formData });
			handleCertResponse(await res.json());
		} catch {
			uploadStatus = 'Upload error';
		}
	}
</script>

<div class="cert-section">
	<span class="cert-label">CLIENT CERTIFICATE</span>
	<p class="cert-help">
		Upload your <strong class="cert-help-strong">client identity certificate</strong>
		(.p12) — e.g.
		<code class="cert-help-code">truststore-intermediate.p12</code>
	</p>

	<!-- File picker -->
	<label class="cert-field">
		Certificate File (.p12)
		<label class="cert-dropzone">
			<Upload size={16} class="cert-icon" />
			<span class="cert-filename">
				{p12File && p12File.length > 0 ? p12File[0].name : 'Choose .p12 file...'}
			</span>
			<input type="file" accept=".p12" bind:files={p12File} class="sr-only" />
		</label>
	</label>

	<!-- Password -->
	<PasswordInput
		labelText="Certificate Password"
		placeholder="atakatak"
		bind:value={p12Password}
		size="sm"
	/>

	<!-- Upload button -->
	<div class="cert-actions">
		<button class="cert-upload-btn" onclick={uploadCert}>
			<Upload size={14} />
			Upload Certificate
		</button>
		{#if uploadStatus}
			<span class="cert-status">{uploadStatus}</span>
		{/if}
	</div>

	<!-- Status indicator -->
	{#if config.certPath}
		<div class="cert-loaded">
			<div class="cert-loaded-info">
				<Checkmark size={14} class="cert-check" />
				<span class="cert-loaded-text">Certificates loaded</span>
			</div>
			<button class="cert-clear-btn" onclick={() => onCertCleared?.()}>
				<Close size={12} />
				Clear
			</button>
		</div>
	{/if}
</div>

<style>
	.cert-section {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.cert-label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: var(--cds-text-helper);
	}

	.cert-help {
		font-size: 0.625rem;
		line-height: 1.625;
		color: color-mix(in srgb, var(--cds-text-helper) 70%, transparent);
	}

	.cert-help-strong {
		color: var(--cds-text-helper);
	}

	.cert-help-code {
		border-radius: 0.25rem;
		padding: 0 0.25rem;
		background: color-mix(in srgb, var(--cds-layer) 50%, transparent);
		color: color-mix(in srgb, var(--cds-text-primary) 80%, transparent);
		font-family: var(--cds-code-01-font-family);
	}

	.cert-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--cds-text-helper);
	}

	.cert-dropzone {
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

	.cert-dropzone:hover {
		border-color: color-mix(in srgb, var(--cds-link-primary) 50%, transparent);
		background: color-mix(in srgb, var(--cds-layer) 20%, transparent);
	}

	.cert-dropzone :global(.cert-icon) {
		flex-shrink: 0;
		color: color-mix(in srgb, var(--cds-text-helper) 60%, transparent);
	}

	.cert-dropzone:hover :global(.cert-icon) {
		color: var(--cds-link-primary);
	}

	.cert-filename {
		font-size: 0.6875rem;
		color: var(--cds-text-helper);
	}

	.cert-dropzone:hover .cert-filename {
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

	.cert-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.cert-upload-btn {
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

	.cert-upload-btn:hover {
		background: color-mix(in srgb, var(--cds-link-primary) 30%, transparent);
	}

	.cert-status {
		font-size: 0.625rem;
		color: var(--cds-text-helper);
	}

	.cert-loaded {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.375rem 0.625rem;
		border: 1px solid color-mix(in srgb, var(--cds-support-success) 30%, transparent);
		border-radius: 0.375rem;
		background: color-mix(in srgb, var(--cds-support-success) 10%, transparent);
	}

	.cert-loaded-info {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.cert-loaded :global(.cert-check) {
		color: var(--cds-support-success);
	}

	.cert-loaded-text {
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--cds-support-success);
	}

	.cert-clear-btn {
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

	.cert-clear-btn:hover {
		background: color-mix(in srgb, var(--cds-support-error) 25%, transparent);
	}
</style>
