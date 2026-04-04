import { describe, it, expect } from 'vitest'
import { teeStream } from '@edgerouteai/core/streaming/tee'

describe('teeStream', () => {
  it('returns two readable streams from one source', async () => {
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"chunk":1}\n\n'))
        controller.enqueue(new TextEncoder().encode('data: {"chunk":2}\n\n'))
        controller.close()
      },
    })
    const [s1, s2] = teeStream(source)
    const decoder = new TextDecoder()
    const read = async (stream: ReadableStream<Uint8Array>) => {
      const reader = stream.getReader()
      const chunks: string[] = []
      let result = await reader.read()
      while (!result.done) { chunks.push(decoder.decode(result.value)); result = await reader.read() }
      return chunks.join('')
    }
    const [r1, r2] = await Promise.all([read(s1), read(s2)])
    expect(r1).toContain('{"chunk":1}')
    expect(r1).toBe(r2)
  })
})
