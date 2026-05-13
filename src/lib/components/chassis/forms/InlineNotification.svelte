<script lang="ts">
	import { InlineNotification as CarbonInlineNotification } from 'carbon-components-svelte';

	type Kind = 'error' | 'info' | 'info-square' | 'success' | 'warning' | 'warning-alt';

	interface Props {
		open?: boolean;
		kind?: Kind;
		title?: string;
		subtitle?: string;
		lowContrast?: boolean;
		timeout?: number;
		role?: string;
		hideCloseButton?: boolean;
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
		lowContrast = false,
		timeout = 0,
		role,
		hideCloseButton = false,
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

<CarbonInlineNotification
	bind:open
	{kind}
	{title}
	{subtitle}
	{lowContrast}
	{timeout}
	role={resolvedRole}
	{hideCloseButton}
	statusIconDescription={statusIconDescription ?? `${kind} icon`}
	{closeButtonDescription}
	class={className}
	on:close={(e) => onClose?.(e.detail.timeout)}
/>
