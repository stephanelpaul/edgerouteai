import type { ReactNode } from 'react'

export function H1({ children }: { children: ReactNode }) {
	return <h1 className="text-3xl font-bold tracking-tight">{children}</h1>
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
	return (
		<h2 id={id} className="mt-10 text-xl font-semibold tracking-tight">
			{children}
		</h2>
	)
}

export function H3({ children, id }: { children: ReactNode; id?: string }) {
	return (
		<h3 id={id} className="mt-6 text-lg font-semibold tracking-tight">
			{children}
		</h3>
	)
}

export function P({ children }: { children: ReactNode }) {
	return <p className="mt-3 leading-relaxed text-neutral-300">{children}</p>
}

export function Lead({ children }: { children: ReactNode }) {
	return <p className="mt-3 text-lg leading-relaxed text-neutral-400">{children}</p>
}

export function Code({ children }: { children: ReactNode }) {
	return (
		<code className="rounded bg-neutral-900 px-1.5 py-0.5 text-[0.9em] text-neutral-200">
			{children}
		</code>
	)
}

export function CodeBlock({ children, label }: { children: string; label?: string }) {
	return (
		<div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
			{label ? (
				<div className="border-b border-neutral-800 bg-neutral-900/50 px-4 py-2 text-xs uppercase tracking-wider text-neutral-500">
					{label}
				</div>
			) : null}
			<pre className="overflow-x-auto p-4 text-sm leading-relaxed text-neutral-200">
				<code>{children}</code>
			</pre>
		</div>
	)
}

export function Note({ children, kind = 'info' }: { children: ReactNode; kind?: 'info' | 'warn' }) {
	const cls =
		kind === 'warn'
			? 'border-amber-700/50 bg-amber-950/20 text-amber-200'
			: 'border-purple-700/50 bg-purple-950/20 text-purple-200'
	return <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>
}

export function UL({ children }: { children: ReactNode }) {
	return (
		<ul className="mt-3 space-y-1.5 text-neutral-300 list-disc list-outside pl-5 leading-relaxed">
			{children}
		</ul>
	)
}

export function OL({ children }: { children: ReactNode }) {
	return (
		<ol className="mt-3 space-y-1.5 text-neutral-300 list-decimal list-outside pl-5 leading-relaxed">
			{children}
		</ol>
	)
}
