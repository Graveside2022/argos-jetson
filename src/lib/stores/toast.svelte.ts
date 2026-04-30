type Kind = 'error' | 'success' | 'info' | 'warning';

interface ToastEntry {
	id: string;
	kind: Kind;
	title: string;
	subtitle?: string;
	caption?: string;
	timeout: number;
}

interface ToastOpts {
	subtitle?: string;
	caption?: string;
	timeout?: number;
}

const DEFAULT_TIMEOUT = 4000;

const items = $state<ToastEntry[]>([]);

function add(kind: Kind, title: string, opts: ToastOpts = {}): string {
	const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	items.push({
		id,
		kind,
		title,
		subtitle: opts.subtitle,
		caption: opts.caption,
		timeout: opts.timeout ?? DEFAULT_TIMEOUT
	});
	return id;
}

function dismiss(id: string): void {
	const idx = items.findIndex((t) => t.id === id);
	if (idx !== -1) items.splice(idx, 1);
}

export const toast = {
	error: (title: string, opts?: ToastOpts) => add('error', title, opts),
	success: (title: string, opts?: ToastOpts) => add('success', title, opts),
	info: (title: string, opts?: ToastOpts) => add('info', title, opts),
	warning: (title: string, opts?: ToastOpts) => add('warning', title, opts),
	dismiss
};

export function getToasts(): ToastEntry[] {
	return items;
}
