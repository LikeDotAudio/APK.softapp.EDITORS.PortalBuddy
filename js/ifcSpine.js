// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* ifcSpine.js — THE SMALL IFC4X3_ADD2 WRITER THE BUDDY EDITORS SHARE (ROAD-3583: every page that saves a
   model writes its .ifc twin through APKSoftapp.saveModel). The same bytes in EDITORS.AdapterBuddy,
   EDITORS.PortBuddy and EDITORS.PortalBuddy: change them together.

   Written with the contracts STEP codec and the one GlobalId rule (vendor/apk-contracts/apk-ifc.js, made by
   scripts/vendor-ifc.mjs), no IfcOpenShell in the page. Byte-deterministic: a fixed time stamp, every
   GlobalId uuid5 of its roles, so the same block saves to the same file.

     IfcProject (units: mm, and ohm when a page asks)   owner history APK.audio / the editor
     prop / enumProp / listProp                         IfcPropertySingleValue / EnumeratedValue / ListValue
     pset(set, ownerGid, props, owners)                 an IfcPropertySet; with owners, its
                                                        IfcRelDefinesByProperties is written at finish()
     levelUnit('dBu')                                   the dimensionless IfcContextDependentUnit a level
                                                        carries on its property (contracts/ifc/units.json)
   Every set an editor writes is ISO 16739 or an APK_ set declared in DATABASE.server.BIM SRC/tools/ifc
   (apk_psets.py + apk_psets_editors.py). */

import { entitiesByType, enumv, getPsets, ifcGuid, isRef, parseStep, real, ref, typed, unwrap, writeStep } from '../vendor/apk-contracts/apk-ifc.js';

export { entitiesByType, enumv, getPsets, ifcGuid, isRef, parseStep, real, ref, typed, unwrap };

export const IFC_SCHEMA = 'IFC4X3_ADD2';
const STAMP = '1970-01-01T00:00:00';   // fixed: the file is a function of the block, never of the clock

