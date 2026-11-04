// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

export class PortalLinkModel {
  constructor(portalTag = 'PORTAL-MAIN-OUT', targetSheet = 'SHEET-02', targetTag = 'PORTAL-AMP-IN') {
    this.portalTag = portalTag;
    this.label = 'Cross-Sheet Master Bus';
    this.direction = 'Source'; // Source | Destination | Bidirectional
    this.shape = 'Chevron Arrow'; // Chevron Arrow | Hexagon | Flag
    this.sourceSheet = 'SHEET-01';
    this.sourceZone = 'C-4';
    this.targetSheet = targetSheet;
    this.targetTag = targetTag;
    this.targetZone = 'A-1';
    this.status = (targetSheet && targetTag) ? 'Paired' : 'Dangling';
    this.signal = 'Dante Audio 64-Ch Multicast';
    this.channels = [
      { index: 1, name: 'Main L', format: '24-bit / 48kHz' },
      { index: 2, name: 'Main R', format: '24-bit / 48kHz' },
      { index: 3, name: 'Sub C', format: '24-bit / 48kHz' },
      { index: 4, name: 'Front Fill', format: '24-bit / 48kHz' }
    ];
  }

  setTarget(sheet, tag) {
    this.targetSheet = sheet;
    this.targetTag = tag;
    this.status = (sheet && tag) ? 'Paired' : 'Dangling';
  }

  addChannel(name = 'New Channel', format = '24-bit / 48kHz') {
    const ch = {
      index: this.channels.length + 1,
      name: name,
      format: format
    };
    this.channels.push(ch);
    return ch;
  }

  removeChannel(index) {
    if (index >= 0 && index < this.channels.length) {
      return this.channels.splice(index, 1)[0];
    }
    return null;
  }

  updateChannel(index, field, value) {
    if (this.channels[index]) {
      this.channels[index][field] = value;
    }
  }

  toBlock() {
    return {
      type: 'portal_link',
      id: `portal_${this.portalTag.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      portalTag: this.portalTag,
      label: this.label,
      direction: this.direction,
      shape: this.shape,
      sourceSheet: this.sourceSheet,
      sourceZone: this.sourceZone,
      targetSheet: this.targetSheet,
      targetTag: this.targetTag,
      targetZone: this.targetZone,
      status: this.status,
      signal: this.signal,
      channels: JSON.parse(JSON.stringify(this.channels))
    };
  }

  fromBlock(block = {}) {
    if (block.portalTag) this.portalTag = block.portalTag;
    if (block.label) this.label = block.label;
    if (block.direction) this.direction = block.direction;
    if (block.shape) this.shape = block.shape;
    if (block.sourceSheet) this.sourceSheet = block.sourceSheet;
    if (block.sourceZone) this.sourceZone = block.sourceZone;
    if (block.targetSheet) this.targetSheet = block.targetSheet;
    if (block.targetTag) this.targetTag = block.targetTag;
    if (block.targetZone) this.targetZone = block.targetZone;
    if (block.signal) this.signal = block.signal;
    this.status = (this.targetSheet && this.targetTag) ? 'Paired' : 'Dangling';
    if (Array.isArray(block.channels)) {
      this.channels = JSON.parse(JSON.stringify(block.channels));
    }
  }
}
