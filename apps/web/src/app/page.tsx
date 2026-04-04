import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold tracking-tight">EdgeRouteAI</h1>
        <p className="mt-4 text-xl text-neutral-400">
          Open-source LLM gateway on the edge. One API, every model. Bring your own keys.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link href="/signup" className="rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-500 transition">
            Get Started
          </Link>
          <Link href="/dashboard" className="rounded-lg border border-neutral-700 px-6 py-3 font-medium text-neutral-300 hover:bg-neutral-900 transition">
            Dashboard
          </Link>
        </div>
        <div className="mt-16 grid grid-cols-3 gap-8 text-left">
          <div>
            <h3 className="font-semibold text-lg">BYOK</h3>
            <p className="mt-2 text-sm text-neutral-400">Bring your own API keys. We never see your bills. Your keys, your costs, your control.</p>
          </div>
          <div>
            <h3 className="font-semibold text-lg">One Endpoint</h3>
            <p className="mt-2 text-sm text-neutral-400">OpenAI-compatible API for OpenAI, Anthropic, Google, Mistral, and xAI. Switch models with one parameter.</p>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Edge-Native</h3>
            <p className="mt-2 text-sm text-neutral-400">Built on Cloudflare Workers. Low latency, global distribution, near-zero cold starts.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
