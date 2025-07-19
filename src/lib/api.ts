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