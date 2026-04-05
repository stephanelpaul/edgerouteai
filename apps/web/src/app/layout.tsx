import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

export const metadata: Metadata = {
	title: 'EdgeRouteAI — Open Source LLM Gateway',
	description: 'BYOK LLM API gateway built on the edge. One endpoint, every model.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark">
			<body className="bg-neutral-950 text-neutral-100 antialiased">
				<AuthProvider>{children}</AuthProvider>
			</body>
		</html>
	)
}
