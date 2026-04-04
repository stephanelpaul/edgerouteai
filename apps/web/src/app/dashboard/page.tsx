export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="mt-2 text-neutral-400">Your usage across all models.</p>
      <div className="mt-8 grid grid-cols-3 gap-6">
        {[['Total Spend', '$0.00'], ['Requests', '0'], ['Tokens', '0']].map(([title, value]) => (
          <div key={title} className="rounded-lg border border-neutral-800 p-6">
            <p className="text-sm text-neutral-400">{title}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-lg border border-neutral-800 p-6">
        <p className="text-neutral-500 text-center py-12">No data yet. Make your first API request to see usage stats.</p>
      </div>
    </div>
  )
}
