/**
 * Quarter Characters — the pilgrims of The Canterbury Tales, as member avatars.
 *
 * The meeting rooms are already named for the Tales (The Knight's Tale, The Chapter
 * House), so this extends a device the brand already uses rather than bolting on a
 * generic avatar set — and it is unmistakably Canterbury in a way a stock illustration
 * pack could never be.
 *
 * A member picks a CHARACTER, not a likeness. That is the point: there is no skin-tone or
 * body-type picker to get wrong, because nobody is depicting themselves. Faces are drawn
 * in one deliberately non-naturalistic parchment tone for exactly that reason — these are
 * costumes, and the headwear and props are what tell them apart.
 *
 * Chaucer's Summoner, Pardoner and Reeve are left out: they are a corrupt church officer,
 * a seller of fake relics and a miser, which reads badly as something you'd choose to be.
 */

export interface QuarterCharacter {
  id: string;
  /** Shown under the character in the picker. */
  name: string;
  /** One line of who they are — keeps the picker interesting to scroll. */
  blurb: string;
  /** Circle behind the figure. */
  bg: string;
  /** Robe / tunic. */
  robe: string;
  /** Hat, hood, helm — the silhouette that identifies them at 28px. */
  accent: string;
}

/** Faces are one stylised tone throughout — see the note above. */
export const SKIN = '#e8d3b4';
export const LINE = '#2b241b';

export const CHARACTERS: QuarterCharacter[] = [
  { id: 'knight', name: 'The Knight', blurb: 'Truth, honour and good manners', bg: '#e7ecf2', robe: '#5b6b80', accent: '#8fa2b8' },
  { id: 'squire', name: 'The Squire', blurb: 'Sings, jousts and never sleeps', bg: '#fdeef0', robe: '#c2566b', accent: '#e8a0ae' },
  { id: 'yeoman', name: 'The Yeoman', blurb: 'Green coat, sharp arrows', bg: '#e8f1e6', robe: '#4f7a4a', accent: '#7da877' },
  { id: 'prioress', name: 'The Prioress', blurb: 'Impeccable manners, soft heart', bg: '#f2eefa', robe: '#5c4f7d', accent: '#f6f3fb' },
  { id: 'second-nun', name: 'The Second Nun', blurb: 'Quiet, and quietly formidable', bg: '#eef0f7', robe: '#41476b', accent: '#eceef6' },
  { id: 'monk', name: 'The Monk', blurb: 'Prefers hunting to the cloister', bg: '#efe9e1', robe: '#4a4038', accent: '#6d6055' },
  { id: 'friar', name: 'The Friar', blurb: 'Knows every innkeeper in Kent', bg: '#f6efe2', robe: '#8a6a3a', accent: '#b08e58' },
  { id: 'merchant', name: 'The Merchant', blurb: 'Talks profit, forked beard', bg: '#eaf0ef', robe: '#2f5d57', accent: '#59857e' },
  { id: 'clerk', name: 'The Clerk', blurb: 'Would rather have books than money', bg: '#eceef3', robe: '#3c4457', accent: '#7b8598' },
  { id: 'lawyer', name: 'The Man of Law', blurb: 'Busier than he actually is', bg: '#dfe4ee', robe: '#3f4a5e', accent: '#f7f5ef' },
  { id: 'franklin', name: 'The Franklin', blurb: 'His table is never empty', bg: '#fdf0e4', robe: '#b4632c', accent: '#e0e0dc' },
  { id: 'cook', name: 'The Cook', blurb: 'Famous for his pies', bg: '#f2ddb0', robe: '#c9922f', accent: '#fffdf7' },
  { id: 'shipman', name: 'The Shipman', blurb: 'Sailed further than he admits', bg: '#e5eff3', robe: '#2b5a70', accent: '#5d8fa4' },
  { id: 'physician', name: 'The Physician', blurb: 'Consults the stars first', bg: '#f6eaf0', robe: '#7d3a5c', accent: '#b06f90' },
  { id: 'wife-of-bath', name: 'The Wife of Bath', blurb: 'Five husbands, no regrets', bg: '#fdeae6', robe: '#b83f36', accent: '#e9736a' },
  { id: 'parson', name: 'The Parson', blurb: 'Poor in purse, rich in kindness', bg: '#eef1ee', robe: '#4b5b50', accent: '#7d9184' },
  { id: 'plowman', name: 'The Plowman', blurb: 'Up before everyone', bg: '#f4f0e0', robe: '#7d7442', accent: '#d9c98a' },
  { id: 'miller', name: 'The Miller', blurb: 'Loud, red-bearded, plays the pipes', bg: '#fbeee2', robe: '#9c5b2c', accent: '#c8703a' },
  { id: 'manciple', name: 'The Manciple', blurb: 'Outwits scholars at the market', bg: '#eef1f4', robe: '#4a5560', accent: '#8c99a6' },
  { id: 'host', name: 'The Host', blurb: 'Started the whole thing', bg: '#f9ecda', robe: '#8e5a24', accent: '#d99a4e' },
];

export const characterById = (id?: string | null): QuarterCharacter | null =>
  (id ? CHARACTERS.find((c) => c.id === id) ?? null : null);
