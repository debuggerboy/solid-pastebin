/// <reference types="@cloudflare/workers-types" />

export interface Env {
  PASTES: KVNamespace;
}

interface PasteData {
  id: string;
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

// HTML template as a regular string (not template literal)
const HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Solid Pastebin</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #f5f5f5;
        min-height: 100vh;
        padding: 2rem;
      }
      .container { 
        max-width: 1200px; 
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
      }
      .card {
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      h1 { color: #333; margin-bottom: 1rem; }
      h2 { color: #444; margin-bottom: 1rem; }
      textarea, input, select {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 1rem;
        margin-bottom: 1rem;
      }
      textarea { 
        font-family: 'Courier New', monospace;
        min-height: 300px;
        resize: vertical;
      }
      button {
        background: #007acc;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        font-weight: 500;
      }
      button:hover { background: #005fa3; }
      .paste-item {
        border: 1px solid #e0e0e0;
        padding: 1rem;
        border-radius: 6px;
        margin-bottom: 1rem;
      }
      .paste-content {
        font-family: monospace;
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 4px;
        margin: 1rem 0;
        max-height: 200px;
        overflow: auto;
      }
    </style>
  </head>
  <body>
    <h1>📝 Solid Pastebin</h1>
    <p>Pastes automatically deleted after 3 days</p>
    
    <div class="container">
      <!-- Create Paste -->
      <div class="card">
        <h2>Create New Paste</h2>
        <select id="language">
          <option value="text">Plain Text</option>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="json">JSON</option>
        </select>
        <textarea id="content" placeholder="Paste your content here..."></textarea>
        <button onclick="createPaste()">Create Paste</button>
        <div id="result"></div>
      </div>
      
      <!-- Recent Pastes -->
      <div class="card">
        <h2>Recent Pastes</h2>
        <div id="pastes"></div>
      </div>
    </div>
    
    <script>
      async function createPaste() {
        const content = document.getElementById('content').value;
        const language = document.getElementById('language').value;
        const result = document.getElementById('result');
        
        if (!content.trim()) {
          result.innerHTML = '<p style="color: #c62828;">Please enter content</p>';
          return;
        }
        
        result.innerHTML = '<p>Creating...</p>';
        
        try {
          const res = await fetch('/api/pastes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, language })
          });
          
          if (res.ok) {
            const data = await res.json();
            result.innerHTML = '<p style="color: #2e7d32;">✅ Paste created! <a href="/' + data.id + '" style="color: #007acc;">View paste</a></p>';
            document.getElementById('content').value = '';
            loadPastes();
          } else {
            result.innerHTML = '<p style="color: #c62828;">Failed to create paste</p>';
          }
        } catch (err) {
          result.innerHTML = '<p style="color: #c62828;">Network error</p>';
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
                '<div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">' +
                  '<strong>' + paste.language.toUpperCase() + '</strong>' +
                  '<small>' + new Date(paste.created_at).toLocaleString() + '</small>' +
                '</div>' +
                '<div class="paste-content">' + shortContent + '</div>' +
                '<div style="display: flex; gap: 0.5rem;">' +
                  '<button onclick="viewPaste(\\'' + paste.id + '\\')" style="background: #4caf50;">View</button>' +
                  '<button onclick="copyUrl(\\'' + paste.id + '\\')" style="background: #ff9800;">Copy URL</button>' +
                  '<button onclick="deletePaste(\\'' + paste.id + '\\')" style="background: #f44336;">Delete</button>' +
                '</div>' +
              '</div>';
            }).join('');
          }
        } catch (err) {
          console.error('Error loading pastes:', err);
        }
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
      
      // Load pastes on page load
      document.addEventListener('DOMContentLoaded', loadPastes);
    </script>
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
      return new Response('Paste not found or expired', { status: 404 });
    }
    
    // Escape HTML in paste content
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
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Paste: ${pasteId}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #f5f5f5;
        min-height: 100vh;
        padding: 2rem;
      }
      .container { 
        max-width: 800px; 
        margin: 0 auto;
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      h1 { color: #333; margin-bottom: 1rem; }
      .paste-info {
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 6px;
        margin: 1rem 0;
      }
      .paste-content {
        font-family: 'Courier New', monospace;
        background: #f8f9fa;
        padding: 1.5rem;
        border-radius: 6px;
        white-space: pre-wrap;
        word-break: break-word;
        margin: 1rem 0;
      }
      button {
        background: #007acc;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 4px;
        cursor: pointer;
        margin-right: 0.5rem;
        margin-top: 1rem;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>📝 Paste: ${pasteId}</h1>
      
      <div class="paste-info">
        <p><strong>Language:</strong> ${paste.language.toUpperCase()}</p>
        <p><strong>Created:</strong> ${new Date(paste.created_at).toLocaleString()}</p>
        <p><strong>Expires:</strong> ${new Date(paste.expires_at).toLocaleString()}</p>
      </div>
      
      <div class="paste-content">${escapedContent}</div>
      
      <div>
        <button onclick="copyContent()">📋 Copy Content</button>
        <button onclick="copyUrl()">🔗 Copy URL</button>
        <button onclick="goHome()">← Back Home</button>
      </div>
    </div>
    
    <script>
      function copyContent() {
        navigator.clipboard.writeText(${JSON.stringify(paste.content)});
        alert('Content copied!');
      }
      
      function copyUrl() {
        navigator.clipboard.writeText(window.location.href);
        alert('URL copied!');
      }
      
      function goHome() {
        window.location.href = '/';
      }
    </script>
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
    const body = await request.json<{ content: string; language: string }>();
    
    const pasteId = generateId();
    const now = Date.now();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    
    const paste: PasteData = {
      id: pasteId,
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
