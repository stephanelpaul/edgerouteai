import { CodeBlock, H1, H2, Lead, P } from '@/components/docs/prose'
import Link from 'next/link'

export default function IntegrationsPage() {
	return (
		<>
			<H1>Client integrations</H1>
			<Lead>
				EdgeRouteAI is OpenAI-compatible at <code>api.edgerouteai.com/v1</code>, and exposes MCP at{' '}
				<code>mcp.edgerouteai.com</code>. Most clients work with one config tweak. The{' '}
				<Link href="/dashboard/setup" className="text-purple-300 hover:text-purple-200 underline">
					Setup page
				</Link>{' '}
				generates these snippets pre-filled with your API key.
			</Lead>

			<H2 id="claude-desktop">Claude Desktop</H2>
			<CodeBlock label="claude_desktop_config.json">{`{
  "mcpServers": {
    "edgerouteai": {
      "command": "npx",
      "args": ["-y", "@edgerouteai/mcp-stdio"],
      "env": { "EDGEROUTE_KEY": "edgrt_…" }
    }
  }
}`}</CodeBlock>

			<H2 id="cursor">Cursor</H2>
			<P>Same MCP config in Cursor's MCP settings. EdgeRoute appears as a callable tool.</P>
			<CodeBlock label="~/.cursor/mcp.json">{`{
  "mcpServers": {
    "edgerouteai": {
      "command": "npx",
      "args": ["-y", "@edgerouteai/mcp-stdio"],
      "env": { "EDGEROUTE_KEY": "edgrt_…" }
    }
  }
}`}</CodeBlock>

			<H2 id="cline">Cline (VS Code)</H2>
			<P>
				Cline reads <code>cline_mcp_settings.json</code> in the VS Code globalStorage. Same MCP
				shape.
			</P>

			<H2 id="continue">Continue (VS Code)</H2>
			<P>
				Continue treats EdgeRoute as a custom OpenAI-compatible provider. Add to{' '}
				<code>~/.continue/config.json</code>:
			</P>
			<CodeBlock label="config.json">{`{
  "models": [
    {
      "title": "EdgeRouteAI auto",
      "provider": "openai",
      "model": "auto",
      "apiBase": "https://api.edgerouteai.com/v1",
      "apiKey": "edgrt_…"
    }
  ]
}`}</CodeBlock>

			<H2 id="aider">Aider</H2>
			<CodeBlock label="shell">{`export OPENAI_API_BASE=https://api.edgerouteai.com/v1
export OPENAI_API_KEY=edgrt_…
aider --model auto`}</CodeBlock>

			<H2 id="open-webui">Open WebUI / LibreChat / TypingMind / Chatbox / LobeChat</H2>
			<P>
				All five expose a "Custom OpenAI-compatible provider" or "Add base URL" setting. Plug in:
			</P>
			<CodeBlock>{`Base URL: https://api.edgerouteai.com/v1
API Key:  edgrt_…
Model:    auto    (or any of the 11 explicit models)`}</CodeBlock>

			<H2 id="langchain">LangChain</H2>
			<CodeBlock label="Python">{`from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="auto",
    api_key="edgrt_…",
    base_url="https://api.edgerouteai.com/v1",
)`}</CodeBlock>

			<H2 id="vercel-ai-sdk">Vercel AI SDK</H2>
			<CodeBlock label="TypeScript">{`import { createOpenAI } from '@ai-sdk/openai'

const edgeroute = createOpenAI({
  apiKey: process.env.EDGEROUTE_KEY,
  baseURL: 'https://api.edgerouteai.com/v1',
})

const result = await streamText({
  model: edgeroute('auto'),
  prompt: 'Hello',
})`}</CodeBlock>
		</>
	)
}
