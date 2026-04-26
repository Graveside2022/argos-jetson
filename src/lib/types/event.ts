export type AppEventLevel = 'info' | 'warn' | 'error';

export interface AppEvent {
	id: string;
	timestamp: number;
	level: AppEventLevel;
	source: string;
	payload: Record<string, unknown>;
}
