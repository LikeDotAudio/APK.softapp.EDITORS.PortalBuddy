// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { PortalLinkModel } from './portalModel.js';
import { connectPortalHost, saveMeta } from './portalHost.js';

export { PortalLinkModel };

const FIELDS = ['portalTag', 'label', 'direction', 'shape', 'sourceSheet', 'sourceZone', 'targetSheet', 'targetTag', 'targetZone', 'signal'];

export class PortalApp {
  constructor(S) {
    this.S = S;
    this.esc = S.esc;
    this.model = new PortalLinkModel();
    this.svgContainer = document.getElementById('portal-svg');

    this.table = window.APKTable.create(document.getElementById('channels-table'), {
      id: 'portalbuddy-channels',
      columns: [
        { key: 'index', label: 'Ch #', type: 'number', editable: false },
        { key: 'name', label: 'Channel Signal Name' },
        { key: 'format', label: 'Audio/Video Format' },
      ],
      rows: this.model.channels,
      onEdit: (i, key, value) => {
        this.model.updateChannel(i, key, value);
        this.changed();
      },
      onDelete: (i) => {
        this.model.removeChannel(i);
        this.render();
        this.changed();
      },
      empty: 'No bundled channels yet. Add one above.',
    });

    this.host = connectPortalHost(S, this.model, { onLoaded: () => this.render() });
    S.inheritTheme();
    S.describe({
      name: 'Portal Buddy',
      does: 'Links a signal off one schematic sheet onto another: the portal tag, its target sheet / tag / zone, and the channels it bundles.',
      inputs: [
        { name: 'Portal block', from: 'the CAD block this editor was opened on (host@1 load)', kind: 'cad' },
        { name: 'Block file', from: '.json picked with Open Block', kind: 'file' },
      ],
      outputs: [
        { name: 'Portal block', to: 'the CAD drawing on Save & Return, or a .json download standalone', kind: 'cad' },
        { name: 'Live edits', to: 'the CAD after every change (blockChanged)', kind: 'cad' },
        { name: 'Paired / Dangling', to: 'the status badge: Paired once a target sheet and target tag are set', kind: 'screen' },
      ],
      controls: [
        { name: 'Portal fields', how: 'tag, label, direction, shape, source sheet / zone, target sheet / zone / tag, signal' },
        { name: '+ Add Bundled Channel', how: 'adds a channel; edit its name and format in the table, × deletes it' },
        { name: 'Save & Return / ✕', how: 'save into the CAD (or download) / close the editor' },
      ],
      problems: ['bad_json', 'bad_input', 'file_unreadable', 'not_in_cad'],
    });
    this.initControls();
    this.render();
  }

  changed() { this.host.changed(this.model.toBlock(), saveMeta(this.model)); }

