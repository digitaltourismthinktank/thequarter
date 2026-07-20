/**
 * The Quarter — Airtable client + base/table/field IDs for the "Ops" base.
 * Base "The Quarter — Ops" (appXJmVtc0qpYkGk6). Token: env AIRTABLE_API_KEY (server-only).
 * Only Netlify Functions touch Airtable; the browser/kiosks never see the token.
 */
const TOKEN = process.env.AIRTABLE_API_KEY;
const API = 'https://api.airtable.com/v0';

export const BASE = 'appXJmVtc0qpYkGk6';

export const T = {
  spaces: 'tblMA8yMgaRwK1jqY',
  bookings: 'tblrqFJaYYl3pzYoN',
  checkins: 'tblW7PzgfJwsLH1N9',
  events: 'tblP5tfMIUOZ7CcHh',
  // Rewards / perks wave (Pass A)
  rewards: 'tblmFVLU2CtYR2Lzn',
  perks: 'tblDgSxgP5RZ0LC4h',
  partners: 'tbl2sSuHJ5NQelTpI',
  pointsLedger: 'tblZtub7XlSonzK4p',
  redemptions: 'tblmX1UzLoms8smxe',
  tokens: 'tbliuDUKJnGs9Hcgo',
  scanLog: 'tblgAY1I86JhnxCQV',
  referrals: 'tblnFOW4GKzKmXKNw',
  guests: 'tblwCIQBuC1CuRztd',
  // User-created table; addressed by NAME (the API accepts a table name or id) and read with
  // { byName:true } since we don't hold its field IDs. Fields: Event (link → Events),
  // 'Member email', Name, Status (single-select Going|Cancelled).
  rsvps: 'Event RSVPs',
};

