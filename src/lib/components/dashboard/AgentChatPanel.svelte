<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import InProgress from 'carbon-icons-svelte/lib/InProgress.svelte';
	import SendAlt from 'carbon-icons-svelte/lib/SendAlt.svelte';
	import { onMount } from 'svelte';

	import { lastInteractionEvent } from '$lib/stores/dashboard/agent-context-store.svelte';

	import {
		clearChat,
		getInputValue,
		getIsCheckingLLM,
		getIsStreaming,
		getLlmProvider,
		getMessages,
		handleInteractionEvent,
		handleKeydown,
		initializeChat,
		sendMessage,
		setChatContainer,
		setInputValue
	} from './agent-chat-logic.svelte';
	import AgentChatMessage from './AgentChatMessage.svelte';
	import AgentChatToolbar from './AgentChatToolbar.svelte';

	// Props (kept for backward compatibility — currently unused by consumer)
	interface Props {
		selectedDevice?: string;
		mapBounds?: { north: number; south: number; east: number; west: number };
		activeSignals?: number;
		userLocation?: { lat: number; lon: number };
	}

	let {
		selectedDevice: _selectedDevice = $bindable(),
		mapBounds: _mapBounds,
		activeSignals: _activeSignals,
		userLocation: _userLocation
	}: Props = $props();

	let chatContainerEl: HTMLDivElement;

	// Reactive accessors from logic module
	const messages = $derived(getMessages());
	const inputValue = $derived(getInputValue());
	const isStreaming = $derived(getIsStreaming());
	const llmProvider = $derived(getLlmProvider());
	const isCheckingLLM = $derived(getIsCheckingLLM());

	const lastMessage = $derived(messages[messages.length - 1]);
	const showTypingIndicator = $derived(
		isStreaming && lastMessage?.role === 'assistant' && !lastMessage.content
	);

	onMount(() => {
		setChatContainer(chatContainerEl);
		initializeChat();
	});

	// Auto-send device context when operator clicks a device on the map
	$effect(() => {
		handleInteractionEvent(lastInteractionEvent.current);
	});

	function onInput(e: Event) {
		setInputValue((e.target as HTMLTextAreaElement).value);
	}
</script>

<div class="agent-chat-panel">
	<AgentChatToolbar {llmProvider} {isCheckingLLM} onClear={clearChat} />

	<!-- Messages container -->
	<div class="chat-messages" bind:this={chatContainerEl}>
		{#each messages as message (message.timestamp)}
			<AgentChatMessage {message} />
		{/each}

		{#if showTypingIndicator}
			<div class="typing-indicator">
				<span class="dot"></span>
				<span class="dot"></span>
				<span class="dot"></span>
			</div>
		{/if}
	</div>

	<!-- Input area -->
	<div class="chat-input-area">
		<textarea
			value={inputValue}
			oninput={onInput}
			onkeydown={handleKeydown}
			placeholder={llmProvider === 'unavailable'
				? 'Agent unavailable. Configure ANTHROPIC_API_KEY in environment.'
				: 'Type a message...'}
			disabled={isStreaming || llmProvider === 'unavailable'}
			class="chat-input"
			rows="1"
		></textarea>
		<button
			class="send-btn"
			onclick={sendMessage}
			disabled={!inputValue.trim() || isStreaming || llmProvider === 'unavailable'}
			title="Send message"
		>
			{#if isStreaming}
				<InProgress size={16} class="spin" />
			{:else}
				<SendAlt size={16} />
			{/if}
		</button>
	</div>
</div>

<style>
	.agent-chat-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--cds-background);
		color: var(--cds-text-primary);
		font-family: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif;
		font-size: 0.8125rem;
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: 8px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.typing-indicator {
		display: flex;
		gap: 4px;
		padding: 8px 12px;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--cds-text-helper);
		animation: pulse 1.4s infinite;
	}

	.dot:nth-child(2) {
		animation-delay: 0.2s;
	}

	.dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes pulse {
		0%,
		60%,
		100% {
			opacity: 0.3;
		}
		30% {
			opacity: 1;
		}
	}

	.chat-input-area {
		display: flex;
		gap: 8px;
		padding: 8px 12px;
		background: var(--cds-layer);
		border-top: 1px solid var(--cds-border-subtle);
	}

	.chat-input {
		flex: 1;
		height: 32px;
		background: var(--cds-background);
		border: 1px solid var(--cds-border-subtle);
		border-radius: 4px;
		color: var(--cds-text-primary);
		padding: 6px 12px;
		font-family: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif;
		font-size: 13px;
		resize: none;
		outline: none;
	}

	.chat-input:focus {
		border-color: var(--cds-border-strong);
	}

	.chat-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.send-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: var(--cds-link-primary);
		border: none;
		border-radius: 4px;
		color: white;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.1s;
	}

	.send-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--cds-link-primary) 85%, white);
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.chat-messages::-webkit-scrollbar {
		width: 10px;
	}

	.chat-messages::-webkit-scrollbar-track {
		background: var(--cds-background);
	}

	.chat-messages::-webkit-scrollbar-thumb {
		background: var(--cds-layer);
		border-radius: 5px;
	}

	.chat-messages::-webkit-scrollbar-thumb:hover {
		background: color-mix(in srgb, var(--cds-text-helper) 50%, transparent);
	}
</style>
