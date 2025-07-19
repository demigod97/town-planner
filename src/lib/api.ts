const API_BASE = import.meta.env.VITE_N8N_CHAT_WEBHOOK;
const LLM_PROVIDER = import.meta.env.VITE_LLM_PROVIDER || 'OPENAI';

async function apiRequest(url: string, options: RequestInit = {}) {
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
  return apiRequest(API_BASE, {
    method: 'POST',
    body: JSON.stringify({ query, sessionId }),
  });
}

export async function template(sessionId: string, permitType: string, address: string, applicant: string) {
  return apiRequest('/api/template', {
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

export async function uploadFile(file: File) {
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: file,
    headers: {
      'LLM_PROVIDER': LLM_PROVIDER,
    },
  });
  
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.statusText}`);
  }
  
  return res.json();
}