export const F = {
  spaces: {
    name: 'fldhLXpRUTke26Fgq',
    type: 'flddQEvQuPM6oYNdp',
    capacity: 'fldcPWJJz3I6kvg4V',
    capacityLabel: 'fldMrFTQGDKUY3KhG',
    bookable: 'fld2086GXG7YFIuw3',
    colour: 'fldumdbVkxCY9zfI9',
    order: 'fldBTqfOsy0JW27ph',
  },
  bookings: {
    title: 'fldRmaSQnhiZpe5IP',
    start: 'fldw5HR8piuaZ2E7f',
    end: 'fldqhPI1a6UjJ027T',
    kind: 'fldbRxmKpKj4i2sEu',
    email: 'fld4Wi4vxprBMOzI2',
    name: 'fld8g9MttvXc85lHx',
    status: 'fldCorhYKyGQXjNMQ',
    source: 'fld65O1G35zuroeqr',
    notes: 'fld16rAImRC4Lzvo6',
    space: 'fld0GMbz9mCaGGGPY',
    date: 'fldA013Yzj8tUIolk',
    company: 'fldEtQLTNXieUev5B',
    holdUntil: 'fldrfwRQedgOCMr0w',
    checkedIn: 'flduC1nIUz1SyaxOz',
    releasable: 'fldpaTy1L33woon5G',
    recurring: 'fldDaYzJe0rBdHcGA',
  },
  checkins: {
    ref: 'fldT6Vluubvd6BpQr',
    email: 'fldX079sE6kFjsGU4',
    name: 'fldVs87NgFUKylmjw',
    date: 'fldgApUhAZpXb9Mll',
    length: 'fldJh8gANwoY4t8Ih',
    dayCost: 'fld46oiCn3goowhjk',
    status: 'fldV7uUbNOFdQMxpH',
    source: 'fld9gOm46QD0x1LaW',
    notes: 'fld2E75Aho57pfUPq',
  },
  events: {
    title: 'fldr7mACJVZerZOIt',
    start: 'fldGlQUHppIQW9pd3',
    end: 'fldr6wX4Ivnzpksmd',
    location: 'fldQojJTlG97C95u9',
    description: 'fldRJlKuxdOxPhhEv',
    category: 'fldUOPMNtBsDhJjza',
    published: 'fldjzX67LPMCPzyvi',
  },
  rewards: {
    title: 'fldyn7kFrVCCdgZOJ',
    partner: 'fldoeITJNoekdPexg',
    cost: 'fldAoH6bJigOEsu0A',
    funding: 'fldP1PvHKKfSPXU6C',
    category: 'fldOBdCSWfipLZahn',
    icon: 'fld2nJnxsaA17TIAZ',
    pos: 'fldqNPfPL00SEhCfX',
    hero: 'fldc2DvyxFs5VAcPv',
    status: 'fldwEhrSrzkFfzntI',
    image: 'fldcencwJ9F6Tgd7X',
    order: 'fld8XT7DrUNylFwiS',
  },
  perks: {
    partner: 'fldemC1mCv1FsV0K5',
    offer: 'fldpBOrD6WXJOzkkS',
    browseCategory: 'fldiQ6XkvzduywJr7',
    perkType: 'fldAtX2I7KxHFwqoz',
    days: 'fldMvNNCQhOlkYXUs',
    pos: 'fld9qfXaSVxeQ7kPw',
    authorisedBy: 'fldcn7wUlFFOnpagw',
    ref: 'fld1Df1VGRzfuRyCl',
    contact: 'fldqx1EnEhxcpsuqt',
    icon: 'fldWuvt06aCK9x2lH',
    image: 'fldmQ0RdYxLKSTFdd',
    status: 'fldFoy1B14J8V89oD',
    order: 'fldCoF5FqyC1HYMQo',
  },
  partners: {
    partner: 'fldAiAmBsJzMqKjx9',
    reward: 'flduXLUB4xyDV3J8z',
    balance: 'fld7uZYarThzBLYZZ',
    floatTotal: 'fld3eENzUG3t11r0W',
    usesThisMonth: 'fldJ0ojSSMaURGlUt',
    lastUsed: 'fldmCXZsy2RrtWblJ',
    status: 'fldJ6zD9oxqxLeLhc',
    // Enrolment contact + payee bank details. Referenced BY NAME (the user added these
    // columns) and written with typecast:true. SENSITIVE — server-only, never rendered
    // to members or logged.
    contactName: 'Contact name',
    contactEmail: 'Contact email',
    phone: 'Phone',
    payeeName: 'Payee name',
    sortCode: 'Sort code',
    accountNumber: 'Account number',
  },
  pointsLedger: {
    entry: 'fldBl1PRScPdJbHVn',
    email: 'fldDnAK3mU6q8Uy5U',
    delta: 'fldjnGV5QnvWBVPwG',
    reason: 'fldB5tobDYYZj3E28',
    ref: 'fldnE1cFqEFk3nr7L',
    at: 'fldpmyZMO0RipuX4J',
  },
  redemptions: {
    entry: 'flduagMYjzDQTS9fd',
    email: 'fldACsApWSCl1XtlZ',
    reward: 'fldhSRspzREkcmx9w',
    rewardId: 'fldS2GWaj4VIEI6vv',
    partner: 'fldUCQdja2hYmd6Wl',
    cost: 'fld4XSJHBHRvmLOV4',
    status: 'fldAvZNrlKFIr2LiF',
    at: 'fldpC0nnhZP7b2Esp',
  },
  tokens: {
    token: 'fldb4o6P7DVfPRRms',
    email: 'fld6JMV8xVGBDRDyB',
    partner: 'fldXbfSfN5BJAOM1V',
    perkId: 'fldrixKv34cyjMiKK',
    kind: 'fldzwVifYQogsZGu8',
    issuedAt: 'fldNFpxjPIdy9OFOk',
    expiresAt: 'fldL3ebTtELc4U87d',
    usedAt: 'fldnktIJTxA7dmXX3',
  },
  scanLog: {
    entry: 'fldVD6XdCpTplQGJr',
    token: 'flds5noYA3Z4x93C4',
    email: 'fld1u7ceTtWgdSg71',
    partner: 'fldJrLmlrpp63Oj8d',
    perkId: 'fldy5EtMxvcAlrwE6',
    result: 'fldYxPUz98JUFfZZo',
    at: 'fldKWZasG8TVCQ1XP',
  },
  referrals: {
    entry: 'fldIyR8sOeYUe25ly',
    referrerId: 'fldSfVBnxX53UQJfo',
    friendEmail: 'fldssXXeG8VHA7Iep',
    friendName: 'fld3TFFOKHaTrQ8ql',
    status: 'fldmduPn7aORgCf56',
    at: 'fld6hhxRhOpRya0jH',
  },
  guests: {
    name: 'fldsvtgQedqFYi0j9',
    company: 'fld6ScuDO5hYjFooQ',
    host: 'fldOkx8ohkEi7Yg7e',
    hostId: 'fldX0chagINvHoguD',
    reason: 'fldL0CLCgpFOJMtp4',
    arrivedAt: 'flddfiStSGap1oxYT',
    signedOutAt: 'fldhScgCM5HCEE9L4',
  },
};

