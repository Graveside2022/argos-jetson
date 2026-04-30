<script lang="ts">
	import { ToastNotification as CarbonToastNotification } from 'carbon-components-svelte';

	type Kind = 'error' | 'info' | 'info-square' | 'success' | 'warning' | 'warning-alt';

	interface Props {
		open?: boolean;
		kind?: Kind;
		title?: string;
		subtitle?: string;
		caption?: string;
		lowContrast?: boolean;
		timeout?: number;
		role?: string;
		hideCloseButton?: boolean;
		fullWidth?: boolean;
		statusIconDescription?: string;
		closeButtonDescription?: string;
		class?: string;
		onClose?: (fromTimeout: boolean) => void;
	}

	let {
		open = $bindable(true),
		kind = 'error',
		title = '',
		subtitle = '',
		caption = '',
		lowContrast = false,
		timeout = 0,
		role,
		hideCloseButton = false,
		fullWidth = false,
		statusIconDescription,
		closeButtonDescription = 'Close notification',
		class: className,
		onClose
	}: Props = $props();

	const resolvedRole = $derived(
		role ??
			(kind === 'error' || kind === 'warning' || kind === 'warning-alt' ? 'alert' : 'status')
	);
</script>

<CarbonToastNotification
	bind:open
	{kind}
	{title}
	{subtitle}
	{caption}
	{lowContrast}
	{timeout}
	role={resolvedRole}
	{hideCloseButton}
	{fullWidth}
	statusIconDescription={statusIconDescription ?? `${kind} icon`}
	{closeButtonDescription}
	class={className}
	on:close={(e) => onClose?.(e.detail.timeout)}
/>
