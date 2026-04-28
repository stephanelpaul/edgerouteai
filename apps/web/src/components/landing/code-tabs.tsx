'use client'
import { useState } from 'react'

interface CodeSample {
	id: string
	label: string
	code: string
}

const SAMPLES: CodeSample[] = [
	{
		id: 'curl',
		label: 'curl',
		code: `curl https://api.edgerouteai.com/v1/chat/completions \\
  -H "Authorization: Bearer $EDGEROUTE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "auto",
    "messages": [{"role":"user","content":"Hello"}]
  }'`,
	},
	{
		id: 'js',
		label: 'JavaScript',
		code: `import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.EDGEROUTE_KEY,
  baseURL: 'https://api.edgerouteai.com/v1',
})

const r = await client.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: 'Hello' }],
})`,
	},
	{
		id: 'py',
		label: 'Python',
		code: `from openai import OpenAI

client = OpenAI(
    api_key=os.environ["EDGEROUTE_KEY"],
    base_url="https://api.edgerouteai.com/v1",
)

r = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello"}],
)`,
	},
	{
		id: 'mcp',
		label: 'MCP',
		code: `// Claude Desktop / Cursor / Cline config
{
  "mcpServers": {
    "edgerouteai": {
      "command": "npx",
      "args": ["-y", "@edgerouteai/mcp-stdio"],
      "env": { "EDGEROUTE_KEY": "your-key-here" }
    }
  }
}`,
	},
]

export function CodeTabs() {
	const [activeId, setActiveId] = useState(SAMPLES[0].id)
	const [copied, setCopied] = useState(false)
	const active = SAMPLES.find((s) => s.id === activeId) ?? SAMPLES[0]

	async function onCopy() {
		try {
			await navigator.clipboard.writeText(active.code)
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch {
			// Clipboard unavailable in some sandboxed previews; silently no-op.
		}
	}

	return (
		<div className="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
			<div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/50">
				<div className="flex">
					{SAMPLES.map((s) => (
						<button
							key={s.id}
							type="button"
							onClick={() => setActiveId(s.id)}
							className={`px-4 py-2 text-sm font-medium transition border-b-2 ${
								s.id === activeId
									? 'border-purple-500 text-neutral-100'
									: 'border-transparent text-neutral-500 hover:text-neutral-300'
							}`}
						>
							{s.label}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={onCopy}
					className="mr-3 rounded-md px-2.5 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition"
				>
					{copied ? 'Copied' : 'Copy'}
				</button>
			</div>
			<pre className="overflow-x-auto p-4 text-sm leading-relaxed text-neutral-200">
				<code>{active.code}</code>
			</pre>
		</div>
	)
}
