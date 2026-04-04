export default function RoutingPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Routing</h1>
          <p className="mt-1 text-neutral-400">Configure fallback chains for model routing.</p>
        </div>
        <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition">New Config</button>
      </div>
      <div className="mt-8 rounded-lg border border-neutral-800 p-12 text-center">
        <p className="text-neutral-500">No routing configs yet.</p>
        <p className="text-sm text-neutral-600 mt-1">Create a fallback chain so requests automatically retry with a different model on failure.</p>
      </div>
    </div>
  )
}
