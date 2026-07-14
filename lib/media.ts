/**
 * The Quarter — real photography (Cathedral Quarter, Canterbury), served from
 * /public/photos. Alt text describes the warm, real shot each one is. No generic
 * office stock. Assigned per the round-4 photo set (labelled by room/subject).
 */
export const PHOTOS = {
  hero: { src: '/photos/hero-chapter-house.jpg', alt: 'A meeting in The Chapter House, Canterbury Cathedral’s rooftops in the window' },
  mainSpace: { src: '/photos/open-workspace.jpg', alt: 'The open workspace — a member working amid plants and natural light at Dane John Gardens' },
  mainSpaceWide: { src: '/photos/knights-tale-wide.jpg', alt: 'A bright, plant-filled room at The Quarter with sunlight pouring in' },
  flexi: { src: '/photos/phone-pods.jpg', alt: 'The phone pods — the Bell Tower and the Scriptorium, in slat-lined oak' },
  flexiAvailable: { src: '/photos/phone-pod.jpg', alt: 'Inside a phone pod, ready for a call or a quiet hour' },
  cafe: { src: '/photos/cafe.jpg', alt: 'The Quarter Café — cakes and treats by the window, herbs and the cathedral beyond' },
  catering: { src: '/photos/sandwich-bar.jpg', alt: 'Fresh baguettes and salad from The Sandwich Bar, laid out for a meeting' },
  breakfast: { src: '/photos/pastries-cathedral.jpg', alt: 'Complimentary pastries with Canterbury Cathedral framed in the café window' },
  boardroom: { src: '/photos/knights-tale.jpg', alt: 'The Knight’s Tale — a sunlit boardroom with plug-and-play A/V and a slat wall' },
  meetingWindow: { src: '/photos/chapter-house.jpg', alt: 'The Chapter House round table beside the cathedral window' },
  // Round-4 additions
  urbanFarm: { src: '/photos/urban-farm.jpg', alt: 'The Auk Urban Farm — herbs growing on the café windowsill, cathedral rooftops beyond' },
  coffeeMachine: { src: '/photos/coffee-machine.jpg', alt: 'The bean-to-cup coffee machine, syrups and cold drinks in the Quarter Café' },
  pastries: { src: '/photos/pastries.jpg', alt: 'Freshly baked croissants and pains au chocolat' },
  marmaduke: { src: '/photos/marmaduke.jpg', alt: 'Marmaduke the pug — The Quarter’s Chief Happiness Officer — at a desk' },
  cathedralView: { src: '/photos/cathedral-view.jpg', alt: 'Canterbury Cathedral’s Bell Harry tower over the rooftops of the Cathedral Quarter' },
  hopYard: { src: '/photos/hop-yard.jpg', alt: 'The Hop Yard — a bright team room with rows of monitor-equipped desks' },
  vineyard: { src: '/photos/vineyard.jpg', alt: 'The Vineyard — a sunlit team room, desks at the window' },
} as const;

export type PhotoKey = keyof typeof PHOTOS;
