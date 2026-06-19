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

  /** Back-compat: genre only. */
  async lookupGenre(artist: string, title: string): Promise<string | null> {
    return (await this.lookupMetadata(artist, title)).genre
  }

  /**
   * Best-effort metadata from MusicBrainz for a track: genre (most-voted
   * genre/tag, Title Cased) plus a Cover Art Archive front-image URL. Searches by
   * artist+title; when the artist is missing/"Unknown Artist", or the scoped
   * search finds nothing, falls back to a title-only search so name-only files
   * (e.g. "Goin' on (feat. Snakewolf) - Toasty") can still match.
   * Two MB requests max; caller must respect MB rate limits (~1 req/sec).
   */
  async lookupMetadata(
    artist: string,
    title: string
  ): Promise<{ genre: string | null; coverUrl: string | null; mbArtist: string | null }> {
    const usable = artist && artist.trim() && artist.trim().toLowerCase() !== 'unknown artist'
    const searchUrl = (q: string): string =>
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(q)}&fmt=json&limit=1`

    let search = await this.getJson(
      searchUrl(usable ? `recording:"${title}" AND artist:"${artist}"` : `recording:"${title}"`)
    )
    let recordings = search?.recordings as Array<Record<string, unknown>> | undefined
    if ((!recordings || !recordings.length) && usable) {
      // Scoped search came up empty — retry by title only.
      search = await this.getJson(searchUrl(`recording:"${title}"`))
      recordings = search?.recordings as Array<Record<string, unknown>> | undefined
    }
    const rec0 = recordings?.[0]
    const mbid = rec0?.id as string | undefined
    if (!mbid) return { genre: null, coverUrl: null, mbArtist: null }

    // Cover art comes from a release the recording appears on (Cover Art Archive).
    const releases = rec0?.releases as Array<{ id?: string }> | undefined
    const releaseId = releases?.[0]?.id
    const coverUrl = releaseId ? `https://coverartarchive.org/release/${releaseId}/front-500` : null

    // Corrected artist (for name-only files where artist was unknown).
    const credit = rec0?.['artist-credit'] as Array<{ name?: string }> | undefined
    const mbArtist = credit?.map((c) => c.name).filter(Boolean).join(', ') || null

    const rec = await this.getJson(
      `https://musicbrainz.org/ws/2/recording/${mbid}?fmt=json&inc=genres+tags`
    )
    const top = (arr: unknown): string | null => {
      if (!Array.isArray(arr) || !arr.length) return null
      const sorted = (arr as MbTag[]).slice().sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      return sorted[0]?.name ?? null
    }
    const name = top(rec?.genres) || top(rec?.tags)
    const genre = name ? name.replace(/\b\w/g, (c) => c.toUpperCase()) : null
    return { genre, coverUrl, mbArtist }
  }
}
