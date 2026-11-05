// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// ROAD-3487: the portal block round trip over cad.like.audio/host@1, driven
// through the real vendored apk-softapp.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, ORIGIN, PROTOCOL } from './hostWorld.mjs';
import { PortalLinkModel } from '../js/portalModel.js';
import { connectPortalHost, BLOCK_TYPE } from '../js/portalHost.js';

test('in the CAD: editorReady, load fills the model, request saves the edited block to our origin only', () => {
  const { S, toParent, fire } = world();
  const model = new PortalLinkModel();
  let loaded = null;
  connectPortalHost(S, model, { onLoaded: (b, m) => { loaded = m; }, notice: false });
  assert.deepEqual(toParent[0], { m: { protocol: PROTOCOL, type: 'editorReady', editor: 'Portal Buddy', blockType: BLOCK_TYPE }, o: ORIGIN });

  const cad = new PortalLinkModel('P-BUS-1', 'SHEET-10', 'P-BUS-1-RX').toBlock();
  fire({ protocol: PROTOCOL, type: 'load', block: cad, meta: { blockName: 'P-BUS-1' } });
  assert.deepEqual(loaded, { blockName: 'P-BUS-1' });
  assert.equal(model.targetSheet, 'SHEET-10');
  assert.equal(model.status, 'Paired');

  model.setTarget('', '');
  model.addChannel('Ch 5 Extra', '24-bit / 96kHz');
  fire({ protocol: PROTOCOL, type: 'request' });
  const save = toParent.at(-1);
  assert.equal(save.o, ORIGIN);
  assert.equal(save.m.type, 'blockSave');
  assert.deepEqual(save.m.block, model.toBlock());
  assert.equal(save.m.block.status, 'Dangling');
  assert.equal(save.m.block.channels.length, 5);
  assert.ok(toParent.every((x) => x.o === ORIGIN && x.m.protocol === PROTOCOL));
});

test('standalone: Save downloads portal_<tag>.json and nothing is posted', () => {
  const { S, downloads, toParent } = world({ framed: false });
  const model = new PortalLinkModel('P-OUT', 'SHEET-03', 'P-IN');
  const host = connectPortalHost(S, model, { notice: false });
  assert.equal(host.embedded, false);
  assert.equal(host.save(model.toBlock(), { filename: 'portal_P-OUT' }), 'download');
  assert.equal(toParent.length, 0);
  assert.equal(downloads[0].name, 'portal_P-OUT.json');
  const back = new PortalLinkModel();
  back.fromBlock(JSON.parse(downloads[0].text));
  assert.equal(back.targetTag, 'P-IN');
});
