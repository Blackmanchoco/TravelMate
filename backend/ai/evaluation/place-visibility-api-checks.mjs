import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Called only by the owned-scratch runner. No account credentials enter evidence.
export async function runPlaceVisibilityChecks({ backend, base, prisma, token, userId, assertEnvironment, onCase }) {
  const require = createRequire(`${backend}/package.json`);
  async function request(path, method = 'GET', body, auth = token) {
    assertEnvironment();
    const response = await fetch(`${base}${path}`, { method, headers: {
      'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
    return { status: response.status, payload: await response.json() };
  }
  async function check(caseId, path, status, predicate = () => true, method = 'GET', body, auth = token) {
    const result = await request(path, method, body, auth);
    const pass = result.status === status && predicate(result.payload);
    onCase({ caseId, status: result.status, expectedStatus: status, pass, responseOrigin: 'direct API' });
    if (!pass) throw Object.assign(new Error(`EVALUATION_STOP_${caseId}_1`), { reason: 'Regression assertion failed' });
    return result.payload.data;
  }
  const place = await prisma.place.findFirst({ where: { name: 'Kuala Lumpur Tower', deletedAt: null } });
  if (!place) throw Error('T1_FIXTURE_TARGET_MISSING');
  const id = place.id;
  await check('active_detail_readable', `/places/${id}`, 200, p => p.data.id === id);
  assertEnvironment();
  const oldFixture = await prisma.place.findUnique({ where: { id: 31 }, select: { id: true, category: true, deletedAt: true } });
  onCase({ caseId: 'legacy_fixture_id_observation', pass: true, observation: true, fixture31Present: !!oldFixture,
    fixture31Active: oldFixture?.deletedAt === null, responseOrigin: 'direct tool' });
  const activeTest = await prisma.place.findFirst({ where: { category: 'Test', deletedAt: null } })
    ?? await prisma.place.create({ data: { destinationId: place.destinationId, name: 'Scratch Active Test Fixture',
      category: 'Test', description: 'Temporary direct-read compatibility fixture', tags: [], travelStyleTags: [], activityTypes: [] } });
  await check('active_test_fixture_direct_readable', `/places/${activeTest.id}`, 200, p => p.data.category === 'Test');
  const itinerary = await check('create_history_itinerary', '/itineraries', 201, () => true, 'POST', {
    title: 'Scratch archive history', destinationId: place.destinationId, startDate: '2026-10-18', endDate: '2026-10-20',
  });
  await check('create_history_item', `/itineraries/${itinerary.id}/items`, 201, () => true, 'POST', { placeId: id, day: 1, timeSlot: 'Morning' });
  await check('save_active_place', '/saved-places', 200, p => p.data.placeId === id, 'POST', { placeId: id });
  await check('ordinary_user_admin_denied', '/admin/places?status=archived', 403);
  assertEnvironment();
  const warm = require('node:child_process').spawnSync(process.env.PYTHON_EXECUTABLE,
    [`${backend}/ai/recommendation/recommendation_runner.py`], { cwd: backend,
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }, windowsHide: true,
      input: JSON.stringify({ userId, destinationId: place.destinationId, limit: 20 }), encoding: 'utf8', timeout: 60000 });
  let warmOk = false;
  try { warmOk = warm.status === 0 && JSON.parse(warm.stdout).ok === true; } catch { /* Output deliberately withheld. */ }
  onCase({ caseId: 'scratch_python_warmup', pass: warmOk, observation: true, responseOrigin: 'direct tool' });
  if (!warmOk) throw Error('SCRATCH_PYTHON_WARMUP_FAILED');
  assertEnvironment();
  await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } });
  const adminToken = require('jsonwebtoken').sign({ sub: userId, role: 'admin' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  await check('scratch_admin_archive', `/admin/places/${id}`, 200, p => p.data.status === 'archived', 'DELETE', undefined, adminToken);
  await check('archived_place_detail_hidden_anonymous', `/places/${id}`, 404, p => !p.data && p.error.code === 'PLACE_NOT_FOUND', 'GET', undefined, null);
  await check('archived_place_detail_hidden_authenticated', `/places/${id}`, 404, p => !p.data);
  await check('archived_place_detail_hidden_even_admin', `/places/${id}`, 404, p => !p.data, 'GET', undefined, adminToken);
  const absent = p => !p.data.items.some(row => row.id === id);
  await check('archived_place_list_hidden', '/places?limit=100', 200, absent, 'GET', undefined, null);
  await check('archived_place_search_hidden', '/places?search=KL%20tower&limit=100', 200, p => p.data.pagination.total === 0);
  await check('archived_destination_place_list_hidden', `/places/destination/${place.destinationId}?limit=100`, 200, absent);
  await check('archived_destination_nested_hidden', `/destinations/${place.destinationId}`, 200, p => !p.data.places.some(row => row.id === id));
  await check('archived_explore_alias_relation_hidden', '/destinations?search=KL%20tower&limit=100', 200, p => p.data.pagination.total === 0);
  await check('archived_nearby_hidden', `/places/nearby?latitude=${place.latitude}&longitude=${place.longitude}&radiusKm=10&limit=100`, 200, p => !p.data.some(row => row.id === id));
  assertEnvironment();
  const categoryFixture = await prisma.place.create({ data: { destinationId: place.destinationId, name: 'Scratch Archive Category Fixture',
    category: 'ScratchArchiveOnly', description: 'Temporary archive-only category', deletedAt: new Date(), tags: [], travelStyleTags: [], activityTypes: [] } });
  await check('archived_only_category_hidden', '/places/categories', 200, p => !p.data.includes('ScratchArchiveOnly'));
  await check('archived_only_category_by_destination_hidden', `/places/categories?destinationId=${place.destinationId}`, 200, p => !p.data.includes('ScratchArchiveOnly'));
  await check('archived_only_category_detail_hidden', `/places/${categoryFixture.id}`, 404);
  await check('recommender_archived_place_hidden', `/recommendations?destinationId=${place.destinationId}&limit=20`, 200,
    p => !p.data.items.some(row => row.placeId === id || row.placeId === categoryFixture.id));
  // Existing authenticated history intentionally retains the archived catalogue reference.
  await check('existing_itinerary_history_retained', `/itineraries/${itinerary.id}`, 200, p => p.data.items.some(row => row.placeId === id && row.place.name === place.name));
  await check('existing_saved_history_retained', '/saved-places?limit=100', 200, p => p.data.items.some(row => row.placeId === id && row.place.name === place.name));
  await check('new_archived_item_rejected', `/itineraries/${itinerary.id}/items`, 404, p => !p.data, 'POST', { placeId: id, day: 2, timeSlot: 'Morning' });
  await check('new_archived_save_rejected', '/saved-places', 404, p => !p.data, 'POST', { placeId: id });
  await check('admin_archive_view_retained', '/admin/places?status=archived&limit=100', 200, p => p.data.items.some(row => row.id === id), 'GET', undefined, adminToken);
  await check('admin_active_view_excludes_archive', '/admin/places?status=active&limit=100', 200, absent, 'GET', undefined, adminToken);
  await check('admin_history_view_retained', '/admin/itineraries?limit=100', 200, p => p.data.items.some(row => row.id === itinerary.id), 'GET', undefined, adminToken);
  await check('admin_catalog_report_available', '/admin/reports/catalog', 200, p => p.success === true, 'GET', undefined, adminToken);
  const { executeSearchPlacesTool } = await import(pathToFileURL(`${backend}/dist/modules/ai/ai.tools.js`).href);
  const { getPublicPlaceNames } = await import(pathToFileURL(`${backend}/dist/modules/places/places.service.js`).href);
  assertEnvironment();
  const namesPass = !(await getPublicPlaceNames()).includes(place.name);
  onCase({ caseId: 'public_name_grounding_hides_archive', pass: namesPass, responseOrigin: 'direct tool' });
  if (!namesPass) throw Object.assign(new Error('EVALUATION_STOP_public_name_grounding_hides_archive_1'), { reason: 'Regression assertion failed' });
  assertEnvironment();
  const search = await executeSearchPlacesTool({ search: 'KL tower', limit: 5 }, 5000);
  const searchPass = search.usage.status === 'success' && JSON.parse(search.content).items.length === 0;
  onCase({ caseId: 'assistant_archived_search_hidden', pass: searchPass, responseOrigin: 'direct tool' });
  if (!searchPass) throw Object.assign(new Error('EVALUATION_STOP_assistant_archived_search_hidden_1'), { reason: 'Regression assertion failed' });
  await check('admin_restore_retains_references', `/admin/places/${id}/restore`, 200, p => p.data.status === 'active', 'POST', {}, adminToken);
  await check('restored_public_detail_readable', `/places/${id}`, 200, p => p.data.id === id);
  await check('restored_public_search_readable', '/places?search=KL%20tower', 200, p => p.data.items.some(row => row.id === id));
}
