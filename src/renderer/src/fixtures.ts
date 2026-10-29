import type { Metadata, Track } from "../../shared/types";
import afterHours from "./assets/demo-covers/after-hours.png";
import smallSatellites from "./assets/demo-covers/small-satellites.png";
import blueHours from "./assets/demo-covers/blue-hours.png";
import nightShift from "./assets/demo-covers/night-shift.png";
import coast from "./assets/demo-covers/coast-to-coast.png";
import sunday from "./assets/demo-covers/sunday-tapes.png";

export const demoCovers = [
  afterHours,
  smallSatellites,
  blueHours,
  nightShift,
  "",
  coast,
  sunday,
  "",
];
const rows: [string, string, string, number][] = [
  ["Midnight Arcade", "Northbound FM", "After Hours", 222],
  ["Soft Signal", "Lunar Transit", "Small Satellites", 258],
  ["Afterimage", "The Quiet North", "Blue Hours", 236],
  ["Night Shift · full mix", "Signal / Noise", "Independent mix", 3754],
  ["Stay a Little Longer", "June Static", "Unconfirmed album", 201],
  ["Silver Lines", "Morrow", "Coast to Coast", 247],
  ["First Light", "Park Radio", "Sunday Tapes", 178],
  ["untitled demo 04", "", "", 166],
];
export const demoTracks: Track[] = rows.map(
  ([title, artist, album, seconds], index) => ({
    id: `design-${index}`,
    hash: "",
    path: "",
    originalPath: "",
    metadata: {
      title,
      artist,
      album,
      albumArtist: "",
      trackNumber: "",
      trackTotal: "",
      discNumber: "",
      discTotal: "",
      date: "",
      genre: "",
      composer: "",
      comment: "",
      isrc: "",
      musicbrainzId: "",
    } as Metadata,
    locks: [],
    origins: {},
    revision: 1,
    artwork: demoCovers[index] || null,
    favorite: false,
    missing: false,
    codec: "mp3",
    container: "mp3",
    duration: seconds,
    bitrate: 192000,
    sampleRate: 44100,
    bytes: 0,
    source: null,
    demo: true,
  }),
);
