/** Shared types for the V3 (NVIDIA-themed) UI served on port 5175. */

/** A single segment in the V3 breadcrumb bar. */
export interface V3Crumb {
	label: string;
	/** Omit on the last (current) segment — it renders as plain text. */
	href?: string;
}
