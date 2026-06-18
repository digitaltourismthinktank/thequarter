/**
 * The Quarter — real photography (Cathedral Quarter, Canterbury), served from
 * /public/photos and optimised by next/image. Alt text describes the warm,
 * real shot each one is. No generic office stock.
 */
export const PHOTOS = {
  hero: { src: '/photos/photo-3939.jpg', alt: 'The cathedral framed in the café window as people work in natural light' },
  mainSpace: { src: '/photos/main-space.jpg', alt: 'The open workspace — desks, plants and natural light' },
  mainSpaceWide: { src: '/photos/main-space-wide.jpg', alt: 'A wide view across the open workspace, full of greenery' },
  flexi: { src: '/photos/flexi-booths.jpg', alt: 'The slat-lined Flexi booths — the Bell Tower and the Scriptorium' },
  flexiAvailable: { src: '/photos/flexi-available.jpg', alt: 'An available Flexi booth ready for a call or quiet hour' },
  cafe: { src: '/photos/cafe.jpg', alt: 'The Quarter Café — breakfast bar, plants and the cathedral view' },
  catering: { src: '/photos/photo-3942.jpg', alt: 'A catering spread at the Quarter Café' },
  breakfast: { src: '/photos/photo-1949.jpg', alt: 'The daily healthy breakfast — fresh, colourful food' },
  boardroom: { src: '/photos/photo-3937.jpg', alt: 'A hybrid-ready meeting room with plug-and-play A/V and a slat wall' },
  meetingWindow: { src: '/photos/photo-3939.jpg', alt: 'A round meeting table beside the cathedral window' },
} as const;

export type PhotoKey = keyof typeof PHOTOS;
