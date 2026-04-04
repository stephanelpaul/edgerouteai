export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-neutral-400">Manage your account.</p>
      <div className="mt-8 space-y-6">
        <div className="rounded-lg border border-neutral-800 p-6">
          <h2 className="font-semibold">Account</h2>
          <p className="mt-1 text-sm text-neutral-400">Manage your account settings.</p>
        </div>
        <div className="rounded-lg border border-red-900/50 p-6">
          <h2 className="font-semibold text-red-400">Danger Zone</h2>
          <p className="mt-1 text-sm text-neutral-400">Delete your account and all associated data.</p>
          <button className="mt-4 rounded-md border border-red-800 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950 transition">Delete Account</button>
        </div>
      </div>
    </div>
  )
}
