// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { PortalLinkModel } from './portalModel.js';
import { BlockBridge } from './blockBridge.js';

export { PortalLinkModel };

export class PortalApp {
  constructor() {
    this.model = new PortalLinkModel();
    this.bridge = new BlockBridge({
      name: 'Portal Buddy',
      type: 'portal_link',
      onBlockLoaded: (b, m) => this.handleBlockLoaded(b, m),
      onBlockChanged: () => this.render()
    });

    this.tableBody = document.getElementById('channels-table-body');
    this.svgContainer = document.getElementById('portal-svg');
    this.initControls();
    this.render();
    this.autoConnect();
  }

  async autoConnect() {
    const discovered = await this.bridge.fetchDiscoveredProject();
    if (discovered && discovered.portals && discovered.portals.length > 0) {
      this.model.fromBlock(discovered.portals[0]);
      this.render();
    }
  }

  handleBlockLoaded(block, meta) {
    if (block) {
      this.model.fromBlock(block);
      this.render();
    }
  }

  initControls() {
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        this.bridge.saveBlock(this.model.toBlock(), { name: this.model.portalTag });
      });
    }

    const btnOpen = document.getElementById('btn-open');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              const data = JSON.parse(evt.target.result);
              this.model.fromBlock(data);
              this.render();
            } catch (err) {
              alert('Invalid block file: ' + err.message);
            }
          };
          reader.readAsText(file);
        };
        input.click();
      });
    }

    const btnClose = document.getElementById('btn-close');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.bridge.close());
    }

    const btnDiscovered = document.getElementById('btn-discovered');
    if (btnDiscovered) {
      btnDiscovered.addEventListener('click', async () => {
        const disc = await this.bridge.fetchDiscoveredProject();
        if (disc && disc.portals && disc.portals.length > 0) {
          this.model.fromBlock(disc.portals[0]);
          this.render();
        } else {
          alert('No portal blocks found in current discovered project.');
        }
      });
    }

    const btnAddChannel = document.getElementById('btn-add-ch');
    if (btnAddChannel) {
      btnAddChannel.addEventListener('click', () => {
        this.model.addChannel();
        this.render();
        this.bridge.notifyChanged();
      });
    }

    ['portalTag', 'label', 'direction', 'shape', 'sourceSheet', 'sourceZone', 'targetSheet', 'targetTag', 'targetZone', 'signal'].forEach(field => {
      const el = document.getElementById(`prop-${field}`);
      if (el) {
        el.addEventListener('input', (e) => {
          this.model[field] = e.target.value;
          this.model.status = (this.model.targetSheet && this.model.targetTag) ? 'Paired' : 'Dangling';
          this.renderSvg();
          this.bridge.notifyChanged();
        });
      }
    });
  }

  render() {
    this.renderForm();
    this.renderTable();
    this.renderSvg();
  }

  renderForm() {
    ['portalTag', 'label', 'direction', 'shape', 'sourceSheet', 'sourceZone', 'targetSheet', 'targetTag', 'targetZone', 'signal'].forEach(field => {
      const el = document.getElementById(`prop-${field}`);
      if (el && this.model[field] !== undefined) {
        el.value = this.model[field];
      }
    });

    const statusBadge = document.getElementById('status-badge');
    if (statusBadge) {
      statusBadge.textContent = this.model.status.toUpperCase();
      statusBadge.className = `status-badge ${this.model.status.toLowerCase()}`;
    }
  }

  renderTable() {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';

    this.model.channels.forEach((ch, idx) => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td style="color: var(--text-muted); font-size: 11px;">#${ch.index || idx + 1}</td>
        <td class="inline-cell" contenteditable="true" data-idx="${idx}" data-field="name">${ch.name || ''}</td>
        <td class="inline-cell" contenteditable="true" data-idx="${idx}" data-field="format">${ch.format || ''}</td>
        <td style="text-align: center;">
          <button class="btn-delete" data-idx="${idx}" title="Remove Channel">✕</button>
        </td>
      `;

      this.tableBody.appendChild(tr);
    });

    this.tableBody.querySelectorAll('[contenteditable=true]').forEach(cell => {
      cell.addEventListener('blur', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const field = e.target.dataset.field;
        this.model.updateChannel(idx, field, e.target.innerText.trim());
        this.bridge.notifyChanged();
      });
    });

    this.tableBody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        this.model.removeChannel(idx);
        this.render();
        this.bridge.notifyChanged();
      });
    });
  }

  renderSvg() {
    if (!this.svgContainer) return;

    const width = 640;
    const height = 180;
    const isPaired = this.model.status === 'Paired';
    const statusColor = isPaired ? '#4ADE80' : '#EF4444';

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
        <text x="35" y="48" fill="#888888" font-size="11" font-family="sans-serif">Current Sheet: <tspan fill="#f4f4f5" font-weight="bold">${this.model.sourceSheet}</tspan> [Zone ${this.model.sourceZone}]</text>

        <!-- Source Portal Arrow -->
        <polygon points="120,65 210,65 235,95 210,125 120,125 145,95" fill="#121212" stroke="#4A9EFF" stroke-width="2"/>
        <text x="175" y="92" fill="#F4902C" font-size="11" font-weight="bold" font-family="JetBrains Mono, monospace" text-anchor="middle">${this.model.portalTag}</text>
        <text x="175" y="108" fill="#888888" font-size="9" font-family="sans-serif" text-anchor="middle">${this.model.direction}</text>

        <!-- Linking Tunnel / Waveguide Beam -->
        <line x1="240" y1="95" x2="395" y2="95" stroke="url(#beamGrad)" stroke-width="3" stroke-dasharray="6 4"/>
        <circle cx="320" cy="95" r="16" fill="#0f0f11" stroke="${statusColor}" stroke-width="2"/>
        <text x="320" y="99" fill="${statusColor}" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">⚡</text>
        <text x="320" y="125" fill="#888888" font-size="10" font-family="sans-serif" text-anchor="middle">${this.model.channels.length} Ch Bus</text>

        <!-- Destination Target Sheet Box -->
        <rect x="395" y="25" width="220" height="130" rx="6" fill="#18181b" stroke="#2c2c2c" stroke-width="1.5"/>
        <text x="405" y="48" fill="#888888" font-size="11" font-family="sans-serif">Target Sheet: <tspan fill="#f4f4f5" font-weight="bold">${this.model.targetSheet || '---'}</tspan> [Zone ${this.model.targetZone || '---'}]</text>

        <!-- Target Portal Arrow -->
        <polygon points="410,65 500,65 525,95 500,125 410,125 435,95" fill="#121212" stroke="${statusColor}" stroke-width="2"/>
        <text x="465" y="92" fill="${statusColor}" font-size="11" font-weight="bold" font-family="JetBrains Mono, monospace" text-anchor="middle">${this.model.targetTag || 'UNLINKED'}</text>
        <text x="465" y="108" fill="#888888" font-size="9" font-family="sans-serif" text-anchor="middle">${this.model.status}</text>
      </svg>
    `;

    this.svgContainer.innerHTML = svg;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    new PortalApp();
  });
}
