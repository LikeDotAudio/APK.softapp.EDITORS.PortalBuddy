// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// The portal block in and out of the CAD over cad.like.audio/host@1, through
// the vendored APKSoftapp client (vendor/apk-softapp/). No DOM here.

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
