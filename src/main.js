import './style.css'

const API_HOST = import.meta.env.VITE_API_HOST || 'http://localhost:8787'
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-key'
const DEFAULT_DOMAIN = import.meta.env.VITE_MAIL_DOMAIN || 'claw.dev'
const POLL_INTERVAL = parseInt(import.meta.env.VITE_POLL_MS || '8000')

let state = {
  email: null,
  domain: DEFAULT_DOMAIN,
  domains: [],
  inbox: [],
  selectedEmail: null,
  polling: null,
  theme: localStorage.getItem('theme') || 'dark'
}

async function apiCall(endpoint, options = {}) {
  const url = `${API_HOST}${endpoint}`
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers
  }
  
  const response = await fetch(url, { ...options, headers })
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  return response.json()
}

async function loadDomains() {
  try {
    const data = await apiCall('/domains')
    state.domains = data.domains || []
    if (state.domains.length > 0 && !state.domains.includes(state.domain)) {
      state.domain = state.domains[0]
    }
    renderDomainSelector()
  } catch (err) {
    console.error('Failed to load domains:', err)
    state.domains = [DEFAULT_DOMAIN]
  }
}

async function generateEmail() {
  const username = document.getElementById('emailUsername').value.trim() || randomUsername()
  const email = `${username}@${state.domain}`
  
  try {
    const data = await apiCall('/generate', {
      method: 'POST',
      body: JSON.stringify({ email })
    })
    
    state.email = data.address || data.email || email
    state.inbox = []
    
    document.getElementById('emailDisplay').value = state.email
    document.getElementById('inboxSection').classList.remove('hidden')
    
    startPolling()
    showNotification('Email generated!', 'success')
  } catch (err) {
    showNotification('Failed to generate email', 'error')
    console.error(err)
  }
}

async function fetchInbox() {
  if (!state.email) return
  
  try {
    const data = await apiCall(`/inbox/${encodeURIComponent(state.email)}`)
    state.inbox = data.messages || []
    renderInbox()
  } catch (err) {
    console.error('Failed to fetch inbox:', err)
  }
}

function startPolling() {
  if (state.polling) clearInterval(state.polling)
  
  fetchInbox()
  state.polling = setInterval(fetchInbox, POLL_INTERVAL)
}

function stopPolling() {
  if (state.polling) {
    clearInterval(state.polling)
    state.polling = null
  }
}

function randomUsername() {
  const adjectives = ['swift', 'bright', 'cool', 'quick', 'smart', 'bold', 'calm', 'wise']
  const nouns = ['fox', 'wolf', 'hawk', 'lion', 'bear', 'eagle', 'tiger', 'shark']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const num = Math.floor(Math.random() * 999)
  return `${adj}${noun}${num}`
}

function copyEmail() {
  const input = document.getElementById('emailDisplay')
  input.select()
  document.execCommand('copy')
  showNotification('Email copied!', 'success')
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark'
  localStorage.setItem('theme', state.theme)
  document.documentElement.setAttribute('data-theme', state.theme)
  
  const btn = document.getElementById('themeToggle')
  btn.textContent = state.theme === 'dark' ? '☀️ Light' : '🌙 Dark'
}

function selectDomain(domain) {
  state.domain = domain
  renderDomainSelector()
}

async function openEmail(messageId) {
  try {
    const data = await apiCall(`/message/${encodeURIComponent(state.email)}/${messageId}`)
    state.selectedEmail = data.message
    renderEmailModal()
  } catch (err) {
    showNotification('Failed to load email', 'error')
    console.error(err)
  }
}

function closeEmailModal() {
  state.selectedEmail = null
  document.getElementById('emailModal').remove()
}

async function deleteEmail(messageId) {
  try {
    await apiCall(`/delete/${encodeURIComponent(state.email)}/${messageId}`, {
      method: 'DELETE'
    })
    state.inbox = state.inbox.filter(m => m.id !== messageId)
    renderInbox()
    showNotification('Email deleted', 'success')
  } catch (err) {
    showNotification('Failed to delete email', 'error')
    console.error(err)
  }
}

