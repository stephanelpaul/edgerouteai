const providers = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google', name: 'Google' },
  { id: 'mistral', name: 'Mistral' },
  { id: 'xai', name: 'xAI' },
]

export default function ProvidersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Provider Keys</h1>
      <p className="mt-1 text-neutral-400">Add your API keys for each LLM provider.</p>
      <div className="mt-8 space-y-4">
        {providers.map((provider) => (
          <div key={provider.id} className="flex items-center justify-between rounded-lg border border-neutral-800 p-4">
            <div>
              <p className="font-medium">{provider.name}</p>
              <p className="text-sm text-neutral-500">No key configured</p>
            </div>
            <button className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 transition">Add Key</button>
          </div>
        ))}
      </div>
    </div>
  )
}
