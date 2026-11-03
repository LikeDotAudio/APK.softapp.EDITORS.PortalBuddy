// Part of the APK.audio project — Anthony Kuzub
// MIT Licence.

export class PortalLinkModel {
  constructor(portalTag = 'PORTAL-MAIN-OUT', targetSheet = 'SHEET-02', targetTag = 'PORTAL-AMP-IN') {
    this.portalTag = portalTag;
    this.targetSheet = targetSheet;
    this.targetTag = targetTag;
    this.status = 'Paired'; // Paired | Dangling | Orphaned
    this.signal = 'Dante Audio 64-Ch Multicast';
  }

  setTarget(sheet, tag) {
    this.targetSheet = sheet;
    this.targetTag = tag;
    this.status = (sheet && tag) ? 'Paired' : 'Dangling';
  }
}
