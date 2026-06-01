<script lang="ts">
	import Archive from 'carbon-icons-svelte/lib/Archive.svelte';
	import Download from 'carbon-icons-svelte/lib/Download.svelte';

	interface Props {
		configId?: string;
		onImported: (data: {
			hostname?: string;
			port?: number;
			description?: string;
			truststorePath?: string;
			id?: string;
			warning?: string;
		}) => void;
	}

	let { configId, onImported }: Props = $props();

	let packageFile: FileList | undefined = $state();
	let packageStatus = $state('');

	/** Handle the package import API response. */
	function handlePackageResponse(data: Record<string, unknown>): void {
		if (!data.success) {
			packageStatus = (data.error as string) ?? 'Import failed';
			return;
		}
		const cfg = data.config as Record<string, unknown>;
		onImported({
			hostname: cfg.hostname as string | undefined,
			port: cfg.port as number | undefined,
			description: cfg.description as string | undefined,
			truststorePath: cfg.truststorePath as string | undefined,
			id: data.id as string | undefined,
			warning: data.warning as string | undefined
		});
		packageStatus = (data.warning as string) ?? 'Package imported';
	}

	// fallow-ignore-next-line complexity
	async function importDataPackage() {
		if (!packageFile || packageFile.length === 0) {
			packageStatus = 'Select a .zip file';
			return;
		}
		const formData = new FormData();
		formData.append('packageFile', packageFile[0]);
		if (configId) formData.append('id', configId);

		packageStatus = 'Importing...';
		try {
			const res = await fetch('/api/tak/import-package', { method: 'POST', body: formData });
			handlePackageResponse(await res.json());
		} catch {
			packageStatus = 'Import error';
		}
	}

	const statusKind = $derived(
		packageStatus.includes('error') ||
			packageStatus.includes('failed') ||
			packageStatus.includes('Failed')
			? 'error'
			: packageStatus.includes('enroll') || packageStatus.includes('certificate')
				? 'warn'
				: 'muted'
	);
</script>

<div class="pkg-section">
	<span class="pkg-label">DATA PACKAGE</span>

	<!-- File picker -->
	<label class="pkg-field">
		TAK Data Package (.zip)
		<label class="pkg-dropzone">
			<Archive size={16} class="pkg-icon" />
			<span class="pkg-filename">
				{packageFile && packageFile.length > 0
					? packageFile[0].name
					: 'Choose .zip file...'}
			</span>
			<input type="file" accept=".zip" bind:files={packageFile} class="sr-only" />
		</label>
	</label>

	<!-- Import button -->
	<div class="pkg-actions">
		<button class="pkg-import-btn" onclick={importDataPackage}>
			<Download size={14} />
			Import Package
		</button>
		{#if packageStatus}
			<span
				class="pkg-status"
				class:status-error={statusKind === 'error'}
				class:status-warn={statusKind === 'warn'}
			>
				{packageStatus}
			</span>
		{/if}
	</div>
</div>

<style>
	.pkg-section {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.pkg-label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: var(--cds-text-helper);
	}

	.pkg-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--cds-text-helper);
	}

	.pkg-dropzone {
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

	.pkg-dropzone:hover {
		border-color: color-mix(in srgb, var(--cds-link-primary) 50%, transparent);
		background: color-mix(in srgb, var(--cds-layer) 20%, transparent);
	}

	.pkg-dropzone :global(.pkg-icon) {
		flex-shrink: 0;
		color: color-mix(in srgb, var(--cds-text-helper) 60%, transparent);
	}

	.pkg-dropzone:hover :global(.pkg-icon) {
		color: var(--cds-link-primary);
	}

	.pkg-filename {
		font-size: 0.6875rem;
		color: var(--cds-text-helper);
	}

	.pkg-dropzone:hover .pkg-filename {
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

	.pkg-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pkg-import-btn {
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

	.pkg-import-btn:hover {
		background: color-mix(in srgb, var(--cds-link-primary) 30%, transparent);
	}

	.pkg-status {
		font-size: 0.625rem;
		color: var(--cds-text-helper);
	}

	.pkg-status.status-error {
		color: var(--cds-support-error);
	}

	.pkg-status.status-warn {
		color: var(--cds-support-warning);
	}
</style>
