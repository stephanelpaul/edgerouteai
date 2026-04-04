export function teeStream(source: ReadableStream<Uint8Array>): [ReadableStream<Uint8Array>, ReadableStream<Uint8Array>] {
  const [stream1, stream2] = source.tee()
  return [stream1, stream2]
}
