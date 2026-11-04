import test from 'node:test';
import assert from 'node:assert/strict';
import { PortalLinkModel } from '../js/portalModel.js';

test('PortalLinkModel tracks cross-sheet paired and dangling states', () => {
  const p = new PortalLinkModel('P-OUT', 'SHEET-03', 'P-IN');
  assert.equal(p.status, 'Paired');

  p.setTarget('', '');
  assert.equal(p.status, 'Dangling');

  p.setTarget('SHEET-04', 'P-RX');
  assert.equal(p.status, 'Paired');
});

test('PortalLinkModel exports and imports block schemas correctly', () => {
  const p = new PortalLinkModel('P-BUS-1', 'SHEET-10', 'P-BUS-1-RX');
  p.addChannel('Ch 5 Extra', '24-bit / 96kHz');
  
  const block = p.toBlock();
  assert.equal(block.type, 'portal_link');
  assert.equal(block.portalTag, 'P-BUS-1');
  assert.equal(block.channels.length, 5);

  const restored = new PortalLinkModel();
  restored.fromBlock(block);
  assert.equal(restored.portalTag, 'P-BUS-1');
  assert.equal(restored.targetSheet, 'SHEET-10');
  assert.equal(restored.channels.length, 5);
  assert.equal(restored.status, 'Paired');
});
