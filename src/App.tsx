import { createSignal, createResource, Show, For, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';

type Paste = {
  id: string;
  content: string;
  language: string;
  created_at: number;
  expires_at: number;
};

function App() {
  // Read initial paste ID from URL or localStorage
  const initialPasteId = (() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      // Check if URL is a paste ID (/abcdefgh)
      if (path.length === 9 && path.startsWith('/') && !path.includes('.')) {
        const id = path.substring(1);
        // Clear the URL to avoid confusion
        window.history.replaceState({}, '', '/');
        return id;
      }
      // Check localStorage (fallback)
      const id = localStorage.getItem('viewPasteId');
      if (id) {
        localStorage.removeItem('viewPasteId');
        return id;
      }
    }
    return null;
  })();

  const [content, setContent] = createSignal('');
  const [language, setLanguage] = createSignal('text');
  const [pastes, setPastes] = createStore<Paste[]>([]);
  const [viewingPaste, setViewingPaste] = createSignal<Paste | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  // Fetch recent pastes on load
  const [recentPastes] = createResource(async () => {
    try {
      const res = await fetch('/api/pastes');
      if (res.ok) {
        const data = await res.json();
        setPastes(data.pastes || []);
      }
    } catch (err) {
      console.error('Failed to fetch pastes:', err);
    }
    return [];
  });

  // If initialPasteId exists, fetch and display it
  onMount(() => {
    if (initialPasteId) {
      fetchPaste(initialPasteId);
    }
  });

  const fetchPaste = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/pastes/${id}`);
      if (res.ok) {
        const paste = await res.json();
        setViewingPaste(paste);
      } else {
        setError('Paste not found or expired');
        setViewingPaste(null);
      }
    } catch (err) {
      setError('Failed to load paste');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!content().trim()) {
      setError('Content cannot be empty');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content(),
          language: language(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update recent pastes list
        setPastes([data, ...pastes]);
        // Clear form
        setContent('');
        setLanguage('text');
        // Show the new paste
        setViewingPaste(data);
        // Update URL without reload
        window.history.pushState({}, '', `/${data.id}`);
      } else {
        setError('Failed to create paste');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch (err) {
      alert('Failed to copy');
    }
  };

  const deletePaste = async (id: string) => {
    if (!confirm('Are you sure you want to delete this paste?')) return;

    try {
      const res = await fetch(`/api/pastes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        // Remove from local state
        setPastes(pastes.filter(p => p.id !== id));
        if (viewingPaste()?.id === id) setViewingPaste(null);
      }
    } catch (err) {
      alert('Failed to delete paste');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getTimeRemaining = (expiresAt: number) => {
    const now = Date.now();
    const diff = expiresAt - now;
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `Expires in ${days} day${days > 1 ? 's' : ''}`;
    return `Expires in ${hours} hour${hours > 1 ? 's' : ''}`;
  };

  return (
    <div style={{ 
      padding: '1rem', 
      'max-width': '1400px', 
      margin: '0 auto',
      'min-height': '100vh',
      'background': '#f5f5f5'
    }}>
      <header style={{ 
        'margin-bottom': '2rem', 
        'text-align': 'center',
        padding: '1rem',
        'background': 'white',
        'border-radius': '8px',
        'box-shadow': '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ 'margin-bottom': '0.5rem', color: '#333' }}>📝 Solid Pastebin</h1>
        <p style={{ color: '#666' }}>Pastes automatically deleted after 3 days</p>
      </header>

      <Show when={error()}>
        <div style={{
          padding: '1rem',
          'background': '#ffebee',
          color: '#c62828',
          'border-radius': '4px',
          'margin-bottom': '1rem'
        }}>
          {error()}
        </div>
      </Show>

      <div style={{ 
        display: 'grid', 
        'grid-template-columns': '1fr 1fr', 
        gap: '2rem',
        '@media (max-width: 768px)': {
          'grid-template-columns': '1fr'
        }
      }}>
        {/* Create Paste Form */}
        <div style={{
          'background': 'white',
          padding: '1.5rem',
          'border-radius': '8px',
          'box-shadow': '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ 'margin-bottom': '1rem', color: '#333' }}>Create New Paste</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', 'flex-direction': 'column', gap: '1rem' }}>
            <div>
              <label for="language" style={{ 
                display: 'block', 
                'margin-bottom': '0.5rem',
                'font-weight': '500'
              }}>
                Language/Syntax:
              </label>
              <select 
                id="language" 
                value={language()} 
                onInput={(e) => setLanguage(e.currentTarget.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem',
                  'border': '1px solid #ddd',
                  'border-radius': '4px',
                  'font-size': '1rem'
                }}
                disabled={loading()}
              >
                <option value="text">Plain Text</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="json">JSON</option>
                <option value="markdown">Markdown</option>
                <option value="bash">Bash/Shell</option>
              </select>
            </div>

            <div>
              <label for="content" style={{ 
                display: 'block', 
                'margin-bottom': '0.5rem',
                'font-weight': '500'
              }}>
                Paste Content:
              </label>
              <textarea
                id="content"
                value={content()}
                onInput={(e) => setContent(e.currentTarget.value)}
                rows={15}
                placeholder="Paste your content here..."
                style={{ 
                  width: '100%', 
                  padding: '0.75rem',
                  'font-family': '"Courier New", monospace',
                  'font-size': '14px',
                  'border': '1px solid #ddd',
                  'border-radius': '4px',
                  'resize': 'vertical'
                }}
                required
                disabled={loading()}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading()}
              style={{ 
                padding: '0.75rem 1.5rem', 
                'background': loading() ? '#ccc' : '#007acc',
                color: 'white',
                border: 'none',
                'border-radius': '4px',
                'font-size': '1rem',
                'font-weight': '500',
                cursor: loading() ? 'not-allowed' : 'pointer',
                'transition': 'background 0.2s'
              }}
            >
              {loading() ? 'Creating...' : 'Create Paste'}
            </button>
          </form>
        </div>

        {/* Recent Pastes / View Paste */}
        <div style={{
          'background': 'white',
          padding: '1.5rem',
          'border-radius': '8px',
          'box-shadow': '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <Show when={viewingPaste()} fallback={
            <>
              <div style={{ 
                display: 'flex', 
                'justify-content': 'space-between',
                'align-items': 'center',
                'margin-bottom': '1.5rem'
              }}>
                <h2 style={{ color: '#333', margin: 0 }}>Recent Pastes</h2>
                <small style={{ color: '#666' }}>{pastes.length} total</small>
              </div>
              
              <Show when={recentPastes.loading}>
                <div style={{ 
                  padding: '2rem', 
                  'text-align': 'center',
                  color: '#666'
                }}>
                  Loading pastes...
                </div>
              </Show>

              <Show when={!recentPastes.loading && pastes.length === 0}>
                <div style={{ 
                  padding: '2rem', 
                  'text-align': 'center',
                  color: '#666',
                  'border': '2px dashed #ddd',
                  'border-radius': '8px'
                }}>
                  <p style={{ 'margin-bottom': '0.5rem' }}>No pastes yet</p>
                  <p>Create your first paste!</p>
                </div>
              </Show>

              <Show when={pastes.length > 0}>
                <div style={{ 
                  display: 'flex', 
                  'flex-direction': 'column', 
                  gap: '1rem',
                  'max-height': '600px',
                  overflow: 'auto',
                  padding: '0.25rem'
                }}>
                  <For each={pastes}>
                    {(paste) => (
                      <div style={{ 
                        border: '1px solid #e0e0e0', 
                        padding: '1rem',
                        'border-radius': '6px',
                        'transition': 'border-color 0.2s',
                        ':hover': {
                          'border-color': '#007acc'
                        }
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          'justify-content': 'space-between',
                          'align-items': 'center',
                          'margin-bottom': '0.75rem'
                        }}>
                          <div style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
                            <span style={{
                              'background': '#e3f2fd',
                              color: '#007acc',
                              padding: '0.25rem 0.5rem',
                              'border-radius': '4px',
                              'font-size': '0.875rem',
                              'font-weight': '500'
                            }}>
                              {paste.language.toUpperCase()}
                            </span>
                            <small style={{ color: '#666' }}>
                              {getTimeRemaining(paste.expires_at)}
                            </small>
                          </div>
                          <small style={{ color: '#888' }}>
                            {formatDate(paste.created_at)}
                          </small>
                        </div>
                        
                        <div style={{ 
                          'max-height': '120px',
                          overflow: 'hidden',
                          'position': 'relative',
                          'margin-bottom': '0.75rem'
                        }}>
                          <pre style={{ 
                            margin: 0, 
                            'white-space': 'pre-wrap',
                            'word-break': 'break-word',
                            'font-family': '"Courier New", monospace',
                            'font-size': '13px',
                            color: '#333'
                          }}>
                            {paste.content.substring(0, 300)}
                            {paste.content.length > 300 && '...'}
                          </pre>
                          {paste.content.length > 300 && (
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: '40px',
                              background: 'linear-gradient(transparent, white)'
                            }} />
                          )}
                        </div>
                        
                        <div style={{ 
                          display: 'flex', 
                          gap: '0.5rem',
                          'flex-wrap': 'wrap'
                        }}>
                          <button 
                            onClick={() => setViewingPaste(paste)}
                            style={{ 
                              padding: '0.375rem 0.75rem',
                              'background': '#f0f0f0',
                              border: '1px solid #ddd',
                              'border-radius': '4px',
                              cursor: 'pointer',
                              'font-size': '0.875rem',
                              'transition': 'background 0.2s',
                              ':hover': {
                                background: '#e0e0e0'
                              }
                            }}
                          >
                            👁️ View
                          </button>
                          <button 
                            onClick={() => copyToClipboard(`${window.location.origin}/${paste.id}`)}
                            style={{ 
                              padding: '0.375rem 0.75rem',
                              'background': '#e8f5e9',
                              border: '1px solid #c8e6c9',
                              color: '#2e7d32',
                              'border-radius': '4px',
                              cursor: 'pointer',
                              'font-size': '0.875rem',
                              'transition': 'background 0.2s',
                              ':hover': {
                                background: '#dcedc8'
                              }
                            }}
                          >
                            📋 Copy URL
                          </button>
                          <button 
                            onClick={() => copyToClipboard(paste.content)}
                            style={{ 
                              padding: '0.375rem 0.75rem',
                              'background': '#fff3e0',
                              border: '1px solid #ffe0b2',
                              color: '#ef6c00',
                              'border-radius': '4px',
                              cursor: 'pointer',
                              'font-size': '0.875rem',
                              'transition': 'background 0.2s',
                              ':hover': {
                                background: '#ffecb3'
                              }
                            }}
                          >
                            📝 Copy Text
                          </button>
                          <button 
                            onClick={() => deletePaste(paste.id)}
                            style={{ 
                              padding: '0.375rem 0.75rem',
                              'background': '#ffebee',
                              border: '1px solid #ffcdd2',
                              color: '#c62828',
                              'border-radius': '4px',
                              cursor: 'pointer',
                              'font-size': '0.875rem',
                              'transition': 'background 0.2s',
                              ':hover': {
                                background: '#ffcdd2'
                              }
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </>
          }>
            {(paste) => (
              <div>
                <div style={{ 
                  display: 'flex', 
                  'justify-content': 'space-between',
                  'align-items': 'center',
                  'margin-bottom': '1.5rem'
                }}>
                  <h2 style={{ color: '#333', margin: 0 }}>Viewing Paste</h2>
                  <button 
                    onClick={() => {
                      setViewingPaste(null);
                      window.history.replaceState({}, '', '/');
                    }}
                    style={{ 
                      padding: '0.5rem 1rem',
                      'background': '#f5f5f5',
                      border: '1px solid #ddd',
                      'border-radius': '4px',
                      cursor: 'pointer'
                    }}
                  >
                    ← Back to List
                  </button>
                </div>
                
                <div style={{ 
                  'margin-bottom': '1.5rem',
                  padding: '1rem',
                  'background': '#f9f9f9',
                  'border-radius': '6px'
                }}>
                  <div style={{ 
                    display: 'grid',
                    'grid-template-columns': 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    'font-size': '0.9rem'
                  }}>
                    <div>
                      <strong style={{ color: '#666' }}>Language:</strong>
                      <div style={{ 
                        display: 'inline-block',
                        'margin-left': '0.5rem',
                        'background': '#e3f2fd',
                        color: '#007acc',
                        padding: '0.25rem 0.75rem',
                        'border-radius': '4px',
                        'font-weight': '500'
                      }}>
                        {paste().language.toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <strong style={{ color: '#666' }}>Created:</strong>
                      <div style={{ 'margin-left': '0.5rem', color: '#333' }}>
                        {formatDate(paste().created_at)}
                      </div>
                    </div>
                    <div>
                      <strong style={{ color: '#666' }}>Expires:</strong>
                      <div style={{ 
                        'margin-left': '0.5rem', 
                        color: paste().expires_at > Date.now() ? '#2e7d32' : '#c62828'
                      }}>
                        {formatDate(paste().expires_at)}
                        <small style={{ 'margin-left': '0.5rem', color: '#666' }}>
                          ({getTimeRemaining(paste().expires_at)})
                        </small>
                      </div>
                    </div>
                    <div>
                      <strong style={{ color: '#666' }}>ID:</strong>
                      <div style={{ 
                        'margin-left': '0.5rem', 
                        'font-family': 'monospace',
                        color: '#333'
                      }}>
                        {paste().id}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  position: 'relative',
                  'margin-bottom': '1.5rem'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    zIndex: 1
                  }}>
                    <button 
                      onClick={() => copyToClipboard(paste().content)}
                      style={{ 
                        padding: '0.5rem 1rem',
                        'background': 'rgba(255,255,255,0.9)',
                        border: '1px solid #ddd',
                        'border-radius': '4px',
                        cursor: 'pointer',
                        'font-size': '0.875rem',
                        'backdrop-filter': 'blur(4px)'
                      }}
                    >
                      📋 Copy Content
                    </button>
                  </div>
                  
                  <pre style={{ 
                    'background': '#f8f9fa',
                    padding: '1.5rem',
                    'border-radius': '6px',
                    overflow: 'auto',
                    'max-height': '500px',
                    'border': '1px solid #e9ecef',
                    'font-family': '"Courier New", monospace',
                    'font-size': '14px',
                    'line-height': '1.5',
                    'white-space': 'pre-wrap',
                    'word-break': 'break-word'
                  }}>
                    <code>{paste().content}</code>
                  </pre>
                </div>

                <div style={{ 
                  display: 'flex', 
                  gap: '0.75rem',
                  'flex-wrap': 'wrap'
                }}>
                  <button 
                    onClick={() => copyToClipboard(paste().content)}
                    style={{ 
                      padding: '0.75rem 1.5rem',
                      'background': '#007acc',
                      color: 'white',
                      border: 'none',
                      'border-radius': '4px',
                      cursor: 'pointer',
                      'font-weight': '500',
                      'transition': 'background 0.2s',
                      ':hover': {
                        background: '#005fa3'
                      }
                    }}
                  >
                    📋 Copy Content
                  </button>
                  <button 
                    onClick={() => copyToClipboard(`${window.location.origin}/${paste().id}`)}
                    style={{ 
                      padding: '0.75rem 1.5rem',
                      'background': '#4caf50',
                      color: 'white',
                      border: 'none',
                      'border-radius': '4px',
                      cursor: 'pointer',
                      'font-weight': '500',
                      'transition': 'background 0.2s',
                      ':hover': {
                        background: '#3d8b40'
                      }
                    }}
                  >
                    🔗 Copy URL
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm('Delete this paste permanently?')) {
                        deletePaste(paste().id);
                      }
                    }}
                    style={{ 
                      padding: '0.75rem 1.5rem',
                      'background': '#f44336',
                      color: 'white',
                      border: 'none',
                      'border-radius': '4px',
                      cursor: 'pointer',
                      'font-weight': '500',
                      'transition': 'background 0.2s',
                      ':hover': {
                        background: '#d32f2f'
                      }
                    }}
                  >
                    🗑️ Delete Paste
                  </button>
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>

      <footer style={{ 
        'margin-top': '3rem', 
        'text-align': 'center',
        padding: '1.5rem',
        color: '#666',
        'font-size': '0.9rem',
        'border-top': '1px solid #e0e0e0'
      }}>
        <p>Pastes are automatically deleted after 3 days</p>
        <p style={{ 'margin-top': '0.5rem', 'font-size': '0.8rem' }}>
          Built with SolidJS + Cloudflare Workers
        </p>
      </footer>
    </div>
  );
}

export default App;
