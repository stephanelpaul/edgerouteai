'use client'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface AdminUser {
	id: string
	name: string | null
	email: string
	role: string
	createdAt: number
}

interface PlatformStats {
	users: number
	activeKeys: number
	totalRequests: number
	totalCost: number
	totalTokens: number
}

const ROLE_COLORS: Record<string, string> = {
	superadmin: 'text-amber-400 bg-amber-400/10',
	admin: 'text-blue-400 bg-blue-400/10',
	user: 'text-neutral-400 bg-neutral-400/10',
}

export default function AdminPage() {
	const { user, isAdmin, isSuperadmin, apiUrl, isLoading } = useAuth()
	const router = useRouter()

	const [stats, setStats] = useState<PlatformStats | null>(null)
	const [users, setUsers] = useState<AdminUser[]>([])
	const [loadingData, setLoadingData] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [roleChanging, setRoleChanging] = useState<string | null>(null)
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
	const [deleting, setDeleting] = useState<string | null>(null)

	useEffect(() => {
		if (!isLoading && !isAdmin) {
			router.replace('/dashboard')
		}
	}, [isLoading, isAdmin, router])

	useEffect(() => {
		if (isAdmin) {
			fetchData()
		}
	}, [isAdmin])

	const fetchData = async () => {
		setLoadingData(true)
		setError(null)
		try {
			const [statsRes, usersRes] = await Promise.all([
				fetch(`${apiUrl}/api/admin/stats`, { credentials: 'include' }),
				fetch(`${apiUrl}/api/admin/users`, { credentials: 'include' }),
			])
			if (!statsRes.ok || !usersRes.ok) {
				throw new Error('Failed to load admin data')
			}
			const statsData = await statsRes.json()
			const usersData = await usersRes.json()
			setStats(statsData as PlatformStats)
			setUsers((usersData as { users: AdminUser[] }).users)
		} catch (e) {
			setError((e as { message?: string }).message ?? 'Failed to load data')
		} finally {
			setLoadingData(false)
		}
	}

	const handleRoleChange = async (userId: string, newRole: string) => {
		setRoleChanging(userId)
		try {
			const res = await fetch(`${apiUrl}/api/admin/users/${userId}/role`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ role: newRole }),
			})
			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(
					(data as { error?: { message?: string } }).error?.message ?? 'Failed to update role',
				)
			}
			setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
		} catch (e) {
			alert((e as { message?: string }).message)
		} finally {
			setRoleChanging(null)
		}
	}

	const handleDelete = async (userId: string) => {
		setDeleting(userId)
		try {
			const res = await fetch(`${apiUrl}/api/admin/users/${userId}`, {
				method: 'DELETE',
				credentials: 'include',
			})
			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(
					(data as { error?: { message?: string } }).error?.message ?? 'Failed to delete user',
				)
			}
			setUsers((prev) => prev.filter((u) => u.id !== userId))
			setDeleteConfirm(null)
		} catch (e) {
			alert((e as { message?: string }).message)
		} finally {
			setDeleting(null)
		}
	}

	if (isLoading || loadingData) {
		return <div className="p-8 text-neutral-400 text-sm">Loading...</div>
	}

	if (!isAdmin) {
		return null
	}

	if (error) {
		return (
			<div className="p-8">
				<p className="text-red-400 text-sm">{error}</p>
				<button
					type="button"
					onClick={fetchData}
					className="mt-4 text-sm text-neutral-400 underline"
				>
					Retry
				</button>
			</div>
		)
	}

	return (
		<div className="p-8 max-w-6xl">
			<div className="mb-8">
				<h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
				<p className="text-neutral-400 text-sm mt-1">Platform overview and user management</p>
			</div>

			{/* Stats */}
			{stats && (
				<div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-4">
					{[
						{ label: 'Total Users', value: stats.users },
						{ label: 'Active API Keys', value: stats.activeKeys },
						{ label: 'Total Requests', value: Number(stats.totalRequests ?? 0).toLocaleString() },
						{ label: 'Total Cost', value: `$${Number(stats.totalCost ?? 0).toFixed(4)}` },
					].map((stat) => (
						<div
							key={stat.label}
							className="bg-neutral-900 rounded-lg p-4 border border-neutral-800"
						>
							<p className="text-xs text-neutral-500 mb-1">{stat.label}</p>
							<p className="text-2xl font-bold text-white">{stat.value}</p>
						</div>
					))}
				</div>
			)}

			{/* Users table */}
			<div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
				<div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
					<h2 className="text-sm font-semibold text-white">Users ({users.length})</h2>
					<button
						type="button"
						onClick={fetchData}
						className="text-xs text-neutral-400 hover:text-white transition"
					>
						Refresh
					</button>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-neutral-800 text-left">
								<th className="px-6 py-3 text-xs text-neutral-500 font-medium">Name / Email</th>
								<th className="px-6 py-3 text-xs text-neutral-500 font-medium">Role</th>
								<th className="px-6 py-3 text-xs text-neutral-500 font-medium">Created</th>
								{isSuperadmin && (
									<th className="px-6 py-3 text-xs text-neutral-500 font-medium">Actions</th>
								)}
							</tr>
						</thead>
						<tbody>
							{users.map((u) => {
								const isCurrentUser = u.id === user?.id
								const roleColor = ROLE_COLORS[u.role] ?? ROLE_COLORS.user
								return (
									<tr
										key={u.id}
										className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition"
									>
										<td className="px-6 py-4">
											<p className="text-white font-medium">{u.name || '—'}</p>
											<p className="text-neutral-500 text-xs">{u.email}</p>
										</td>
										<td className="px-6 py-4">
											<span
												className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${roleColor}`}
											>
												{u.role}
											</span>
										</td>
										<td className="px-6 py-4 text-neutral-400 text-xs">
											{new Date(u.createdAt).toLocaleDateString()}
										</td>
										{isSuperadmin && (
											<td className="px-6 py-4">
												{isCurrentUser ? (
													<span className="text-xs text-neutral-600">you</span>
												) : deleteConfirm === u.id ? (
													<div className="flex items-center gap-2">
														<span className="text-xs text-red-400">Delete {u.email}?</span>
														<button
															type="button"
															onClick={() => handleDelete(u.id)}
															disabled={deleting === u.id}
															className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded transition disabled:opacity-50"
														>
															{deleting === u.id ? 'Deleting...' : 'Confirm'}
														</button>
														<button
															type="button"
															onClick={() => setDeleteConfirm(null)}
															className="text-xs text-neutral-400 hover:text-white transition"
														>
															Cancel
														</button>
													</div>
												) : (
													<div className="flex items-center gap-2">
														<select
															value={u.role}
															disabled={roleChanging === u.id}
															onChange={(e) => handleRoleChange(u.id, e.target.value)}
															className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300 hover:border-neutral-600 transition disabled:opacity-50"
														>
															<option value="user">user</option>
															<option value="admin">admin</option>
															<option value="superadmin">superadmin</option>
														</select>
														<button
															type="button"
															onClick={() => setDeleteConfirm(u.id)}
															className="text-xs text-red-500 hover:text-red-400 transition"
														>
															Delete
														</button>
													</div>
												)}
											</td>
										)}
									</tr>
								)
							})}
						</tbody>
					</table>
					{users.length === 0 && (
						<div className="px-6 py-8 text-center text-neutral-500 text-sm">No users found</div>
					)}
				</div>
			</div>
		</div>
	)
}
