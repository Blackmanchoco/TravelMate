import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
let vite, Placeholder, LocalPhoto;
before(async () => {
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  Placeholder = (await vite.ssrLoadModule('/src/components/common/PhotoPlaceholder.tsx')).default;
  LocalPhoto = (await vite.ssrLoadModule('/src/components/common/LocalPhoto.tsx')).default;
});
after(async () => { await vite?.close(); });
test('every stored category has a distinct placeholder colour and an accessible non-photo label', () => {
  const categories = ['Accommodation','Restaurant','Attraction','Culture','Historical','Nature','Shopping'];
  const backgrounds = categories.map(category => {
    const html = renderToStaticMarkup(createElement(Placeholder,{name:'Catalogue Place',category}));
    assert.match(html, /role="img"/);
    assert.match(html, /aria-label="[^"]*placeholder/);
    assert.ok(html.includes(category));
    assert.doesNotMatch(html, /<img\b/);
    const colour=html.match(/background-color:([^;"\s]+)/)?.[1];
    assert.ok(colour, `Missing category colour for ${category}`);
    return colour;
  });
  assert.equal(new Set(backgrounds).size,7);
});
test('unknown categories still render an accessible placeholder', () => {
  const html=renderToStaticMarkup(createElement(Placeholder,{name:'Catalogue Place',category:'Unknown'}));
  assert.match(html,/role="img"/); assert.doesNotMatch(html,/<img\b/);
});
for (const src of [null,'https://unapproved.example/photo.jpg','//unapproved.example/photo.jpg','/images/places/uncredited.jpg']) {
  test(`an unapproved source renders a category placeholder: ${src ?? 'missing'}`, () => {
    const html=renderToStaticMarkup(createElement(LocalPhoto,{src,alt:'Catalogue Place',category:'Restaurant'}));
    assert.doesNotMatch(html,/<img\b/);
    assert.match(html,/Restaurant/);
  });
}
