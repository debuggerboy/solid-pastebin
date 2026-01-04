/// <reference types="@cloudflare/workers-types" />

export interface Env {
  PASTES: KVNamespace;
}

interface PasteData {
  id: string;
  name: string;
  content: string;
  language: string;
  created_at: number;
  expires_at: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

async function cleanupExpiredPastes(env: Env) {
  try {
    const list = await env.PASTES.list();
    const now = Date.now();
    
    for (const key of list.keys) {
      const paste = await env.PASTES.get<PasteData>(key.name, 'json');
      if (paste && now > paste.expires_at) {
        await env.PASTES.delete(key.name);
      }
    }
  } catch (e) {
    console.error('Cleanup error:', e);
  }
}

// HTML template as a regular string
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
  <title>Solid Pastebin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      padding: 16px;
    }
    @media (min-width: 768px) {
      body { padding: 24px; }
    }
    .container { 
      max-width: 1400px; 
      margin: 0 auto;
    }
    .main-content {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    @media (min-width: 1024px) {
      .main-content {
        flex-direction: row;
      }
      .main-content > * {
        flex: 1;
      }
    }
    .card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    @media (min-width: 768px) {
      .card { padding: 24px; }
    }
    h1 { 
      color: #333; 
      margin-bottom: 16px;
      font-size: 24px;
    }
    @media (min-width: 768px) {
      h1 { font-size: 32px; }
    }
    .subtitle {
      color: #666;
      margin-bottom: 24px;
    }
    input, select, textarea {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 16px;
      margin-bottom: 16px;
      font-family: inherit;
    }
    textarea { 
      min-height: 200px;
      resize: vertical;
      font-family: 'Courier New', monospace;
    }
    button {
      background: #007acc;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      width: 100%;
    }
    @media (min-width: 768px) {
      button { width: auto; }
    }
    .paste-item {
      border: 1px solid #e0e0e0;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .paste-content {
      font-family: monospace;
      background: #f8f9fa;
      padding: 12px;
      border-radius: 6px;
      margin: 12px 0;
      max-height: 100px;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📝 Solid Pastebin</h1>
    <p class="subtitle">Pastes automatically deleted after 3 days</p>
    
    <div class="main-content">
      <div class="card">
        <h2>Create New Paste</h2>
        <input 
          type="text" 
          id="pasteName" 
          placeholder="Paste Name (optional)" 
          style="margin-bottom: 16px;"
        >
        <select id="language">
          <option value="text">Plain Text</option>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
        </select>
        <textarea id="content" placeholder="Paste your content here..."></textarea>
        <button onclick="createPaste()">Create Paste</button>
        <div id="result"></div>
      </div>
      
      <div class="card">
        <h2>Recent Pastes</h2>
        <div id="pastes">Loading...</div>
      </div>
    </div>
  </div>
  
  <script>
    async function createPaste() {
      const content = document.getElementById('content').value;
      const language = document.getElementById('language').value;
      const name = document.getElementById('pasteName').value;
      const result = document.getElementById('result');
      
      if (!content.trim()) {
        result.innerHTML = '<p style="color: #c62828;">Please enter content</p>';
        return;
      }
      
      result.innerHTML = '<p>Creating...</p>';
      const button = document.querySelector('button');
      button.disabled = true;
      
      try {
        const res = await fetch('/api/pastes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, content, language })
        });
        
        if (res.ok) {
          const data = await res.json();
          result.innerHTML = '<p style="color: #2e7d32;">✅ Paste created! <a href="/' + data.id + '" style="color: #007acc;">View paste</a></p>';
          document.getElementById('content').value = '';
          document.getElementById('pasteName').value = '';
          loadPastes();
        } else {
          result.innerHTML = '<p style="color: #c62828;">Failed to create paste</p>';
        }
      } catch (err) {
        result.innerHTML = '<p style="color: #c62828;">Network error</p>';
      } finally {
        button.disabled = false;
        button.innerHTML = 'Create Paste';
      }
    }
    
    async function loadPastes() {
      try {
        const res = await fetch('/api/pastes');
        if (res.ok) {
          const data = await res.json();
          const container = document.getElementById('pastes');
          
          if (data.pastes.length === 0) {
            container.innerHTML = '<p>No pastes yet</p>';
            return;
          }
          
          container.innerHTML = data.pastes.map(paste => {
            const shortContent = paste.content.length > 200 
              ? paste.content.substring(0, 200) + '...'
              : paste.content;
              
            return '<div class="paste-item">' +
              '<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">' +
                '<strong>' + (paste.name || 'Untitled') + '</strong>' +
                '<small>' + new Date(paste.created_at).toLocaleDateString() + '</small>' +
              '</div>' +
              '<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">' +
                '<span style="background: #e3f2fd; color: #007acc; padding: 2px 8px; border-radius: 4px; font-size: 0.9rem;">' + 
                  paste.language.toUpperCase() + 
                '</span>' +
                '<small style="color: #666;">Expires: ' + new Date(paste.expires_at).toLocaleDateString() + '</small>' +
              '</div>' +
              '<div class="paste-content">' + escapeHtml(shortContent) + '</div>' +
              '<div style="display: flex; gap: 8px;">' +
                '<button onclick="viewPaste(\\'' + paste.id + '\\')" style="background: #4caf50; padding: 6px 12px; font-size: 14px;">View</button>' +
                '<button onclick="copyUrl(\\'' + paste.id + '\\')" style="background: #ff9800; padding: 6px 12px; font-size: 14px;">Copy URL</button>' +
                '<button onclick="deletePaste(\\'' + paste.id + '\\')" style="background: #f44336; padding: 6px 12px; font-size: 14px;">Delete</button>' +
              '</div>' +
            '</div>';
          }).join('');
        }
      } catch (err) {
        console.error('Error loading pastes:', err);
      }
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    function viewPaste(id) {
      window.location.href = '/' + id;
    }
    
    function copyUrl(id) {
      navigator.clipboard.writeText(window.location.origin + '/' + id);
      alert('URL copied!');
    }
    
    async function deletePaste(id) {
      if (!confirm('Delete this paste?')) return;
      
      try {
        await fetch('/api/pastes/' + id, { method: 'DELETE' });
        loadPastes();
      } catch (err) {
        alert('Failed to delete');
      }
    }
    
    document.addEventListener('DOMContentLoaded', loadPastes);
  </script>
<footer style="
  margin-top: 2rem;
  padding: 1rem;
  text-align: center;
  color: #666;
  border-top: 1px solid #e0e0e0;
  font-size: 0.9rem;
">
  <div style="
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  ">
    <div>
      <span style="
        display: inline-block;
        transform: scaleX(-1);
        margin-right: 0.25rem;
        font-weight: bold;
      ">©</span>
      Copyleft 2025, All Wrongs Reserved.
    </div>
    <div>
      Built with Solid.js + Cloudflare Workers ❤️
    </div>
  </div>
</footer>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Cleanup in background
    ctx.waitUntil(cleanupExpiredPastes(env));
    
    // API Routes
    if (path.startsWith('/api/')) {
      return handleApiRequest(request, env, path);
    }
    
    // View specific paste
    if (path.length === 9 && path.startsWith('/') && !path.includes('.')) {
      const pasteId = path.substring(1);
      return servePastePage(pasteId, env);
    }
    
    // Serve main HTML
    return new Response(HTML, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'no-cache',
      },
    });
  },
};

