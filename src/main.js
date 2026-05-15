/**
 * ClawMail - Disposable Email Service
 * Modern temporary email with auto-categorization
 */

import './style.css';

// Config from environment
const cfg = {
  apiHost: import.meta.env.VITE_API_HOST || '',
  apiKey: import.meta.env.VITE_API_KEY || '',
  domain: import.meta.env.VITE_MAIL_DOMAIN || 'example.com',
  pollMs: parseInt(import.meta.env.VITE_POLL_MS) || 8000,
  theme: import.meta.env.VITE_THEME || 'midnight',
};

// State
let state = {
  email: null,
  messages: [],
  domains: [],
  pollTimer: null,
};

// DOM refs
const el = {
  sectionGenerator: document.getElementById('sectionGenerator'),
  sectionActive: document.getElementById('sectionActive'),
  sectionInbox: document.getElementById('sectionInbox'),
  inputPrefix: document.getElementById('inputPrefix'),
  selectDomain: document.getElementById('selectDomain'),
  btnCreate: document.getElementById('btnCreate'),
  displayEmail: document.getElementById('displayEmail'),
  btnCopy: document.getElementById('btnCopy'),
  btnDestroy: document.getElementById('btnDestroy'),
  listMessages: document.getElementById('listMessages'),
  btnReload: document.getElementById('btnReload'),
  btnExtractOTP: document.getElementById('btnExtractOTP'),
  otpResult: document.getElementById('otpResult'),
  otpCode: document.getElementById('otpCode'),
  btnCopyOTP: document.getElementById('btnCopyOTP'),
  modalMessage: document.getElementById('modalMessage'),
  btnCloseModal: document.getElementById('btnCloseModal'),
  modalSubject: document.getElementById('modalSubject'),
  modalMeta: document.getElementById('modalMeta'),
  modalBody: document.getElementById('modalBody'),
  viewText: document.getElementById('viewText'),
  viewHTML: document.getElementById('viewHTML'),
  toast: document.getElementById('toast'),
  btnTheme: document.getElementById('btnTheme'),
};

// Init
function init() {
  applyTheme(cfg.theme);
  loadFromStorage();
  fetchDomains();
  bindEvents();
}

// Theme
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  cfg.theme = theme;
}

function toggleTheme() {
  const next = cfg.theme === 'midnight' ? 'paper' : 'midnight';
  applyTheme(next);
  showToast(`Theme: ${next}`);
}

// Storage
function loadFromStorage() {
  const stored = localStorage.getItem('clawmail_session');
  if (stored) {
    try {
      state.email = JSON.parse(stored);
      showActiveEmail();
      startPolling();
    } catch (e) {
      localStorage.removeItem('clawmail_session');
    }
  }
}

function saveToStorage() {
  if (state.email) {
    localStorage.setItem('clawmail_session', JSON.stringify(state.email));
  } else {
    localStorage.removeItem('clawmail_session');
  }
}

// Events
function bindEvents() {
  el.btnCreate.addEventListener('click', createEmail);
  el.btnCopy.addEventListener('click', () => copyText(state.email?.address));
  el.btnDestroy.addEventListener('click', destroyEmail);
  el.btnReload.addEventListener('click', fetchInbox);
  el.btnExtractOTP.addEventListener('click', extractOTP);
  el.btnCopyOTP.addEventListener('click', () => copyText(el.otpCode.textContent));
  el.btnCloseModal.addEventListener('click', closeModal);
  el.btnTheme.addEventListener('click', toggleTheme);
  
  el.modalMessage.addEventListener('click', (e) => {
    if (e.target === el.modalMessage) closeModal();
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.view));
  });

  el.inputPrefix.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createEmail();
  });
}

// API helper
async function apiCall(endpoint, options = {}) {
  const url = `${cfg.apiHost}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(cfg.apiKey && { 'Authorization': `Bearer ${cfg.apiKey}` }),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('API error:', err);
    showToast(`Error: ${err.message}`, 'error');
    throw err;
  }
}

// Domains
async function fetchDomains() {
  try {
    const data = await apiCall('/domains');
    state.domains = data.domains || [cfg.domain];
    renderDomains();
  } catch (err) {
    state.domains = [cfg.domain];
    renderDomains();
  }
}

function renderDomains() {
  el.selectDomain.innerHTML = state.domains
    .map(d => `<option value="${d}">${d}</option>`)
    .join('');
}

// Create email
async function createEmail() {
  const prefix = el.inputPrefix.value.trim() || randomPrefix();
  const domain = el.selectDomain.value || cfg.domain;
  const address = `${prefix}@${domain}`;

  el.btnCreate.disabled = true;
  el.btnCreate.textContent = 'Creating...';

  try {
    const data = await apiCall('/generate', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });

    state.email = {
      id: data.id || address,
      address: data.address || address,
      createdAt: Date.now(),
    };

    saveToStorage();
    showActiveEmail();
    startPolling();
    showToast('Email created!');
  } catch (err) {
    showToast('Failed to create email', 'error');
  } finally {
    el.btnCreate.disabled = false;
    el.btnCreate.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Create Address
    `;
  }
}

function randomPrefix() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// Show active email
function showActiveEmail() {
  el.sectionGenerator.classList.add('hidden');
  el.sectionActive.classList.remove('hidden');
  el.sectionInbox.classList.remove('hidden');
  el.displayEmail.textContent = state.email.address;
}

