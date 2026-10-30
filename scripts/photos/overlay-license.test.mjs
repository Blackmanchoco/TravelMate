import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validatePhotoLicense } from './apply-photo-overlay.mjs';

test('accepts only an exact reusable Commons license and canonical URL', () => {
  assert.equal(validatePhotoLicense('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'), true);
  assert.equal(validatePhotoLicense('CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'), true);
  assert.equal(validatePhotoLicense('CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'), true);
  assert.equal(validatePhotoLicense('All Rights Reserved', 'https://example.com/terms'), false);
  assert.equal(validatePhotoLicense('CC BY 4.0', 'https://example.com/terms'), false);
  assert.equal(validatePhotoLicense('CC BY 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'), false);
});
