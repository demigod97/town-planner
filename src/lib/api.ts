import { getSettings } from '@/hooks/useSettings';

// Get settings dynamically
function getApiSettings() {
  const settings = getSettings();
  return {
    CHAT_URL: settings.chatUrl,
    INGEST_URL: settings.ingestUrl,
    TEMPLATE_URL: settings.templateUrl,
    LLM_PROVIDER: settings.llmProvider,
  };
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
  const { TEMPLATE_URL } = getApiSettings();
  return apiRequest(TEMPLATE_URL, {
    method: 'POST',
    body: JSON.stringify({ sessionId, permitType, address, applicant }),
  });
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
  const { INGEST_URL, LLM_PROVIDER } = getApiSettings();
  
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

    xhr.open('POST', INGEST_URL);
    xhr.setRequestHeader('LLM_PROVIDER', LLM_PROVIDER);
    xhr.send(file);
  });
}