// Destroy email
async function destroyEmail() {
  if (!confirm('Delete this email address?')) return;

  try {
    await apiCall(`/email/${state.email.id}`, { method: 'DELETE' });
  } catch (err) {
    // Continue even if API fails
  }

  stopPolling();
  state.email = null;
  state.messages = [];
  saveToStorage();

  el.sectionGenerator.classList.remove('hidden');
  el.sectionActive.classList.add('hidden');
  el.sectionInbox.classList.add('hidden');
  el.otpResult.classList.add('hidden');
  el.inputPrefix.value = '';

  showToast('Email deleted');
}

// Polling
function startPolling() {
  stopPolling();
  fetchInbox();
  state.pollTimer = setInterval(fetchInbox, cfg.pollMs);
}

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

// Fetch inbox
async function fetchInbox() {
  if (!state.email) return;

  try {
    const data = await apiCall(`/inbox/${state.email.id}`);
    state.messages = data.messages || [];
    renderMessages();
  } catch (err) {
    console.error('Fetch inbox failed:', err);
  }
}

// Render messages
function renderMessages() {
  if (state.messages.length === 0) {
    el.listMessages.innerHTML = '<div class="empty-state">No messages yet</div>';
    return;
  }

  el.listMessages.innerHTML = state.messages
    .map(msg => {
      const category = detectCategory(msg);
      const badge = category ? `<span class="message-badge badge-${category}">${category}</span>` : '';
      const time = formatTime(msg.timestamp || msg.date);

      return `
        <div class="message-item" data-id="${msg.id}">
          <div class="message-header">
            <div class="message-subject">${escapeHtml(msg.subject || '(No subject)')}</div>
            ${badge}
          </div>
          <div class="message-from">${escapeHtml(msg.from || 'Unknown')}</div>
          <div class="message-time">${time}</div>
        </div>
      `;
    })
    .join('');

  // Bind click events
  el.listMessages.querySelectorAll('.message-item').forEach(item => {
    item.addEventListener('click', () => openMessage(item.dataset.id));
  });
}

// Detect category
function detectCategory(msg) {
  const text = `${msg.subject} ${msg.text || ''}`.toLowerCase();
  
  if (/\b\d{4,8}\b/.test(text) && /(code|otp|verify|verification|confirm)/i.test(text)) {
    return 'otp';
  }
  if (/(unsubscribe|promotion|offer|deal|discount)/i.test(text)) {
    return 'promo';
  }
  if (/(spam|phishing|suspicious)/i.test(text)) {
    return 'spam';
  }
  return null;
}

// Open message
async function openMessage(id) {
  const msg = state.messages.find(m => m.id === id);
  if (!msg) return;

  try {
    const data = await apiCall(`/message/${id}`);
    showMessageModal(data);
  } catch (err) {
    showMessageModal(msg);
  }
}

// Show message modal
function showMessageModal(msg) {
  el.modalSubject.textContent = msg.subject || '(No subject)';
  el.modalMeta.textContent = `From: ${msg.from || 'Unknown'} • ${formatTime(msg.timestamp || msg.date)}`;
  
  el.viewText.innerHTML = `<pre>${escapeHtml(msg.text || msg.textBody || 'No text content')}</pre>`;
  
  if (msg.html || msg.htmlBody) {
    const blob = new Blob([msg.html || msg.htmlBody], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    el.viewHTML.innerHTML = `<iframe src="${url}" sandbox="allow-same-origin"></iframe>`;
  } else {
    el.viewHTML.innerHTML = '<div class="empty-state">No HTML content</div>';
  }

  el.modalMessage.classList.remove('hidden');
}

// Close modal
function closeModal() {
  el.modalMessage.classList.add('hidden');
}

// Switch tab
function switchTab(view) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  document.querySelectorAll('.view-content').forEach(content => {
    content.classList.toggle('active', content.id === `view${view.charAt(0).toUpperCase() + view.slice(1)}`);
  });
}

// Extract OTP
async function extractOTP() {
  if (state.messages.length === 0) {
    showToast('No messages to extract from', 'error');
    return;
  }

  try {
    const latestMsg = state.messages[0];
    const data = await apiCall(`/code/${latestMsg.id}`);
    
    if (data.code) {
      el.otpCode.textContent = data.code;
      el.otpResult.classList.remove('hidden');
      showToast('OTP extracted!');
    } else {
      showToast('No OTP found', 'error');
    }
  } catch (err) {
    // Fallback: regex extraction
    const text = state.messages[0].text || state.messages[0].subject || '';
    const match = text.match(/\b(\d{4,8})\b/);
    
    if (match) {
      el.otpCode.textContent = match[1];
      el.otpResult.classList.remove('hidden');
      showToast('OTP extracted (local)');
    } else {
      showToast('No OTP found', 'error');
    }
  }
}

// Copy text
function copyText(text) {
  if (!text) return;
  
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied!');
  }).catch(() => {
    showToast('Copy failed', 'error');
  });
}

// Toast
function showToast(message, type = 'info') {
  el.toast.textContent = message;
  el.toast.classList.remove('hidden');
  
  setTimeout(() => {
    el.toast.classList.add('hidden');
  }, 3000);
}

// Utilities
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  if (!timestamp) return 'Unknown time';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Start app
init();
