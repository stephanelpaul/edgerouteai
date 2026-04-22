# @edgerouteai/mcp-stdio

Local stdio bridge for [EdgeRouteAI](https://edgerouteai.com)'s MCP server.

Claude Desktop, Cursor, Cline, Continue, and other MCP hosts launch servers as local subprocesses and communicate over stdin/stdout. EdgeRouteAI's MCP server runs remotely at `https://mcp.edgerouteai.com` — this package is a tiny shim that bridges the two.

## Install

You don't need to install globally. Just point your MCP host at `npx`.

## Claude Desktop

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "edgerouteai": {
      "command": "npx",
      "args": ["-y", "@edgerouteai/mcp-stdio"],
      "env": {
        "EDGEROUTEAI_API_KEY": "sk-er-your-key-here"
      }
    }
  }
}
```

Restart Claude Desktop. You should see `edgerouteai` appear in the MCP tools panel, exposing:

- `chat` — call any model EdgeRouteAI supports (use `model: "auto"` for automatic routing)
- `list_models` — see every model available to you (BYOK + platform)
- `get_usage` — current credit balance + today / 7-day spend
- `auto_select_model` — preview which model the cost-aware router would pick

## Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "edgerouteai": {
      "command": "npx",
      "args": ["-y", "@edgerouteai/mcp-stdio"],
      "env": { "EDGEROUTEAI_API_KEY": "sk-er-..." }
    }
  }
}
```

## Any other MCP host

Generally: `command: npx`, `args: ["-y", "@edgerouteai/mcp-stdio"]`, with `EDGEROUTEAI_API_KEY` in env.

## Environment variables

| Name | Required | Purpose |
|------|----------|---------|
| `EDGEROUTEAI_API_KEY` | yes | Your `sk-er-...` API key from https://app.edgerouteai.com/dashboard/keys |
| `EDGEROUTEAI_MCP_URL` | no | Override the remote endpoint (defaults to `https://mcp.edgerouteai.com/mcp`). Useful for self-hosters. |

## Self-hosted

If you're running the EdgeRouteAI gateway yourself, set `EDGEROUTEAI_MCP_URL` to point at your own MCP worker.

## License

FSL-1.1-Apache-2.0. Converts to Apache 2.0 on 2028-04-22.
