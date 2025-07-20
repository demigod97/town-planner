import { getSettings } from "@/hooks/useSettings";

// Supabase proxy base URL
const PROXY_BASE = '/functions/v1/proxy';

async function proxyRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${PROXY_BASE}/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

// Helper function to add n8n authorization
const authed = (headers: Record<string, string> = {}) => {
  const { n8nApiKey } = getSettings();
  return { ...headers, 'authorization': n8nApiKey };
};

// Direct n8n chat endpoint
export async function sendChat(sessionId: string, question: string) {
  const { chatUrl } = getSettings();
  return fetch(chatUrl, {
    method: 'POST',
    headers: authed({ 'content-type': 'application/json' }),
    body: JSON.stringify({ sessionId, question })
  }).then(r => r.json());
}

// Direct n8n ingest endpoint  
export async function ingestPDF({ source_id, file_url, file_path }: { source_id: string, file_url: string, file_path: string }) {
  const { ingestUrl } = getSettings();
  return fetch(ingestUrl, {
    method: 'POST',
    headers: authed({ 'content-type': 'application/json' }),
    body: JSON.stringify({ source_id, file_url, file_path, source_type: 'pdf', callback_url: '' })
  });
}

// Direct n8n template endpoint
export async function genTemplate(params: any) {
  const { templateUrl } = getSettings();
  return fetch(templateUrl, {
    method: 'POST',
    headers: authed({ 'content-type': 'application/json' }),
    body: JSON.stringify(params)
  }).then(r => r.json());
}

// Legacy proxy functions (keeping for backward compatibility)
export async function chat(query: string, sessionId: string) {
  return proxyRequest('chat', {
    method: 'POST',
    body: JSON.stringify({ query, sessionId }),
  });
}

export async function template(sessionId: string, permitType: string, address: string, applicant: string) {
  const payload = { sessionId, permitType, address, applicant };
  return proxyRequest('template', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function toggleSource(sessionId: string, fileId: string, enabled: boolean) {
  return proxyRequest('chat/sources', {
    method: 'POST',
    body: JSON.stringify({ sessionId, fileId, enabled }),
  });
}

export async function saveLocation(sessionId: string, placeId: string, geojson: any) {
  return proxyRequest('chat/location', {
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
        reject(new Error(xhr.responseText || 'Upload failed'));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', `${PROXY_BASE}/n8n/v1/files`);
    xhr.send(formData);
  });
}