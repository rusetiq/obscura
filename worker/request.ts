import { HttpError } from './errors'

export async function boundedRequest(request: Request, limit = 2_100_000) {
  if (!request.body) return request
  const reader = request.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      throw new HttpError(413, 'Files must be smaller than 2 MB.')
    }
    chunks.push(new Uint8Array(value))
  }
  return new Request(request, { body: new Blob(chunks) })
}

export async function jsonBody<T>(request: Request): Promise<T> {
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
    return body as T
  } catch {
    throw new HttpError(400, 'Provide a valid JSON request body.')
  }
}
