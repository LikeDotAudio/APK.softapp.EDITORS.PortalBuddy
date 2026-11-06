// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// ROAD-3583: the portal's .ifc twin. Save Model writes the block and IFC4X3_ADD2 (each end an IfcAnnotation
// SYMBOL on its sheet, one IfcDistributionPort per bundled channel, the two ends' channels joined by
// IfcRelConnectsPorts SOURCE -> SINK once paired); Open Model reads it back equal; with APK_IFC_PYTHON=<python
// with ifcopenshell + ifctester> IfcOpenShell and the BIM oracle check it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IFC_GUID_RE, getPsets, parseStep } from '../vendor/apk-contracts/apk-ifc.js';
import { PortalLinkModel } from '../js/portalModel.js';
import { flowsOf, portalFromIfc, portalToIfc } from '../js/portalIfc.js';
import { connectPortalHost, openPortal, savePortal } from '../js/portalHost.js';
import * as vendorIfc from '../scripts/vendor-ifc.mjs';
import { world } from './hostWorld.mjs';

const byType = (text, type) => parseStep(text).entities.filter((e) => e.type === type);

function model(direction = 'Source') {
  const m = new PortalLinkModel();
  m.direction = direction;
  return m;
}

/** The fixtures the census holds to the oracle: paired each way, and a dangling portal. */
export function fixtures() {
  const dangling = new PortalLinkModel('PORTAL-SPARE', '', '');
  return {
    'portal-source.ifc': portalToIfc(model('Source').toBlock()),
    'portal-destination.ifc': portalToIfc(model('Destination').toBlock()),
    'portal-bidirectional.ifc': portalToIfc(model('Bidirectional').toBlock()),
    'portal-dangling.ifc': portalToIfc(dangling.toBlock()),
  };
}

test('the vendored STEP codec is what contracts/src/ifc builds to today', async () => {
  const now = await vendorIfc.buildBundle();
  if (now == null) return; // this repo on its own: the committed bundle is what there is
  assert.equal(fs.readFileSync(vendorIfc.BUNDLE, 'utf8'), now, 'run node scripts/vendor-ifc.mjs');
});

test('each end is an IfcAnnotation SYMBOL on its sheet; each channel a port nested on it', () => {
  const text = portalToIfc(model().toBlock());
  const ends = byType(text, 'IFCANNOTATION');
  assert.deepEqual(ends.map((a) => [a.args[2], a.args[4], a.args[7].value]), [['PORTAL-MAIN-OUT', 'Portal', 'SYMBOL'], ['PORTAL-AMP-IN', 'Portal', 'SYMBOL']]);
  const file = parseStep(text);
  const [src, dst] = file.entities.filter((e) => e.type === 'IFCANNOTATION').map((a) => getPsets(file, a));
  assert.equal(src.APK_SheetSeat.Sheet, 'SHEET-01');
  assert.deepEqual(src.APK_Portal, { Role: 'source', Zone: 'C-4', Shape: 'Chevron Arrow', Direction: 'Source', Signal: 'Dante Audio 64-Ch Multicast' });
  assert.equal(dst.APK_SheetSeat.Sheet, 'SHEET-02');
  assert.deepEqual(dst.APK_Portal, { Role: 'target', Zone: 'A-1' });
  const nests = byType(text, 'IFCRELNESTS');
  assert.deepEqual(nests.map((n) => n.args[5].length), [4, 4]);
  const ports = byType(text, 'IFCDISTRIBUTIONPORT');
  assert.ok(ports.every((p) => p.args[8].value === 'NOTDEFINED' && p.args[9].value === 'SIGNAL'), 'a channel is a signal, not a jack');
});

test('paired channels are joined SOURCE -> SINK the way the portal runs; a dangling portal joins nothing', () => {
  assert.deepEqual(flowsOf('Destination'), { source: 'SINK', target: 'SOURCE' });
  for (const d of ['Source', 'Destination', 'Bidirectional']) {
    const file = parseStep(portalToIfc(model(d).toBlock()));
    const rels = file.entities.filter((e) => e.type === 'IFCRELCONNECTSPORTS');
    assert.equal(rels.length, 4, d);
    for (const r of rels) {
      const a = file.byId.get(r.args[4].id);
      const z = file.byId.get(r.args[5].id);
      assert.ok(['SOURCE', 'SOURCEANDSINK'].includes(a.args[7].value), `${d}: relating ${a.args[7].value}`);
      assert.ok(['SINK', 'SOURCEANDSINK'].includes(z.args[7].value), `${d}: related ${z.args[7].value}`);
      assert.equal(a.args[2], z.args[2], 'one channel to the same channel');
    }
  }
  const dangling = fixtures()['portal-dangling.ifc'];
  assert.equal(byType(dangling, 'IFCRELCONNECTSPORTS').length, 0);
  assert.equal(byType(dangling, 'IFCANNOTATION').length, 2, 'its target zone is still somewhere: the target end with no tag');
});

