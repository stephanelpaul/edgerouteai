import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../../../apps/api/src/lib/crypto'

const TEST_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(1)))

describe('Crypto helpers', () => {
  it('encrypts and decrypts round-trip', async () => {
    const plaintext = 'sk-ant-my-secret-api-key-12345'
    const { encrypted, iv } = await encrypt(plaintext, TEST_KEY)
    expect(encrypted).toBeInstanceOf(ArrayBuffer)
    expect(iv).toBeInstanceOf(Uint8Array)
    expect(iv.byteLength).toBe(12)
    const decrypted = await decrypt(encrypted, iv, TEST_KEY)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext for same plaintext', async () => {
    const { iv: iv1 } = await encrypt('sk-test', TEST_KEY)
    const { iv: iv2 } = await encrypt('sk-test', TEST_KEY)
    expect(iv1).not.toEqual(iv2)
  })

  it('fails to decrypt with wrong key', async () => {
    const wrongKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(2)))
    const { encrypted, iv } = await encrypt('sk-test', TEST_KEY)
    await expect(decrypt(encrypted, iv, wrongKey)).rejects.toThrow()
  })
})
