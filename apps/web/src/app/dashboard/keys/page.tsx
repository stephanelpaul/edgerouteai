export default function KeysPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="mt-1 text-neutral-400">Create and manage your EdgeRouteAI API keys.</p>
        </div>
        <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition">Create Key</button>
      </div>
      <div className="mt-8 rounded-lg border border-neutral-800 p-12 text-center">
        <p className="text-neutral-500">No API keys yet.</p>
        <p className="text-sm text-neutral-600 mt-1">Create your first API key to start using EdgeRouteAI.</p>
      </div>
    </div>
  )
}
