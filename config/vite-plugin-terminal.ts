import type { Plugin, ViteDevServer } from 'vite';

import { handleTerminalUpgrade } from '../src/lib/server/terminal/handler';
import { preSpawnDefaultSession } from '../src/lib/server/terminal/session';

export function terminalPlugin(): Plugin {
	return {
		name: 'argos-terminal',
		configureServer(server: ViteDevServer) {
			const httpServer = server.httpServer;
			if (!httpServer) {
				console.warn('[argos-terminal] No HTTP server available — terminal disabled');
				return;
			}
			httpServer.on('upgrade', (req, socket, head) => {
				handleTerminalUpgrade(req, socket, head);
			});
			console.warn('[argos-terminal] Terminal WebSocket attached at /terminal-ws');
			// Match prod-server.ts + env enum default '0': pre-spawn fires only when explicitly opted-in.
			if (process.env.ARGOS_TERMINAL_PRESPAWN === '1') {
				void preSpawnDefaultSession();
			}
		}
	};
}
