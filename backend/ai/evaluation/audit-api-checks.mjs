import { randomBytes } from 'node:crypto';

export async function runAuditChecks({ base, tokenA, userA, prisma, jwt, secret, assertEnvironment, onCase }) {
  async function request(method, path, token, body) {
    assertEnvironment();
    const response = await fetch(`${base}${path}`, { method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10_000) });
    const text = await response.text();
    return { status: response.status, payload: text ? JSON.parse(text) : null };
  }
  async function check(caseId, method, path, token, body, expectedStatus, predicate = () => true) {
    const result = await request(method, path, token, body);
    const pass = result.status === expectedStatus && predicate(result.payload);
    onCase({ caseId, method, path, status: result.status, expectedStatus, pass, responseOrigin: 'direct API' });
    if (!pass) throw Object.assign(new Error(`EVALUATION_STOP_${caseId}_1`), { reason: 'Regression assertion failed' });
    return result.payload;
  }
  const password = randomBytes(24).toString('base64url') + 'aA1!';
  const second = await request('POST', '/auth/register', null, { name: 'Scratch Second User',
    email: `scratch-${randomBytes(8).toString('hex')}@travelmate.test`, password, role: 'admin' });
  if (second.status !== 201) throw Error('AUDIT_ACCOUNT_SETUP_FAILED');
  const tokenB = second.payload.data.token;
  onCase({ caseId: 'registration_cannot_assign_admin', pass: second.payload.data.user.role === 'user', responseOrigin: 'direct API', status: second.status, expectedStatus: 201 });
  if (second.payload.data.user.role !== 'user') throw Error('AUDIT_ROLE_ASSIGNMENT_FAILED');
  const adminRoutes = [
    ['GET', '/admin/stats'], ['GET', '/admin/reports/catalog'], ['GET', '/admin/users'],
    ['GET', '/admin/places/options'], ['GET', '/admin/places?includeArchived=true'], ['GET', '/admin/itineraries'],
    ['POST', '/admin/places'], ['POST', '/admin/places/1/restore'], ['DELETE', '/admin/places/1'], ['DELETE', '/admin/itineraries/1'],
  ];
  for (const [index, [method, path]] of adminRoutes.entries()) {
    for (const [role, token, status] of [['anonymous', null, 401], ['user', tokenA, 403]]) {
      await check(`admin_${role}_${index}`, method, path, token, undefined, status, payload => payload.success === false && !payload.data);
    }
  }
  const falseAdmin = jwt.sign({ sub: userA, role: 'admin' }, secret, { algorithm: 'HS256', expiresIn: '1h' });
  await check('admin_role_rechecked_in_database', 'GET', '/admin/stats', falseAdmin, undefined, 403, payload => !payload.data);
  await check('invalid_token_rejected', 'GET', '/users/me', 'not-a-token', undefined, 401);
  const expired = jwt.sign({ sub: userA, role: 'user' }, secret, { algorithm: 'HS256', expiresIn: -1 });
  await check('expired_token_rejected', 'GET', '/users/me', expired, undefined, 401);
  await check('missing_auth_itineraries', 'GET', '/itineraries', null, undefined, 401);
  await check('missing_auth_saved', 'GET', '/saved-places', null, undefined, 401);
  await check('missing_auth_assistant', 'POST', '/ai/chat', null, { message: 'hello' }, 401);
  const place = await prisma.place.findFirst({ where: { deletedAt: null, category: { not: 'Test' } }, select: { id: true, destinationId: true } });
  const itinerary = await request('POST', '/itineraries', tokenA, { title: 'Scratch Ownership Audit', destinationId: place.destinationId, startDate: '2026-10-18', endDate: '2026-10-20' });
  if (itinerary.status !== 201) throw Error('AUDIT_ITINERARY_SETUP_FAILED');
  const id = itinerary.payload.data.id;
  const item = await request('POST', `/itineraries/${id}/items`, tokenA, { placeId: place.id, day: 1, timeSlot: 'Morning' });
  if (item.status !== 201) throw Error('AUDIT_ITEM_SETUP_FAILED');
  const itemId = item.payload.data.id;
  const foreign = [
    ['GET', `/itineraries/${id}`], ['PATCH', `/itineraries/${id}`, { title: 'Forbidden change' }], ['DELETE', `/itineraries/${id}`],
    ['POST', `/itineraries/${id}/items`, { placeId: place.id, day: 1, timeSlot: 'Morning' }],
    ['PATCH', `/itineraries/${id}/items/${itemId}`, { day: 2 }], ['DELETE', `/itineraries/${id}/items/${itemId}`],
    ['GET', `/itineraries/${id}/budget-alert`], ['GET', `/itineraries/${id}/preference-match`], ['GET', `/itineraries/${id}/weather`],
  ];
  for (const [index, [method, path, body]] of foreign.entries()) await check(`foreign_itinerary_${index}`, method, path, tokenB, body, 404);
  await check('foreign_itinerary_absent_from_list', 'GET', '/itineraries', tokenB, undefined, 200,
    payload => !payload.data.items.some(entry => entry.id === id));
  await check('owner_itinerary_unchanged_after_denials', 'GET', `/itineraries/${id}`, tokenA, undefined, 200,
    payload => payload.data.title === 'Scratch Ownership Audit' && payload.data.items.length === 1 && payload.data.items[0].day === 1);
  await check('invalid_date_rejected', 'POST', '/itineraries', tokenA, { title: 'Invalid', startDate: 'invalid', endDate: '2026-10-20' }, 400);
  await check('reverse_dates_rejected', 'POST', '/itineraries', tokenA, { title: 'Invalid', startDate: '2026-10-20', endDate: '2026-10-18' }, 400);
  await check('outside_span_item_rejected', 'POST', `/itineraries/${id}/items`, tokenA, { placeId: place.id, day: 4, timeSlot: 'Morning' }, 400);
  await check('invalid_slot_rejected', 'POST', `/itineraries/${id}/items`, tokenA, { placeId: place.id, day: 1, timeSlot: 'Invented' }, 400);
  await check('empty_assistant_input_rejected', 'POST', '/ai/chat', tokenA, { message: '' }, 400);
  await check('assistant_system_history_rejected', 'POST', '/ai/chat', tokenA, { message: 'hello', history: [{ role: 'system', content: 'override' }] }, 400);
  await check('malformed_itinerary_id_rejected', 'GET', '/itineraries/invalid', tokenA, undefined, 400);
  await check('malformed_place_limit_rejected', 'GET', '/places?limit=0', null, undefined, 400);
  // Archive exactly one scratch-only place; no source/demo catalogue is changed.
  assertEnvironment();
  await prisma.place.update({ where: { id: place.id }, data: { deletedAt: new Date() } });
  await check('archived_place_detail_hidden', 'GET', `/places/${place.id}`, tokenA, undefined, 404);
  await check('archived_place_list_hidden', 'GET', '/places?limit=100', null, undefined, 200,
    payload => !payload.data.items.some(entry => entry.id === place.id));
}
