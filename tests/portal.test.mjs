import test from 'node:test';
import assert from 'node:assert/strict';
import { PortalLinkModel } from '../js/portalApp.js';

test('PortalLinkModel tracks cross-sheet paired and dangling states', () => {
  const p = new PortalLinkModel('P-OUT', 'SHEET-03', 'P-IN');
  assert.equal(p.status, 'Paired');

  p.setTarget('', '');
  assert.equal(p.status, 'Dangling');

  p.setTarget('SHEET-04', 'P-RX');
  assert.equal(p.status, 'Paired');
});
