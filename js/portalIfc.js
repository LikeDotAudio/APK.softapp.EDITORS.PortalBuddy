// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* portalIfc.js — THE PORTAL'S .IFC TWIN (ROAD-3583). Save Model writes the native portal block (toBlock) AND
   this IFC4X3_ADD2 file through APKSoftapp.saveModel; Open Model reads it back to the same block.

   A portal is a drawing device, not equipment: the off-sheet connector a schematic carries a signal across
   sheets with. So each end is an IfcAnnotation SYMBOL (ObjectType 'Portal'), the way the CAD schematic draws
   its symbols, and nothing physical is claimed:

     IfcProject 'portal' ─ IfcRelDeclares ─ the two portal symbols
       the source   IfcAnnotation SYMBOL Name = the portal tag, Description = its label;
                    APK_SheetSeat.Sheet = the source sheet; APK_Portal Role source, Zone, Shape, Direction, Signal
       the target   IfcAnnotation SYMBOL Name = the target tag, when any of its tag / sheet / zone is set;
                    APK_SheetSeat.Sheet = the target sheet; APK_Portal Role target, Zone
       a channel    one IfcDistributionPort per bundled channel nested on each end (IfcRelNests 'Channels'),
                    Name = the channel name, Description = its format, APK_Terminal.TerminalId = the channel
                    number. A channel is a schematic signal, not a jack: PredefinedType NOTDEFINED and SystemType
                    SIGNAL, so no connector is claimed for it (the signal's words are APK_Portal.Signal).
                    Once paired (a target sheet and tag), the source end's port and the target end's
                    port of a channel are joined by ONE IfcRelConnectsPorts, RelatingPort the SOURCE side:
                    Direction Source: source SOURCE -> target SINK; Destination: target SOURCE -> source SINK;
                    Bidirectional: both SOURCEANDSINK, the source end relating
   Status (Paired | Dangling) is derived from the target and not written. */

import { IfcWriter, enumv, flat, ident, ifcGuid, label, num, readIfc, schemaOf, stemOf, str } from './ifcSpine.js';

export { schemaOf };

const slug = (s) => String(s || 'portal').toLowerCase().replace(/[^a-z0-9]/g, '_');

/** The flow of the source end's and the target end's ports for a portal direction. */
export function flowsOf(direction) {
  const d = str(direction).toLowerCase();
  if (d.startsWith('dest')) return { source: 'SINK', target: 'SOURCE' };
  if (d.startsWith('bi')) return { source: 'SOURCEANDSINK', target: 'SOURCEANDSINK' };
  return { source: 'SOURCE', target: 'SINK' };
}

/** The portal block (PortalLinkModel.toBlock) as IFC4X3_ADD2 STEP text. `name` is the file stem. */
export function portalToIfc(block, { name } = {}) {
  const b = block || {};
  const tag = str(b.portalTag) || 'PORTAL';
  const id = str(b.id) || `portal_${slug(tag)}`;
  const stem = stemOf(name, `portal_${tag}`);
  const W = new IfcWriter({
    projectGid: ifcGuid('portal', id), name: tag, description: 'Portal Buddy: one signal carried from sheet to sheet',
    editor: 'EDITORS.PortalBuddy', appName: 'portal editor',
  });
  const paired = !!(str(b.targetSheet) && str(b.targetTag));
  const flows = flowsOf(b.direction);
  const channels = Array.isArray(b.channels) ? b.channels : [];

  const end = (role, nameText, description, sheet, props) => {
    const gid = W.gid('portal', role);
    const a = W.add('IFCANNOTATION', gid, W.oh, nameText || null, description, 'Portal', null, null, enumv('SYMBOL'));
    if (sheet) W.pset('APK_SheetSeat', gid, [W.prop('Sheet', label(sheet))], [a]);
    W.pset('APK_Portal', gid, [W.prop('Role', label(role)), ...props], [a]);
    const ports = channels.map((c, i) => {
      const n = num(c && c.index) ?? i + 1;
      const pg = W.gid('portal', role, 'channel', String(i));
      const p = W.add('IFCDISTRIBUTIONPORT', pg, W.oh, str(c && c.name) || `Ch ${n}`, c && c.format ? str(c.format) : null, null, null, null,
        enumv(flows[role]), enumv('NOTDEFINED'), enumv('SIGNAL'));
      W.pset('APK_Terminal', pg, [W.prop('TerminalId', ident(String(n)))], [p]);
      return { p, pg };
    });
    W.nest(a, gid, ports.map((x) => x.p), 'Channels');
    return { a, ports };
  };

  const src = end('source', tag, b.label ? str(b.label) : null, str(b.sourceSheet), [
    W.prop('Zone', b.sourceZone ? label(b.sourceZone) : null),
    W.prop('Shape', b.shape ? label(b.shape) : null),
    W.prop('Direction', b.direction ? label(b.direction) : null),
    W.prop('Signal', b.signal ? label(b.signal) : null),
  ]);
  const ends = [src.a];
  if (str(b.targetTag) || str(b.targetSheet) || str(b.targetZone)) {
    const dst = end('target', str(b.targetTag), null, str(b.targetSheet), [W.prop('Zone', b.targetZone ? label(b.targetZone) : null)]);
    ends.push(dst.a);
    if (paired) src.ports.forEach((s, i) => {
      const t = dst.ports[i];
      const [from, to] = flows.source === 'SINK' ? [t, s] : [s, t];
      const c = channels[i] || {};
      W.add('IFCRELCONNECTSPORTS', W.relGid('connects', from.pg, to.pg), W.oh, `${tag} ch ${num(c.index) ?? i + 1}`, null, from.p, to.p, null);
    });
  }
  W.declare(ends);
  return W.finish(stem);
}

/* ───────────────────────── reading it back ───────────────────────── */

/**
 * An IFC model → the portal block: the IfcAnnotation whose APK_Portal.Role is source, and its target;
 * throws a sentence when the file holds no portal.
 */
export function portalFromIfc(text) {
  const R = readIfc(text);
  const portals = R.byType('IFCANNOTATION').filter((a) => R.psets(a).APK_Portal);
  const role = (a) => str(flat(R.psets(a).APK_Portal.Role));
  const src = portals.find((a) => role(a) === 'source');
  if (!src) throw new TypeError('no portal in this IFC: it has no IfcAnnotation with APK_Portal (Role source)');
  const dst = portals.find((a) => role(a) === 'target');
  const sp = R.psets(src);
  const info = sp.APK_Portal;
  const tp = dst ? R.psets(dst) : {};
  const channels = R.portsOn(src).map((p, i) => ({
    index: num(flat(R.psets(p).APK_Terminal?.TerminalId)) ?? i + 1,
    name: str(p.args[2]),
    format: str(p.args[3]),
  }));
  const tag = str(src.args[2]);
  const block = {
    type: 'portal_link',
    id: `portal_${slug(tag)}`,
    portalTag: tag,
    label: str(src.args[3]),
    direction: str(flat(info.Direction)),
    shape: str(flat(info.Shape)),
    sourceSheet: str(flat(sp.APK_SheetSeat?.Sheet)),
    sourceZone: str(flat(info.Zone)),
    targetSheet: dst ? str(flat(tp.APK_SheetSeat?.Sheet)) : '',
    targetTag: dst ? str(dst.args[2]) : '',
    targetZone: dst ? str(flat(tp.APK_Portal?.Zone)) : '',
    status: '',
    signal: str(flat(info.Signal)),
    channels,
  };
  block.status = block.targetSheet && block.targetTag ? 'Paired' : 'Dangling';
  return block;
}
