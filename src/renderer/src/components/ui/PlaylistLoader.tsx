import { SpinningWolf } from './SpinningWolf'
import { Loader } from './Loader'

interface PlaylistLoaderProps {
  wolfMode?: boolean
}

export function PlaylistLoader({ wolfMode }: PlaylistLoaderProps): JSX.Element {
  if (wolfMode) {
    return (
      <div className="flex flex-col items-center gap-5 py-4">
        <SpinningWolf size={80} />
        <span
          className="text-base text-text-secondary"
          style={{ animation: 'textPulse 2s ease-in-out infinite' }}
        >
          Howling at the server...
        </span>
      </div>
    )
  }

  // Same spinning-vinyl loader as the rest of the app, just larger + captioned.
  return <Loader size={88} label="Fetching playlist…" className="py-4" />
}