async function servePastePage(pasteId: string, env: Env): Promise<Response> {
  try {
    const paste = await env.PASTES.get<PasteData>(pasteId, 'json');
    
    if (!paste) {
      const notFoundHtml = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Paste Not Found</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; text-align: center; }
    h1 { color: #666; }
    a { color: #007acc; }
  </style>
</head>
<body>
  <h1>Paste not found or expired</h1>
  <p><a href="/">← Back to pastebin</a></p>
<footer style="
  margin-top: 2rem;
  padding: 1rem;
  text-align: center;
  color: #666;
  border-top: 1px solid #e0e0e0;
  font-size: 0.9rem;
">
  <div style="
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  ">
    <div>
      <span style="
        display: inline-block;
        transform: scaleX(-1);
        margin-right: 0.25rem;
        font-weight: bold;
      ">©</span>
      Copyleft 2025, All Wrongs Reserved.
    </div>
    <div>
      Built with Solid.js + Cloudflare Workers ❤️
    </div>
  </div>
</footer>
</body>
</html>`;
      return new Response(notFoundHtml, { 
        status: 404, 
        headers: { 'Content-Type': 'text/html' } 
      });
    }
    
    const escapedContent = paste.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    const pasteHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Paste: ${pasteId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      padding: 16px;
    }
    @media (min-width: 768px) {
      body { padding: 24px; }
    }
    .container { 
      max-width: 800px; 
      margin: 0 auto;
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    @media (min-width: 768px) {
      .container { padding: 24px; }
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 20px;
    }
    h1 { 
      color: #333; 
      font-size: 20px;
    }
    @media (min-width: 768px) {
      h1 { font-size: 24px; }
    }
    .paste-info {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
      margin: 16px 0;
      font-size: 14px;
    }
    .paste-content {
      font-family: 'Courier New', monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
      border-radius: 8px;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.6;
      max-height: 60vh;
      overflow: auto;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 20px;
    }
    .actions button {
      flex: 1;
      min-width: 140px;
      padding: 12px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 15px;
    }
    .copy-btn { background: #007acc; color: white; }
    .url-btn { background: #4caf50; color: white; }
    .back-btn { background: #f0f0f0; color: #333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📝 ${paste.name || `Paste: ${pasteId}`}</h1> 
      <button class="back-btn" onclick="window.location.href='/'">← Back</button>
    </div>
    
    <div class="paste-info">
      <p><strong>Name:</strong> ${paste.name || 'Untitled'}</p>
      <p><strong>Language:</strong> ${paste.language.toUpperCase()}</p>
      <p><strong>Created:</strong> ${new Date(paste.created_at).toLocaleString()}</p>
      <p><strong>Expires:</strong> ${new Date(paste.expires_at).toLocaleString()}</p>
    </div>
    
    <div class="paste-content">${escapedContent}</div>
    
    <div class="actions">
      <button class="copy-btn" onclick="copyContent()">📋 Copy Content</button>
      <button class="url-btn" onclick="copyUrl()">🔗 Copy URL</button>
      <button class="back-btn" onclick="window.location.href='/'">🏠 Home</button>
    </div>
  </div>
  
  <script>
    function copyContent() {
      navigator.clipboard.writeText(${JSON.stringify(paste.content)});
      alert('Content copied to clipboard!');
    }
    
    function copyUrl() {
      navigator.clipboard.writeText(window.location.href);
      alert('URL copied to clipboard!');
    }
  </script>
<!-- Add this right before </body> -->
<footer style="
  margin-top: 2rem;
  padding: 1rem;
  text-align: center;
  color: #666;
  border-top: 1px solid #e0e0e0;
  font-size: 0.9rem;
">
  <div style="
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  ">
    <div>
      <span style="
        display: inline-block;
        transform: scaleX(-1);
        margin-right: 0.25rem;
        font-weight: bold;
      ">©</span>
      Copyleft 2025, All Wrongs Reserved.
    </div>
    <div>
      Built with Solid.js + Cloudflare Workers ❤️
    </div>
  </div>
</footer>
</body>
</html>`;
    
    return new Response(pasteHTML, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e) {
    return new Response('Error loading paste', { status: 500 });
  }
}

async function handleApiRequest(request: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(request.url);
  
  // GET /api/pastes
  if (path === '/api/pastes' && request.method === 'GET') {
    const list = await env.PASTES.list();
    const pastes: PasteData[] = [];
    
    for (const key of list.keys.slice(0, 20)) {
      const paste = await env.PASTES.get<PasteData>(key.name, 'json');
      if (paste) pastes.push(paste);
    }
    
    pastes.sort((a, b) => b.created_at - a.created_at);
    return Response.json({ pastes });
  }
  
  // POST /api/pastes
  if (path === '/api/pastes' && request.method === 'POST') {
    const body = await request.json<{ name?: string; content: string; language: string }>();
    
    const pasteId = generateId();
    const now = Date.now();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    
    const paste: PasteData = {
      id: pasteId,
      name: body.name || `Paste ${new Date(now).toLocaleTimeString()}`,
      content: body.content,
      language: body.language || 'text',
      created_at: now,
      expires_at: now + threeDays,
    };
    
    await env.PASTES.put(pasteId, JSON.stringify(paste));
    return Response.json(paste);
  }
  
  // DELETE /api/pastes/:id
  if (path.startsWith('/api/pastes/') && request.method === 'DELETE') {
    const pasteId = path.split('/').pop();
    if (pasteId) await env.PASTES.delete(pasteId);
    return new Response('Deleted', { status: 200 });
  }
  
  // GET /api/pastes/:id
  if (path.startsWith('/api/pastes/') && request.method === 'GET') {
    const pasteId = path.split('/').pop();
    if (pasteId) {
      const paste = await env.PASTES.get<PasteData>(pasteId, 'json');
      if (paste) return Response.json(paste);
    }
    return new Response('Not found', { status: 404 });
  }
  
  return new Response('API endpoint not found', { status: 404 });
}
