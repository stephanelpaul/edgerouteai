async function importKey(base64Key: string): Promise<CryptoKey> {
	const rawKey = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0))
	return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encrypt(
	plaintext: string,
	base64Key: string,
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
	const key = await importKey(base64Key)
	const iv = crypto.getRandomValues(new Uint8Array(12))
	const encoded = new TextEncoder().encode(plaintext)
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: iv as BufferSource },
		key,
		encoded,
	)
	return { encrypted, iv }
}

export async function decrypt(
	encrypted: ArrayBuffer,
	iv: Uint8Array,
	base64Key: string,
): Promise<string> {
	const key = await importKey(base64Key)
	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: iv as BufferSource },
		key,
		encrypted,
	)
	return new TextDecoder().decode(decrypted)
}
