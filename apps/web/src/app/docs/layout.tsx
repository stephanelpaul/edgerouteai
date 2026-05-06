'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

const sections: Array<{ title: string; items: Array<{ href: string; label: string }> }> = [
	{
		title: 'Get started',
		items: [
			{ href: '/docs', label: 'Overview' },
			{ href: '/docs/quickstart', label: 'Quickstart' },
			{ href: '/docs/auth', label: 'Authentication' },
			{ href: '/docs/byok', label: 'BYOK setup' },
		],
	},
	{
		title: 'Features',
		items: [
			{ href: '/docs/mcp', label: 'MCP server' },
			{ href: '/docs/integrations', label: 'Client integrations' },
			{ href: '/docs/observability', label: 'Observability' },
			{ href: '/docs/guardrails', label: 'Guardrails' },
		],
	},
	{
		title: 'Reference',
		items: [
			{ href: '/docs/api-reference', label: 'API reference' },
			{ href: '/docs/self-host', label: 'Self-hosting' },
		],
	},
]

export default function DocsLayout({ children }: { children: ReactNode }) {
	const pathname = usePathname()
	return (
		<div className="min-h-screen">
			<header className="sticky top-0 z-30 backdrop-blur bg-neutral-950/70 border-b border-neutral-900">
				<nav className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
					<Link href="/" className="font-bold tracking-tight text-lg">
						EdgeRouteAI
					</Link>
					<div className="flex items-center gap-3 text-sm">
						<Link href="/docs" className="text-neutral-400 hover:text-neutral-200 transition">
							Docs
						</Link>
						<a
							href="https://github.com/stephanelpaul/edgerouteai"
							className="hidden sm:inline text-neutral-400 hover:text-neutral-200 transition"
						>
							GitHub
						</a>
						<Link
							href="/dashboard"
							className="hidden sm:inline text-neutral-400 hover:text-neutral-200 transition"
						>
							Dashboard
						</Link>
						<Link
							href="/signup"
							className="rounded-lg bg-purple-600 px-3.5 py-1.5 font-medium text-white hover:bg-purple-500 transition"
						>
							Get started
						</Link>
					</div>
				</nav>
			</header>

			<div className="mx-auto max-w-6xl px-4 grid grid-cols-1 md:grid-cols-[14rem_1fr] gap-8 py-10">
				<aside className="md:sticky md:top-20 self-start text-sm">
					<nav className="space-y-6">
						{sections.map((section) => (
							<div key={section.title}>
								<p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
									{section.title}
								</p>
								<ul className="space-y-1">
									{section.items.map((item) => {
										const active = pathname === item.href
										return (
											<li key={item.href}>
												<Link
													href={item.href}
													className={`block rounded-md px-3 py-1.5 transition ${
														active
															? 'bg-neutral-800 text-white font-medium'
															: 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
													}`}
												>
													{item.label}
												</Link>
											</li>
										)
									})}
								</ul>
							</div>
						))}
					</nav>
				</aside>

				<article className="min-w-0 max-w-3xl">{children}</article>
			</div>
		</div>
	)
}
