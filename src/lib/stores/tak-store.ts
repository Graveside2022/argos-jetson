import { writable } from 'svelte/store';

import type { TakStatus } from '$lib/types/tak';

const DEFAULT_STATUS: TakStatus = { status: 'disconnected' };

export const takStatus = writable<TakStatus>(DEFAULT_STATUS);
export const takCotMessages = writable<string[]>([]);
