// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// The portal block in and out of the CAD over cad.like.audio/host@1, through
// the vendored APKSoftapp client (vendor/apk-softapp/). No DOM here. Standalone,
// Save is Save Model: the block and its .ifc twin (portalIfc.js); Open reads either back.

import { portalFromIfc, portalToIfc } from './portalIfc.js';

export const EDITOR = 'Portal Buddy';
export const BLOCK_TYPE = 'portal_link';

export function saveMeta(model) {
  return { blockName: model.portalTag, filename: `portal_${model.portalTag}` };
}

/** One host@1 link for one PortalLinkModel. */
export function connectPortalHost(S, model, { onLoaded, notice } = {}) {
  return S.connectHost({
    editor: EDITOR,
    blockType: BLOCK_TYPE,
    block: model.toBlock(),
    notice,
    onLoad: (block, meta) => {
      model.fromBlock(block);
      if (onLoaded) onLoaded(block, meta);
    },
    onRequest: () => ({ block: model.toBlock(), meta: saveMeta(model) }),
  });
}

/**
 * Save: inside the CAD the block goes back (Save & Return). Standalone it is Save Model: the block
 * (portal_<tag>.json) AND its .ifc twin (js/portalIfc.js), both or neither.
 */
export async function savePortal(S, host, model) {
  const block = model.toBlock();
  const meta = saveMeta(model);
  if (host.embedded || typeof S.saveModel !== 'function') return { ok: true, via: host.save(block, meta) };
  return S.saveModel(block, { name: meta.filename, toIfc: (b) => portalToIfc(b, { name: meta.filename }) });
}

/** Open Model: a portal .ifc (this editor's twin) or a portal block .json, into the model. */
export async function openPortal(S, model, opts = {}) {
  const r = await S.openModel({
    ...opts,
    fromIfc: (text) => portalFromIfc(text),
    fromJson: (data) => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('this is not a portal block: it is not a JSON object');
      return data;
    },
  });
  if (r.ok) model.fromBlock(r.model);
  return r;
}