  initControls() {
    document.getElementById('btn-save')?.addEventListener('click', () => {
      this.host.save(this.model.toBlock(), saveMeta(this.model));
    });

    document.getElementById('btn-open')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            this.model.fromBlock(JSON.parse(evt.target.result));
            this.render();
            this.changed();
          } catch (err) {
            this.S.showProblem(err.name === 'SyntaxError' ? 'bad_json' : 'bad_input', {
              subject: file.name, detail: err.message,
              fix: ['Open a Portal Buddy block (.json saved by this editor, blockType portal_link).'],
            });
          }
        };
        reader.onerror = () => this.S.showProblem('file_unreadable', { subject: file.name, detail: reader.error && reader.error.message });
        reader.readAsText(file);
      };
      input.click();
    });

    document.getElementById('btn-close')?.addEventListener('click', () => this.host.close());

    const btnAddChannel = document.getElementById('btn-add-ch');
    if (btnAddChannel) {
      btnAddChannel.addEventListener('click', () => {
        this.model.addChannel();
        this.render();
        this.changed();
      });
    }

    FIELDS.forEach(field => {
      const el = document.getElementById(`prop-${field}`);
      if (el) {
        el.addEventListener('input', (e) => {
          this.model[field] = e.target.value;
          this.model.status = (this.model.targetSheet && this.model.targetTag) ? 'Paired' : 'Dangling';
          this.renderBadge();
          this.renderSvg();
          this.changed();
        });
      }
    });
  }

  render() {
    this.renderForm();
    this.table.setRows(this.model.channels);
    this.renderSvg();
  }

  renderForm() {
    FIELDS.forEach(field => {
      const el = document.getElementById(`prop-${field}`);
      if (el && this.model[field] !== undefined) {
        el.value = this.model[field];
      }
    });
    this.renderBadge();
  }

  renderBadge() {
    const statusBadge = document.getElementById('status-badge');
    if (statusBadge) {
      statusBadge.textContent = this.model.status.toUpperCase();
      statusBadge.className = `status-badge ${this.model.status.toLowerCase()}`;
    }
  }

  renderSvg() {
    if (!this.svgContainer) return;

    const width = 640;
    const height = 180;
    const isPaired = this.model.status === 'Paired';
    const statusColor = isPaired ? '#4ADE80' : '#EF4444';

    const e = this.esc;
    const svg = `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#4A9EFF" stop-opacity="0.8"/>
            <stop offset="50%" stop-color="#F4902C" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="${statusColor}" stop-opacity="0.8"/>
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="${width}" height="${height}" fill="#121212" rx="8"/>

        <!-- Source Sheet Box -->
        <rect x="25" y="25" width="220" height="130" rx="6" fill="#18181b" stroke="#2c2c2c" stroke-width="1.5"/>
        <text x="35" y="48" fill="#888888" font-size="11" font-family="sans-serif">Current Sheet: <tspan fill="#f4f4f5" font-weight="bold">${e(this.model.sourceSheet)}</tspan> [Zone ${e(this.model.sourceZone)}]</text>

        <!-- Source Portal Arrow -->
        <polygon points="120,65 210,65 235,95 210,125 120,125 145,95" fill="#121212" stroke="#4A9EFF" stroke-width="2"/>
        <text x="175" y="92" fill="#F4902C" font-size="11" font-weight="bold" font-family="JetBrains Mono, monospace" text-anchor="middle">${e(this.model.portalTag)}</text>
        <text x="175" y="108" fill="#888888" font-size="9" font-family="sans-serif" text-anchor="middle">${e(this.model.direction)}</text>

        <!-- Linking Tunnel / Waveguide Beam -->
        <line x1="240" y1="95" x2="395" y2="95" stroke="url(#beamGrad)" stroke-width="3" stroke-dasharray="6 4"/>
        <circle cx="320" cy="95" r="16" fill="#0f0f11" stroke="${statusColor}" stroke-width="2"/>
        <text x="320" y="99" fill="${statusColor}" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">⚡</text>
        <text x="320" y="125" fill="#888888" font-size="10" font-family="sans-serif" text-anchor="middle">${this.model.channels.length} Ch Bus</text>

        <!-- Destination Target Sheet Box -->
        <rect x="395" y="25" width="220" height="130" rx="6" fill="#18181b" stroke="#2c2c2c" stroke-width="1.5"/>
        <text x="405" y="48" fill="#888888" font-size="11" font-family="sans-serif">Target Sheet: <tspan fill="#f4f4f5" font-weight="bold">${e(this.model.targetSheet || '---')}</tspan> [Zone ${e(this.model.targetZone || '---')}]</text>

        <!-- Target Portal Arrow -->
        <polygon points="410,65 500,65 525,95 500,125 410,125 435,95" fill="#121212" stroke="${statusColor}" stroke-width="2"/>
        <text x="465" y="92" fill="${statusColor}" font-size="11" font-weight="bold" font-family="JetBrains Mono, monospace" text-anchor="middle">${e(this.model.targetTag || 'UNLINKED')}</text>
        <text x="465" y="108" fill="#888888" font-size="9" font-family="sans-serif" text-anchor="middle">${e(this.model.status)}</text>
      </svg>
    `;

    this.svgContainer.innerHTML = svg;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.APKSoftapp || !window.APKTable) {
      document.body.prepend(Object.assign(document.createElement('p'), {
        textContent: 'vendor/apk-softapp or vendor/apk-table did not load: this editor cannot start.',
      }));
      return;
    }
    window.portalApp = new PortalApp(window.APKSoftapp);
  });
}
