<script lang="ts">
	import PasswordInput from '$lib/components/chassis/forms/PasswordInput.svelte';
	import TextInput from '$lib/components/chassis/forms/TextInput.svelte';
	import type { GlobalProtectConfig } from '$lib/types/globalprotect';

	interface Props {
		config: GlobalProtectConfig;
		onchange: (config: GlobalProtectConfig) => void;
		password: string;
		onpassword: (password: string) => void;
	}

	let { config, onchange, password, onpassword }: Props = $props();

	function update(field: keyof GlobalProtectConfig, value: string | boolean) {
		onchange({ ...config, [field]: value });
	}
</script>

<div class="gp-section">
	<span class="gp-label">SERVER CONFIGURATION</span>

	<div class="gp-fields">
		<TextInput
			labelText="Portal Address"
			placeholder="vpn.example.mil"
			value={config.portal}
			autocomplete="off"
			onInput={(value: string) => update('portal', value)}
		/>

		<TextInput
			labelText="Username"
			placeholder="operator1"
			value={config.username}
			autocomplete="username"
			onInput={(value: string) => update('username', value)}
		/>

		<PasswordInput
			labelText="Password"
			placeholder="Enter password"
			value={password}
			autocomplete="current-password"
			onInput={(value: string) => onpassword(value)}
		/>
	</div>
</div>

<style>
	.gp-section {
		padding: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--cds-border-subtle) 60%, transparent);
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--cds-layer) 40%, transparent);
	}

	.gp-label {
		display: block;
		margin-bottom: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: var(--cds-text-helper);
	}

	.gp-fields {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
