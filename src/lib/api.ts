import { getSettings } from '@/hooks/useSettings';

// Get settings dynamically
function getApiSettings() {
  const settings = getSettings();
  const { chatUrl, ingestUrl, templateUrl, n8nBaseUrl, n8nApiKey } = settings;
  return {
    CHAT_URL: chatUrl,
    INGEST_URL: ingestUrl,
    TEMPLATE_URL: templateUrl,
    LLM_PROVIDER: settings.llmProvider,
    N8N_BASE_URL: n8nBaseUrl,
    N8N_API_KEY: n8nApiKey,
  };
}

// n8n API utility with authentication
function n8nFetch(path: string, init: RequestInit = {}) {
  const { N8N_BASE_URL, N8N_API_KEY } = getApiSettings();
  const headers = { 
    ...(init.headers || {}), 
    'Authorization': `Bearer ${N8N_API_KEY}` 
  };
  return fetch(`${N8N_BASE_URL}${path}`, { ...init, headers });
}

async function apiRequest(url: string, options: RequestInit = {}) {
  const { LLM_PROVIDER } = getApiSettings();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'LLM_PROVIDER': LLM_PROVIDER,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
}

export async function chat(query: string, sessionId: string) {
  const { CHAT_URL } = getApiSettings();
  return apiRequest(CHAT_URL, {
    method: 'POST',
    body: JSON.stringify({ query, sessionId }),
  });
}

export async function template(sessionId: string, permitType: string, address: string, applicant: string) {
  const payload = { sessionId, permitType, address, applicant };
  const response = await n8nFetch('/webhook/permit-template', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Template request failed: ${response.statusText}`);
  }

  return response.json();
}

export async function toggleSource(sessionId: string, fileId: string, enabled: boolean) {
  return apiRequest('/api/chat/sources', {
    method: 'POST',
    body: JSON.stringify({ sessionId, fileId, enabled }),
  });
}

export async function saveLocation(sessionId: string, placeId: string, geojson: any) {
  return apiRequest('/api/chat/location', {
    method: 'POST',
    body: JSON.stringify({ sessionId, placeId, geojson }),
  });
}

export async function uploadFile(file: File, onProgress?: (progress: number) => void) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    const { N8N_BASE_URL, N8N_API_KEY } = getApiSettings();
    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', `${N8N_BASE_URL}/v1/files`);
    xhr.setRequestHeader('Authorization', `Bearer ${N8N_API_KEY}`);
    xhr.send(formData);
  });
}