test('Open Model reads the twin back to the same block; byte-deterministic, valid GlobalIds', () => {
  const none = new PortalLinkModel('P-ONLY', '', '');
  none.targetZone = '';
  none.channels = [];
  for (const m of [model(), model('Destination'), model('Bidirectional'), new PortalLinkModel('P-X', 'SHEET-9', ''), none]) {
    const block = m.toBlock();
    const text = portalToIfc(block);
    assert.deepEqual(portalFromIfc(text), block);
    assert.equal(portalToIfc(block), text);
    const rooted = parseStep(text).entities.filter((e) => /^IFC(PROJECT|REL|PROPERTYSET$|DISTRIBUTIONPORT$|ANNOTATION$)/.test(e.type));
    for (const e of rooted) assert.match(e.args[0], IFC_GUID_RE, e.type);
    assert.equal(new Set(rooted.map((e) => e.args[0])).size, rooted.length, 'no GlobalId twice');
  }
  assert.equal(byType(portalToIfc(none.toBlock()), 'IFCANNOTATION').length, 1);
});

test('standalone Save writes portal_<tag>.json AND its .ifc; Open takes either back', async () => {
  const { S, downloads } = world({ framed: false });
  const m = model('Destination');
  const host = connectPortalHost(S, m, { notice: false });
  const r = await savePortal(S, host, m);
  assert.equal(r.ok, true);
  assert.deepEqual(downloads.map((x) => x.name), ['portal_PORTAL-MAIN-OUT.ifc', 'portal_PORTAL-MAIN-OUT.json']);
  const back = new PortalLinkModel('X', '', '');
  const o = await openPortal(S, back, { file: { name: 'portal_PORTAL-MAIN-OUT.ifc', text: async () => downloads[0].text } });
  assert.equal(o.kind, 'ifc');
  assert.deepEqual(back.toBlock(), m.toBlock());
  const j = new PortalLinkModel('X', '', '');
  await openPortal(S, j, { file: { name: 'portal_PORTAL-MAIN-OUT.json', text: async () => downloads[1].text } });
  assert.deepEqual(j.toBlock(), m.toBlock());
});

test('inside the CAD Save is Save & Return: the block goes to the drawing, no files', async () => {
  const { S, toParent, downloads } = world();
  const m = model();
  const host = connectPortalHost(S, m, { notice: false });
  assert.equal((await savePortal(S, host, m)).via, 'host');
  assert.equal(toParent.at(-1).m.type, 'blockSave');
  assert.equal(downloads.length, 0);
});

// IfcOpenShell (LGPL, test-only, never vendored) when the environment has it: APK_IFC_PYTHON=<python with ifcopenshell + ifctester>
test('IfcOpenShell: 0 schema + EXPRESS statements, every set declared (oracle), every link SOURCE -> SINK', { skip: !process.env.APK_IFC_PYTHON && 'set APK_IFC_PYTHON to a python with ifcopenshell + ifctester' }, () => {
  const dir = fs.mkdtempSync(join(tmpdir(), 'portalbuddy-ifc-'));
  const files = fixtures();
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(join(dir, name), text);
  const script = new URL('../scripts/validate-ifc.py', import.meta.url).pathname;
  const run = spawnSync(process.env.APK_IFC_PYTHON, ['-I', script, ...Object.keys(files).map((n) => join(dir, n))], { cwd: tmpdir(), encoding: 'utf8' });
  const rows = run.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(rows.length, Object.keys(files).length, run.stderr);
  for (const r of rows) {
    assert.equal(r.schema, 'IFC4X3_ADD2', r.file);
    assert.equal(r.statements, 0, `${r.file}: ${r.first.join(' | ')}`);
    assert.deepEqual(r.pset_problems, [], r.file);
    assert.deepEqual(r.connections, [], r.file);
    assert.deepEqual(r.ids_failed, [], `${r.file}: no apk-av.ids specification is claimed of a schematic signal`);
    assert.ok(r.ports.every((p) => p.host === 'IfcAnnotation'), r.file);
  }
  assert.equal(run.status, 0, run.stderr);
});