export function airtableReady() {
  return !!TOKEN;
}

async function req(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(opts.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`airtable ${res.status} ${JSON.stringify(json?.error || json)}`);
  return json;
}

/** List records. Returns records[] (handles a single page; raise pageSize/iterate if needed).
 *  Pass { byName: true } for tables we don't hold field IDs for (e.g. the user-created Event
 *  RSVPs table) — record.fields is then keyed by FIELD NAME instead of field ID. */
export async function listRecords(tableId, { filterByFormula, fields, sort, maxRecords, byName } = {}) {
  const url = new URL(`${API}/${BASE}/${tableId}`);
  // Return record fields keyed by FIELD ID (matches our F.* constants) by default; the API
  // otherwise keys them by field name.
  if (!byName) url.searchParams.set('returnFieldsByFieldId', 'true');
  if (filterByFormula) url.searchParams.set('filterByFormula', filterByFormula);
  if (maxRecords) url.searchParams.set('maxRecords', String(maxRecords));
  (fields || []).forEach((f) => url.searchParams.append('fields[]', f));
  (sort || []).forEach((s, i) => {
    url.searchParams.append(`sort[${i}][field]`, s.field);
    url.searchParams.append(`sort[${i}][direction]`, s.direction || 'asc');
  });
  const json = await req(url.toString());
  return json.records || [];
}

/**
 * Every matching record, following Airtable's pagination.
 *
 * listRecords above deliberately does not: it asks once and returns whatever came back.
 * Airtable caps a page at 100 records and hands you an `offset` to continue with, so any
 * query matching more than 100 rows quietly returns the first 100 and no error. That is
 * fine for the small, bounded queries it was written for (one day's bookings, the spaces
 * list) and dangerous for anything unbounded — an audience of "everyone who bought a day
 * pass in the last year" would silently leave people out of a mailing.
 *
 * Use this whenever the result set has no natural ceiling. The page cap is a backstop
 * against a runaway query, not a limit anyone should hit.
 */
export async function listAllRecords(tableId, opts = {}, maxPages = 25) {
  const out = [];
  let offset;
  for (let i = 0; i < maxPages; i += 1) {
    const url = new URL(`${API}/${BASE}/${tableId}`);
    if (!opts.byName) url.searchParams.set('returnFieldsByFieldId', 'true');
    if (opts.filterByFormula) url.searchParams.set('filterByFormula', opts.filterByFormula);
    (opts.fields || []).forEach((f) => url.searchParams.append('fields[]', f));
    (opts.sort || []).forEach((sr, si) => {
      url.searchParams.append(`sort[${si}][field]`, sr.field);
      url.searchParams.append(`sort[${si}][direction]`, sr.direction || 'asc');
    });
    if (offset) url.searchParams.set('offset', offset);
    const json = await req(url.toString());
    out.push(...(json.records || []));
    offset = json.offset;
    if (!offset) return out;
  }
  console.warn('[airtable] listAllRecords hit the page cap on', tableId, '— result may be truncated');
  return out;
}

export async function createRecord(tableId, fields, opts = {}) {
  const body = opts.typecast ? { fields, typecast: true } : { fields };
  return req(`${API}/${BASE}/${tableId}`, { method: 'POST', body: JSON.stringify(body) });
}

export async function updateRecord(tableId, id, fields, opts = {}) {
  const body = opts.typecast ? { fields, typecast: true } : { fields };
  return req(`${API}/${BASE}/${tableId}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteRecord(tableId, id) {
  return req(`${API}/${BASE}/${tableId}/${id}`, { method: 'DELETE' });
}

/** Airtable string-escape for filterByFormula literals. */
export function esc(s) {
  return String(s).replace(/'/g, "\\'");
}
