<script lang="ts">
	import { Modal as CarbonModal } from 'carbon-components-svelte';
	import type { Snippet } from 'svelte';

	type CloseTrigger = 'escape-key' | 'outside-click' | 'close-button';

	interface Props {
		open?: boolean;
		size?: 'sm' | 'md' | 'lg';
		modalHeading?: string;
		modalLabel?: string;
		modalAriaLabel?: string;
		iconDescription?: string;
		passiveModal?: boolean;
		danger?: boolean;
		alert?: boolean;
		hasForm?: boolean;
		hasScrollingContent?: boolean;
		primaryButtonText?: string;
		primaryButtonDisabled?: boolean;
		secondaryButtonText?: string;
		secondaryButtons?: [{ text: string }, { text: string }] | [];
		selectorPrimaryFocus?: string;
		preventCloseOnClickOutside?: boolean;
		shouldSubmitOnEnter?: boolean;
		id?: string;
		class?: string;
		onClose?: (trigger: CloseTrigger) => void;
		onSubmit?: () => void;
		onClickSecondary?: (text?: string) => void;
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		size = 'md',
		modalHeading,
		modalLabel,
		modalAriaLabel,
		iconDescription = 'Close the modal',
		passiveModal = false,
		danger = false,
		alert = false,
		hasForm = false,
		hasScrollingContent = false,
		primaryButtonText = '',
		primaryButtonDisabled = false,
		secondaryButtonText = '',
		secondaryButtons = [],
		selectorPrimaryFocus = '[data-modal-primary-focus]',
		preventCloseOnClickOutside = false,
		shouldSubmitOnEnter = true,
		id,
		class: className,
		onClose,
		onSubmit,
		onClickSecondary,
		children
	}: Props = $props();

	const carbonSize = $derived(size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : undefined);
	const carbonSecondaryButtons = $derived(
		secondaryButtons && secondaryButtons.length === 2
			? (secondaryButtons as [{ text: string }, { text: string }])
			: undefined
	);
</script>

{#if carbonSecondaryButtons}
	<CarbonModal
		bind:open
		size={carbonSize}
		{modalHeading}
		{modalLabel}
		{modalAriaLabel}
		{iconDescription}
		{passiveModal}
		{danger}
		{alert}
		{hasForm}
		{hasScrollingContent}
		{primaryButtonText}
		{primaryButtonDisabled}
		secondaryButtons={carbonSecondaryButtons}
		{selectorPrimaryFocus}
		{preventCloseOnClickOutside}
		{shouldSubmitOnEnter}
		{id}
		class={className}
		on:close={(e) => onClose?.(e.detail.trigger)}
		on:submit={() => onSubmit?.()}
		on:click:button--secondary={(e) => onClickSecondary?.(e.detail.text)}
	>
		{@render children?.()}
	</CarbonModal>
{:else}
	<CarbonModal
		bind:open
		size={carbonSize}
		{modalHeading}
		{modalLabel}
		{modalAriaLabel}
		{iconDescription}
		{passiveModal}
		{danger}
		{alert}
		{hasForm}
		{hasScrollingContent}
		{primaryButtonText}
		{primaryButtonDisabled}
		{secondaryButtonText}
		{selectorPrimaryFocus}
		{preventCloseOnClickOutside}
		{shouldSubmitOnEnter}
		{id}
		class={className}
		on:close={(e) => onClose?.(e.detail.trigger)}
		on:submit={() => onSubmit?.()}
		on:click:button--secondary={(e) => onClickSecondary?.(e.detail.text)}
	>
		{@render children?.()}
	</CarbonModal>
{/if}