export const str = (v) => (v == null ? '' : String(v));
export const label = (s) => typed('IFCLABEL', String(s));
export const ident = (s) => typed('IFCIDENTIFIER', String(s));
export const int = (n) => typed('IFCINTEGER', Math.trunc(n));
export const bool = (b) => typed('IFCBOOLEAN', enumv(b ? 'T' : 'F'));
export const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v
  : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** A property value as plain JS (typed values unwrapped; getPsets' already plain values pass through). */
export const flat = (v) => {
  if (typeof v === 'boolean') return v;
  const u = unwrap(v);
  return u && typeof u === 'object' && !Array.isArray(u) && 'value' in u ? u.value : u;
};

/** The schema an .ifc text declares (FILE_SCHEMA), '' when none. */
export function schemaOf(text) {
  const m = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i.exec(String(text || ''));
  return m ? m[1] : '';
}

/** The IfcDistributionSystemEnum word a signal reads as (the wirelist's and the panel's rule). */
export function systemTypeOf(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return 'NOTDEFINED';
  if (/earth|ground/.test(t)) return 'EARTHING';
  if (/power|mains|\bac\b|\bdc\b|\bpoe\b/.test(t)) return 'ELECTRICAL';
  if (/network|ethernet|\blan\b|dante|aes67|2110|\bip\b|\bdata\b|cat ?5|cat ?6|fib(er|re)/.test(t)) return 'DATA';
  if (/speaker|loudspeaker|\bpa\b/.test(t)) return 'ELECTROACOUSTIC';
  if (/video|sdi|hdmi|\b(3|6|12)g\b|dvi|displayport|audio|aes|mic|line|analog|madi|adat/.test(t)) return 'AUDIOVISUAL';
  if (/control|rs-?232|rs-?422|rs-?485|gpio|gpi|midi|serial|dmx/.test(t)) return 'CONTROL';
  return 'SIGNAL';
}

/** The transports a network signal names (Pset_DistributionPortTypeCable.Protocols); [] when it names none. */
export function protocolsOf(signal) {
  const t = String(signal || '').toLowerCase();
  const out = [];
  if (/dante/.test(t)) out.push('Dante');
  if (/aes67/.test(t)) out.push('AES67');
  if (/2110/.test(t)) out.push('SMPTE ST 2110');
  if (/\bndi\b/.test(t)) out.push('NDI');
  if (!out.length && /ethernet|\blan\b|cat ?5|cat ?6|network|\bdata\b/.test(t)) out.push('Ethernet');
  return out;
}

/** A file stem from a name: what Save Model calls the .json / .ifc pair. */
export const stemOf = (name, fallback) => String(name || fallback || 'model').replace(/\.(ifc|json)$/i, '');

/**
 * One IFC file being written. `projectGid` is the project's GlobalId (uuid5 of the block's id); every
 * other GlobalId is uuid5 of a role under it. `ohm` adds the ohm to the project units (impedances).
 */
export class IfcWriter {
  constructor({ projectGid, name, description, editor, appName, ohm = false }) {
    this.entities = [];
    this.rels = [];
    this.levels = new Map();
    this.P = projectGid;
    this.editor = editor;
    this.appName = appName;
    const person = this.add('IFCPERSON', null, 'APK.audio', null, null, null, null, null, null);
    const org = this.add('IFCORGANIZATION', null, 'APK.audio', appName, null, null);
    const po = this.add('IFCPERSONANDORGANIZATION', person, org, null);
    const app = this.add('IFCAPPLICATION', org, '1', `APK.audio ${appName}`, editor);
    this.oh = this.add('IFCOWNERHISTORY', po, app, null, null, null, null, null, 0);
    const units = [this.add('IFCSIUNIT', { kind: 'derived' }, enumv('LENGTHUNIT'), enumv('MILLI'), enumv('METRE'))];
    if (ohm) units.push(this.add('IFCSIUNIT', { kind: 'derived' }, enumv('ELECTRICRESISTANCEUNIT'), null, enumv('OHM')));
    const assignment = this.add('IFCUNITASSIGNMENT', units);
    this.origin = this.add('IFCAXIS2PLACEMENT3D', this.add('IFCCARTESIANPOINT', [real(0), real(0), real(0)]), null, null);
    const ctx = this.add('IFCGEOMETRICREPRESENTATIONCONTEXT', null, 'Model', 3, real(1e-5), this.origin, null);
    this.project = this.add('IFCPROJECT', projectGid, this.oh, name, description, null, null, null, [ctx], assignment);
  }

  add(type, ...args) {
    const id = this.entities.length + 1;
    this.entities.push({ id, type, args });
    return ref(id);
  }

  gid(...roles) { return ifcGuid('decl', this.P, ...roles); }
  relGid(...roles) { return ifcGuid('rel', ...roles); }

  prop(n, v, unit = null) { return v == null || v === '' ? null : this.add('IFCPROPERTYSINGLEVALUE', n, null, v, unit); }
  enumProp(n, vs) {
    const list = (Array.isArray(vs) ? vs : [vs]).filter(Boolean);
    return list.length ? this.add('IFCPROPERTYENUMERATEDVALUE', n, null, list.map(label), null) : null;
  }
  listProp(n, vs) { return vs && vs.length ? this.add('IFCPROPERTYLISTVALUE', n, null, vs, null) : null; }

  /** An IfcPropertySet of the props that are there (null when none is); `owners` get it at finish(). */
  pset(setName, ownerGid, props, owners) {
    const list = props.filter(Boolean);
    if (!list.length) return null;
    const ps = this.add('IFCPROPERTYSET', ifcGuid('rel', 'pset', ownerGid, setName), this.oh, setName, null, list);
    if (owners) this.rels.push({ ps, owners, gid: ifcGuid('rel', 'props', ownerGid, setName) });
    return ps;
  }

  /** The dBu / dBV / dBm unit a level property names (one entity per unit, made on first use). */
  levelUnit(name) {
    if (!this.levels.has(name)) {
      this.dimensionless ||= this.add('IFCDIMENSIONALEXPONENTS', 0, 0, 0, 0, 0, 0, 0);
      this.levels.set(name, this.add('IFCCONTEXTDEPENDENTUNIT', this.dimensionless, enumv('USERDEFINED'), name));
    }
    return this.levels.get(name);
  }

  nest(host, hostGid, list, name = null) {
    if (list.length) this.add('IFCRELNESTS', ifcGuid('rel', 'nests', hostGid), this.oh, name, null, host, list);
  }

  declare(objects) {
    if (objects.length) this.add('IFCRELDECLARES', ifcGuid('rel', 'declares', this.P), this.oh, null, null, this.project, objects);
  }

  /** The STEP text, `stem`.ifc in its header. */
  finish(stem) {
    for (const { ps, owners, gid } of this.rels) this.add('IFCRELDEFINESBYPROPERTIES', gid, this.oh, null, null, owners, ps);
    return writeStep({
      header: [
        { type: 'FILE_DESCRIPTION', args: [['ViewDefinition [ReferenceView]'], '2;1'] },
        { type: 'FILE_NAME', args: [`${stem}.ifc`, STAMP, ['APK.audio'], ['APK.audio'], `APK.audio ${this.appName}`, this.editor, ''] },
        { type: 'FILE_SCHEMA', args: [[IFC_SCHEMA]] },
      ],
      entities: this.entities,
    });
  }
}

/** A parsed file and the lookups every reader needs: get(ref), the nests of a host, psets of an entity. */
export function readIfc(text) {
  const file = parseStep(String(text));
  const get = (v) => (isRef(v) ? file.byId.get(v.id) : undefined);
  const nestsOf = new Map();
  for (const r of entitiesByType(file, 'IFCRELNESTS')) {
    const host = get(r.args[4]);
    if (host) nestsOf.set(host.id, [...(nestsOf.get(host.id) || []), ...(r.args[5] || []).map(get).filter(Boolean)]);
  }
  const portsOn = (e) => (nestsOf.get(e.id) || []).filter((x) => x.type === 'IFCDISTRIBUTIONPORT');
  const psets = (e) => getPsets(file, e);
  const connects = entitiesByType(file, 'IFCRELCONNECTSPORTS').map((r) => ({ rel: r, from: get(r.args[4]), to: get(r.args[5]) }));
  return { file, get, portsOn, psets, connects, byType: (t) => entitiesByType(file, t) };
}

/** A list property's values as strings ([] when absent). */
export const strings = (v) => (Array.isArray(flat(v)) ? flat(v).map((x) => str(x)) : v == null ? [] : [str(flat(v))]);