function showNotification(message, type = 'info') {
  const existing = document.querySelector('.notification')
  if (existing) existing.remove()
  
  const notif = document.createElement('div')
  notif.className = `notification notification-${type}`
  notif.textContent = message
  notif.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    background: ${type === 'success' ? 'var(--success)' : 'var(--error)'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: 500;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `
  
  document.body.appendChild(notif)
  setTimeout(() => notif.remove(), 3000)
}

function renderDomainSelector() {
  const container = document.getElementById('domainSelector')
  container.innerHTML = state.domains.map(domain => `
    <button 
      class="domain-chip ${domain === state.domain ? 'active' : ''}"
      onclick="window.selectDomain('${domain}')"
    >
      @${domain}
    </button>
  `).join('')
}

function renderInbox() {
  const container = document.getElementById('inboxList')
  const stats = document.getElementById('inboxStats')
  
  stats.textContent = `${state.inbox.length} message${state.inbox.length !== 1 ? 's' : ''}`
  
  if (state.inbox.length === 0) {
    container.innerHTML = `
      <div class="inbox-empty">
        <div class="inbox-empty-icon">📭</div>
        <p>No messages yet. Your inbox is empty.</p>
      </div>
    `
    return
  }
  
  container.innerHTML = state.inbox.map(msg => `
    <div class="email-item ${msg.read ? '' : 'unread'}" onclick="window.openEmail('${msg.id}')">
      <div class="email-header">
        <div class="email-from">${escapeHtml(msg.from)}</div>
        <div class="email-time">${formatTime(msg.timestamp || msg.date)}</div>
      </div>
      <div class="email-subject">${escapeHtml(msg.subject)}</div>
      <div class="email-preview">${escapeHtml((msg.text || '').substring(0, 100))}</div>
    </div>
  `).join('')
}

function renderEmailModal() {
  const msg = state.selectedEmail
  if (!msg) return
  
  const modal = document.createElement('div')
  modal.id = 'emailModal'
  modal.className = 'modal-overlay'
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title">Email Details</div>
        <button class="modal-close" onclick="window.closeEmailModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="email-meta">
          <div class="email-meta-row">
            <div class="email-meta-label">From:</div>
            <div class="email-meta-value">${escapeHtml(msg.from)}</div>
          </div>
          <div class="email-meta-row">
            <div class="email-meta-label">To:</div>
            <div class="email-meta-value">${escapeHtml(msg.to || state.email)}</div>
          </div>
          <div class="email-meta-row">
            <div class="email-meta-label">Subject:</div>
            <div class="email-meta-value">${escapeHtml(msg.subject)}</div>
          </div>
          <div class="email-meta-row">
            <div class="email-meta-label">Date:</div>
            <div class="email-meta-value">${new Date(msg.timestamp || msg.date).toLocaleString()}</div>
          </div>
        </div>
        <div class="email-body">
          ${msg.html ? msg.html : `<pre>${escapeHtml(msg.text || '')}</pre>`}
        </div>
      </div>
    </div>
  `
  
  document.body.appendChild(modal)
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeEmailModal()
  })
}

function formatTime(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function initApp() {
  document.documentElement.setAttribute('data-theme', state.theme)
  
  document.getElementById('app').innerHTML = `
    <nav class="navbar">
      <div class="nav-container">
        <a href="#" class="logo">
          <div class="logo-icon">🐾</div>
          <span>ClawMail</span>
        </a>
        <div class="nav-actions">
          <button class="theme-toggle" id="themeToggle" onclick="window.toggleTheme()">
            ${state.theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>
    </nav>

    <section class="hero">
      <div class="container">
        <div class="hero-badge">
          <span class="badge-dot"></span>
          Temporary Email Service
        </div>
        <h1 class="hero-title">
          Disposable Email,<br>
          <span class="text-gradient">Instantly.</span>
        </h1>
        <p class="hero-desc">
          Generate secure temporary emails in seconds. No signup, no tracking, completely anonymous.
        </p>

        <div class="generate-box">
          <div class="email-input-wrap">
            <div class="email-field">
              <input 
                type="text" 
                class="email-display" 
                id="emailDisplay" 
                placeholder="your-email@claw.dev" 
                readonly
              >
            </div>
            <button class="btn" onclick="window.copyEmail()">📋 Copy</button>
          </div>
          
          <div class="email-input-wrap">
            <input 
              type="text" 
              class="email-display" 
              id="emailUsername" 
              placeholder="username (optional)"
            >
            <button class="btn" onclick="window.generateEmail()">🎲 Generate</button>
          </div>

          <div class="domain-selector" id="domainSelector"></div>
        </div>
      </div>
    </section>

    <section class="inbox-section container hidden" id="inboxSection">
      <div class="inbox-header">
        <h2 class="inbox-title">📬 Inbox</h2>
        <div class="inbox-stats" id="inboxStats">0 messages</div>
      </div>
      <div class="inbox-list" id="inboxList">
        <div class="inbox-empty">
          <div class="inbox-empty-icon">📭</div>
          <p>No messages yet. Your inbox is empty.</p>
        </div>
      </div>
    </section>

    <section class="features-section">
      <div class="container">
        <h2 class="section-title">Why ClawMail?</h2>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">⚡</div>
            <h3 class="feature-title">Instant Generation</h3>
            <p class="feature-desc">Create temporary emails in seconds. No registration required.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🔒</div>
            <h3 class="feature-title">Privacy First</h3>
            <p class="feature-desc">Your data is never stored. Complete anonymity guaranteed.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🎯</div>
            <h3 class="feature-title">Multiple Domains</h3>
            <p class="feature-desc">Choose from multiple domains for your temporary email.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🔄</div>
            <h3 class="feature-title">Auto Refresh</h3>
            <p class="feature-desc">Inbox updates automatically. Never miss an email.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📱</div>
            <h3 class="feature-title">Mobile Friendly</h3>
            <p class="feature-desc">Works perfectly on all devices. Responsive design.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🎨</div>
            <h3 class="feature-title">Dark Mode</h3>
            <p class="feature-desc">Easy on the eyes. Switch themes anytime.</p>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div class="container">
        <p>ClawMail © 2026 — Temporary Email Service</p>
      </div>
    </footer>
  `

  setTimeout(() => {
    document.getElementById('app-loader').classList.add('hide')
  }, 500)

  loadDomains()
}

window.generateEmail = generateEmail
window.copyEmail = copyEmail
window.toggleTheme = toggleTheme
window.selectDomain = selectDomain
window.openEmail = openEmail
window.closeEmailModal = closeEmailModal
window.deleteEmail = deleteEmail

document.addEventListener('DOMContentLoaded', initApp)
