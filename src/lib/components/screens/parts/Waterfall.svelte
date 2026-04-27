<!--
  Spec-024 PR9a-2 — Canvas 2D waterfall.

  Render recipe validated by T048 spike (saved at
  ~/.claude/plans/spec-024-t048-spike-findings.md):
    - Canvas geometry: 320×80 cells (W bins wide, H rows tall)
    - putImageData(topRow, 0, 0) writes one fresh row at y=0
    - drawImage(canvas, 0, 1) self-blits the existing image down 1 px
      (per MDN: drawImage with the same canvas as source is safe and
      uses GPU-accelerated copy on modern browsers)
    - RAF coalesces incoming frames to ≤10 Hz paints (one paint per
      animation frame, fold the latest frame into the top row)

  Spike measured P95 frame time = 0.20 ms on Jetson Orin (perf budget
  ≤6 ms, ≈30× headroom). No WebGL fallback needed.

  No synthetic data — only renders real `SpectrumFrame.power` arrays
  passed from parent via `frame` prop.
-->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import type { SpectrumFrame } from '$lib/types/spectrum';

	interface Props {
		frame: SpectrumFrame | null;
		minDb?: number;
		maxDb?: number;
	}

	const { frame, minDb = -90, maxDb = -20 }: Props = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let ctx: CanvasRenderingContext2D | null = null;
	let topRow: ImageData | null = null;
	let rafId: number | null = null;
	let pendingFrame: SpectrumFrame | null = null;

	const W = 320;
	const H = 80;

	$effect(() => {
		if (frame) pendingFrame = frame;
	});

	onMount(() => {
		if (!canvas) return;
		canvas.width = W;
		canvas.height = H;
		ctx = canvas.getContext('2d', { alpha: false });
		if (!ctx) return;
		// Resolve --mk2-bg via getComputedStyle so the initial fill matches
		// the design-token background. Falls back to a CSS-token-aligned
		// raw value if the var isn't yet applied (initial paint race).
		ctx.fillStyle = readBgToken(canvas) ?? 'oklch(13% 0.008 255)';
		ctx.fillRect(0, 0, W, H);
		topRow = ctx.createImageData(W, 1);
		scheduleRaf();
	});

	onDestroy(() => {
		if (rafId !== null) cancelAnimationFrame(rafId);
	});

	function scheduleRaf(): void {
		rafId = requestAnimationFrame(tick);
	}

	function tick(): void {
		if (pendingFrame && ctx && topRow) {
			drawRow(pendingFrame);
			pendingFrame = null;
		}
		scheduleRaf();
	}

	function drawRow(f: SpectrumFrame): void {
		if (!ctx || !topRow || !canvas) return;
		fillTopRow(topRow.data, f.power, minDb, maxDb);
		// Self-blit: shift current image down 1 px, then write fresh row at y=0.
		ctx.drawImage(canvas, 0, 1);
		ctx.putImageData(topRow, 0, 0);
	}

	function fillTopRow(
		px: Uint8ClampedArray,
		power: readonly number[],
		lo: number,
		hi: number
	): void {
		const range = hi - lo;
		for (let i = 0; i < W; i += 1) {
			// Bin-bucket: map canvas column → power array index.
			const bin = Math.floor((i / W) * power.length);
			const v = power[bin] ?? lo;
			const norm = Math.max(0, Math.min(1, (v - lo) / range));
			const [r, g, b] = colormap(norm);
			const o = i * 4;
			px[o] = r;
			px[o + 1] = g;
			px[o + 2] = b;
			px[o + 3] = 255;
		}
	}

	// Steel-blue → cyan → green → amber colormap. Matches Lunaris accent
	// rotation (mk2-steel/cyan/green/amber); avoids spectral rainbow that
	// is hostile to color-blind viewers.
	function colormap(t: number): [number, number, number] {
		if (t < 0.25) return lerpRgb(20, 28, 60, 80, 130, 200, t / 0.25);
		if (t < 0.5) return lerpRgb(80, 130, 200, 80, 220, 220, (t - 0.25) / 0.25);
		if (t < 0.75) return lerpRgb(80, 220, 220, 140, 220, 130, (t - 0.5) / 0.25);
		return lerpRgb(140, 220, 130, 250, 200, 80, (t - 0.75) / 0.25);
	}

	function lerpRgb(
		r0: number,
		g0: number,
		b0: number,
		r1: number,
		g1: number,
		b1: number,
		k: number
	): [number, number, number] {
		return [
			Math.round(r0 + (r1 - r0) * k),
			Math.round(g0 + (g1 - g0) * k),
			Math.round(b0 + (b1 - b0) * k)
		];
	}

	function readBgToken(el: HTMLElement): string | null {
		const v = getComputedStyle(el).getPropertyValue('--mk2-bg').trim();
		return v.length > 0 ? v : null;
	}
</script>

<canvas bind:this={canvas} aria-label="Spectrum waterfall — newest at top, scrolls down"></canvas>

<style>
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		image-rendering: pixelated;
		background: var(--mk2-bg);
		border: 1px solid var(--mk2-line);
	}
</style>
