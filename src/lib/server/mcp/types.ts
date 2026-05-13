/**
 * MCP (Model Context Protocol) Types
 * Auto-generated MCP servers for Context B/C integration
 */

/**
 * JSON Schema property descriptor for MCP tool input schemas
 */
export interface JsonSchemaProperty {
	type: string;
	description?: string;
	enum?: string[];
	default?: unknown;
	items?: JsonSchemaProperty;
	properties?: Record<string, JsonSchemaProperty>;
	required?: string[];
	[key: string]: unknown;
}

/**
 * MCP Tool Definition (Anthropic format)
 *
 * @internal — kept for future dynamic-server registration. Not yet wired
 * to a consumer; deletion would lose the contract for tool publishing.
 */
export interface MCPTool {
	name: string;
	description: string;
	inputSchema: {
		type: 'object';
		properties: Record<string, JsonSchemaProperty>;
		required?: string[];
	};
}

/**
 * MCP Resource Definition
 *
 * @internal — paired with MCPTool above; reserved for the resource-publishing
 * surface of the dynamic MCP server.
 */
export interface MCPResource {
	uri: string;
	name: string;
	description?: string;
	mimeType?: string;
}

/**
 * MCP Server Configuration
 *
 * @internal — describes capability flags for a dynamic MCP server; not
 * consumed externally yet but defines the registration contract.
 */
export interface MCPServerConfig {
	name: string;
	version: string;
	description: string;
	capabilities: {
		hasTools: boolean;
		hasResources: boolean;
		hasPrompts: boolean;
	};
}

/**
 * MCP Tool Execution Result
 *
 * @internal — return shape for dynamic MCP tool handlers; reserved.
 */
export interface MCPToolResult {
	content: Array<{
		type: 'text' | 'image' | 'resource';
		text?: string;
		data?: string;
		mimeType?: string;
	}>;
	isError?: boolean;
}

/**
 * MCP Server for Context B/C
 */
export interface MCPServerDefinition {
	id: string;
	command: string;
	args: string[];
	env?: Record<string, string>;
}

/**
 * MCP Configuration for Claude CLI
 */
export interface MCPConfiguration {
	mcpServers: Record<string, MCPServerDefinition>;
}

/**
 * Registry change event
 */
export type RegistryChangeEvent =
	| 'tool_added'
	| 'tool_removed'
	| 'hardware_added'
	| 'hardware_removed';

/**
 * Registry change listener
 *
 * @internal — listener signature for the dynamic MCP registry; consumed
 * via reflection paths fallow can't trace.
 */
export type RegistryChangeListener = (event: RegistryChangeEvent, id: string) => void;
