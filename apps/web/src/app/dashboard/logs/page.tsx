export default function LogsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Request Logs</h1>
      <p className="mt-1 text-neutral-400">View your API request history.</p>
      <div className="mt-8 rounded-lg border border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-800 bg-neutral-900/50">
            <tr>
              {['Time', 'Provider', 'Model', 'Tokens', 'Cost', 'Latency', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-neutral-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={7} className="px-4 py-12 text-center text-neutral-500">No requests yet.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
