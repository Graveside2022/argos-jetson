<script lang="ts">
	import CheckmarkOutline from 'carbon-icons-svelte/lib/CheckmarkOutline.svelte';

	import NumberInput from '$lib/components/chassis/forms/NumberInput.svelte';
	import PasswordInput from '$lib/components/chassis/forms/PasswordInput.svelte';
	import TextInput from '$lib/components/chassis/forms/TextInput.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import type { TakServerConfig } from '$lib/types/tak';

	interface Props {
		config: TakServerConfig;
		onEnrolled: (data: {
			id: string;
			paths: { certPath: string; keyPath: string; caPath?: string };
		}) => void;
	}

	let { config, onEnrolled }: Props = $props();

	let enrollStatus = $state('');
	let isEnrolling = $state(false);

	/** Validate that required enrollment fields are present. */
	function hasEnrollmentFields(): boolean {
		return !!(config.hostname && config.enrollmentUser && config.enrollmentPass);
	}

	/** Handle the enrollment API response. */
	function handleEnrollResponse(data: Record<string, unknown>): void {
		if (data.success) {
			onEnrolled({
				id: data.id as string,
				paths: data.paths as { certPath: string; keyPath: string; caPath?: string }
			});
			enrollStatus = 'Enrollment successful';
			toast.success('TAK certificate enrolled');
		} else {
			enrollStatus = (data.error as string) ?? 'Enrollment failed';
			toast.error(`Enrollment failed: ${enrollStatus}`);
		}
	}

	async function enrollCertificate() {
		if (!hasEnrollmentFields()) {
			enrollStatus = 'Fill hostname, username, and password';
			return;
		}
		isEnrolling = true;
		enrollStatus = 'Enrolling...';
		try {
			const res = await fetch('/api/tak/enroll', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					hostname: config.hostname,
					port: config.enrollmentPort,
					username: config.enrollmentUser,
					password: config.enrollmentPass,
					id: config.id || crypto.randomUUID()
				})
			});
			handleEnrollResponse(await res.json());
		} catch {
			enrollStatus = 'Enrollment error';
			toast.error('Enrollment failed: server communication error');
		} finally {
			isEnrolling = false;
		}
	}
</script>

<div class="enroll-section">
	<span class="enroll-label">ENROLLMENT</span>
	<TextInput
		labelText="Username"
		placeholder="tak-user"
		value={config.enrollmentUser ?? ''}
		onInput={(v) => (config.enrollmentUser = v)}
		size="sm"
	/>
	<PasswordInput
		labelText="Password"
		placeholder="Enrollment password"
		value={config.enrollmentPass ?? ''}
		onInput={(v) => (config.enrollmentPass = v)}
		size="sm"
	/>
	<NumberInput
		labelText="Enrollment Port"
		bind:value={config.enrollmentPort}
		placeholder="8446"
		min={1}
		max={65535}
		step={1}
		size="sm"
		hideSteppers
		disableWheel
	/>
	<div class="enroll-actions">
		<button class="enroll-btn" onclick={enrollCertificate} disabled={isEnrolling}>
			<CheckmarkOutline size={14} />
			{isEnrolling ? 'Enrolling...' : 'Enroll Now'}
		</button>
		{#if enrollStatus}
			<span class="enroll-status">{enrollStatus}</span>
		{/if}
	</div>
</div>

<style>
	.enroll-section {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.enroll-label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: var(--cds-text-helper);
	}

	.enroll-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.enroll-btn {
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

	.enroll-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--cds-link-primary) 30%, transparent);
	}

	.enroll-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.enroll-status {
		font-size: 0.625rem;
		color: var(--cds-text-helper);
	}
</style>
