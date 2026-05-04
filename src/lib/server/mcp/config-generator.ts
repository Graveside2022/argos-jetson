/**
 * MCP Configuration Generator
 * Auto-generates MCP configs for the host Claude CLI
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';

import { env } from '$lib/server/env';
import { logger } from '$lib/utils/logger';

import type { MCPConfiguration, MCPServerDefinition } from './types';

/**
 * MCP server definitions for each specialized server
 */
const MCP_SERVERS = [
	{
		id: 'argos-hardware-debugger',
		name: 'Hardware Diagnostics & Recovery',
		serverFile: 'hardware-debugger.ts'
	},
	{
		id: 'argos-system-inspector',
		name: 'System Health & Docker Status',
		serverFile: 'system-inspector.ts'
	},
	{
		id: 'argos-streaming-inspector',
		name: 'SSE Stream Monitoring',
		serverFile: 'streaming-inspector.ts'
	},
	{
		id: 'argos-database-inspector',
		name: 'Database Schema & Queries',
		serverFile: 'database-inspector.ts'
	},
	{
		id: 'argos-api-debugger',
		name: 'API Endpoint Testing',
		serverFile: 'api-debugger.ts'
	},
	{
		id: 'argos-test-runner',
		name: 'Test Suite Runner',
		serverFile: 'test-runner.ts'
	},
	{
		id: 'argos-gsm-evil',
		name: 'GSM Monitoring & IMSI Detection',
		serverFile: 'gsm-evil-server.ts'
	}
] as const;

const IS_DEV = env.NODE_ENV !== 'production';

/** Standard env vars passed to all MCP servers. */
function mcpEnv(): Record<string, string> {
	return {
		NODE_ENV: env.NODE_ENV,
		ARGOS_API_URL: env.PUBLIC_ARGOS_API_URL,
		ARGOS_API_KEY: env.ARGOS_API_KEY
	};
}

/** Build command + args for a server file path. */
function mcpCommand(serverPath: string): { command: string; args: string[] } {
	return IS_DEV
		? { command: 'npx', args: ['tsx', serverPath] }
		: { command: 'node', args: [serverPath] };
}

/** Get path to MCP server executable */
function getMCPServerPath(serverFile: string): string {
	const dir = IS_DEV ? 'src/lib/server/mcp/servers' : 'build/server/mcp/servers';
	const file = IS_DEV ? serverFile : serverFile.replace('.ts', '.js');
	return join(process.cwd(), dir, file);
}

/** Generate MCP server definition */
function generateMCPServer(serverId: string, serverFile: string): MCPServerDefinition {
	return { id: serverId, ...mcpCommand(getMCPServerPath(serverFile)), env: mcpEnv() };
}

/**
 * Generate MCP configuration for Context B (Host Claude CLI)
 */
async function generateContextBConfig(): Promise<MCPConfiguration> {
	const mcpServers: Record<string, MCPServerDefinition> = {};

	// Add all modular servers
	for (const server of MCP_SERVERS) {
		mcpServers[server.id] = generateMCPServer(server.id, server.serverFile);
	}

	return { mcpServers };
}

/**
 * Write MCP configuration to file
 */
async function writeMCPConfig(mcpConfig: MCPConfiguration, path: string): Promise<void> {
	await writeFile(path, JSON.stringify(mcpConfig, null, '\t') + '\n', 'utf-8');
	logger.info('MCP config written', { path });
}

/**
 * Install MCP configuration for Context B (Host)
 * Writes to .mcp.json in the project root (where Claude Code reads it)
 *
 * @internal — invoked by `scripts/ops/mcp-install.ts`. Fallow flags this as
 * unused because scripts/ are outside its dead-code entry-point graph.
 */
export async function installContextBConfig(): Promise<string> {
	const mcpConfig = await generateContextBConfig();

	// Add shadcn (no env needed)
	mcpConfig.mcpServers['shadcn'] = {
		id: 'shadcn',
		command: 'npx',
		args: ['shadcn@latest', 'mcp']
	};

	const configPath = join(process.cwd(), '.mcp.json');
	await writeMCPConfig(mcpConfig, configPath);

	return configPath;
}

/**
 * Generate MCP configuration content (for display/testing)
 *
 * @internal — invoked by `scripts/ops/mcp-config.ts`. Fallow flags this as
 * unused because scripts/ are outside its dead-code entry-point graph.
 */
export async function generateMCPConfigContent(): Promise<string> {
	const config = await generateContextBConfig();
	return JSON.stringify(config, null, 2);
}

/**
 * Generate installation instructions
 */
export function getInstallationInstructions(): string {
	return `
# Argos MCP Servers Installation

## Available Servers

The Argos platform provides 7 specialized MCP servers:

1. **argos-hardware-debugger** - Hardware diagnostics and recovery
2. **argos-system-inspector** - System health and Docker status
3. **argos-streaming-inspector** - SSE stream monitoring
4. **argos-database-inspector** - Database schema and queries
5. **argos-api-debugger** - API endpoint testing
6. **argos-test-runner** - Test suite runner
7. **argos-gsm-evil** - GSM monitoring and IMSI detection

## Installation (Host Claude CLI)

1. Generate and install configuration:
   npm run mcp:install-b

2. Configuration will be written to:
   .mcp.json (project root)

3. Restart Claude CLI to load all servers

4. Test with:
   claude "List available Argos tools"
`;
}
