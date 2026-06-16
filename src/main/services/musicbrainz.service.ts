import https from 'https'

const USER_AGENT = 'TuneVault/2.0 (nathanialhenniges@users.noreply.github.com)'

interface MbTag {
  name?: string
  count?: number
}

export class MusicBrainzService {
  private getJson(url: string): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const req = https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => (data += chunk.toString()))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            resolve(null)
          }
        })
      })
      req.on('error', () => resolve(null))
      req.setTimeout(5000, () => {
        req.destroy()
        resolve(null)
      })
    })
  }

  async lookupReleaseDate(artist: string, title: string): Promise<string | null> {
    const query = `recording:"${title}" AND artist:"${artist}"`
    const json = await this.getJson(
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=1`
    )
    const recordings = json?.recordings as Array<Record<string, unknown>> | undefined
    const firstRelease = recordings?.[0]?.['first-release-date']
    return typeof firstRelease === 'string' && firstRelease ? firstRelease : null
  }

  /**
   * Best-effort genre from MusicBrainz: search recording -> lookup its genres/tags
   * -> most-voted name, Title Cased. Returns null if MB has no genre (coverage varies).
   * Caller must respect MB rate limits (~1 req/sec) — this makes two requests.
   */
  async lookupGenre(artist: string, title: string): Promise<string | null> {
    const query = `recording:"${title}" AND artist:"${artist}"`
    const search = await this.getJson(
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=1`
    )
    const recordings = search?.recordings as Array<{ id?: string }> | undefined
    const mbid = recordings?.[0]?.id
    if (!mbid) return null

    const rec = await this.getJson(
      `https://musicbrainz.org/ws/2/recording/${mbid}?fmt=json&inc=genres+tags`
    )
    const top = (arr: unknown): string | null => {
      if (!Array.isArray(arr) || !arr.length) return null
      const sorted = (arr as MbTag[]).slice().sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      return sorted[0]?.name ?? null
    }
    const name = top(rec?.genres) || top(rec?.tags)
    return name ? name.replace(/\b\w/g, (c) => c.toUpperCase()) : null
  }
}
