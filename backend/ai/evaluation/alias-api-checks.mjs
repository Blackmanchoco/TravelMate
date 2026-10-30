import { pathToFileURL } from 'node:url';

export async function runAliasChecks({ backend, base, prisma, baselineOnly, assertEnvironment, onCase }) {
  const { executeSearchPlacesTool } = await import(pathToFileURL(`${backend}/dist/modules/ai/ai.tools.js`).href);
  assertEnvironment();
  const stored = await prisma.place.findMany({ where: { deletedAt: null, category: { not: 'Test' }, name: { in: ['Kuala Lumpur Tower', 'KL Tower', 'Menara Kuala Lumpur'] } },
    select: { id: true, name: true, category: true, destinationId: true } });
  if (stored.length !== 1) throw Error('ALIAS_CATALOGUE_TARGET_MISSING_OR_AMBIGUOUS');
  onCase({ caseId: 'catalogue_target', stored, pass: true, responseOrigin: 'direct tool' });
  const queries = ['Kuala Lumpur Tower', 'KL tower', 'Menara Kuala Lumpur', 'KUALA-LUMPUR, TOWER!', 'Unlisted Midnight Observatory qzx'];
  for (const [index, query] of queries.entries()) {
    const outcomes = {};
    for (const endpoint of ['destinations', 'places']) {
      assertEnvironment();
      const response = await fetch(`${base}/${endpoint}?search=${encodeURIComponent(query)}&limit=100`);
      const body = await response.json();
      if (response.status !== 200) throw Error('ALIAS_QUERY_HTTP_ERROR');
      outcomes[endpoint] = { total: body.data.pagination.total, ids: body.data.items.map(item => item.id), names: body.data.items.map(item => item.name) };
    }
    assertEnvironment();
    const execution = await executeSearchPlacesTool({ search: query, limit: 5 }, 5000);
    const data = JSON.parse(execution.content);
    outcomes.assistantSearchPlaces = { status: execution.usage.status, ids: data.items.map(item => item.placeId), names: data.items.map(item => item.name), matchSource: data.searchMatchSource };
    const expected = index === queries.length - 1 ? 0 : 1;
    const pass = outcomes.places.total === expected && outcomes.destinations.total === expected
      && execution.usage.status === 'success' && outcomes.assistantSearchPlaces.ids.length === expected
      && (expected === 0 || outcomes.places.ids[0] === stored[0].id && outcomes.assistantSearchPlaces.ids[0] === stored[0].id && outcomes.destinations.ids[0] === stored[0].destinationId);
    const row = { caseId: `alias_query_${index}`, query, outcomes, ...(baselineOnly ? {} : { pass }), responseOrigin: 'direct tool' };
    onCase(row);
    if (!baselineOnly && !pass) throw Object.assign(new Error(`EVALUATION_STOP_alias_query_${index}_1`), { reason: 'Regression assertion failed' });
  }
  assertEnvironment();
  const restaurant = await executeSearchPlacesTool({ search: 'Kuala Lumpur Tower', category: 'Restaurant', limit: 5 }, 5000);
  const result = JSON.parse(restaurant.content);
  const pass = restaurant.usage.status === 'success' && result.items.length === 0;
  onCase({ caseId: 'alias_restaurant_boundary', pass, resultCount: result.items.length, responseOrigin: 'direct tool' });
  if (!pass) throw Object.assign(new Error('EVALUATION_STOP_alias_restaurant_boundary_1'), { reason: 'Regression assertion failed' });
}
