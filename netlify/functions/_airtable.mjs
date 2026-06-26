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

/** List records. Returns records[] (handles a single page; raise pageSize/iterate if needed). */
export async function listRecords(tableId, { filterByFormula, fields, sort, maxRecords } = {}) {
  const url = new URL(`${API}/${BASE}/${tableId}`);
  // Return record fields keyed by FIELD ID (matches our F.* constants); the API
  // otherwise keys them by field name.
  url.searchParams.set('returnFieldsByFieldId', 'true');
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

export async function createRecord(tableId, fields) {
  return req(`${API}/${BASE}/${tableId}`, { method: 'POST', body: JSON.stringify({ fields }) });
}

export async function updateRecord(tableId, id, fields) {
  return req(`${API}/${BASE}/${tableId}/${id}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
}

export async function deleteRecord(tableId, id) {
  return req(`${API}/${BASE}/${tableId}/${id}`, { method: 'DELETE' });
}

/** Airtable string-escape for filterByFormula literals. */
export function esc(s) {
  return String(s).replace(/'/g, "\\'");
}
