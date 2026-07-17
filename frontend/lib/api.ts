import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
});

/**
 * Helper to construct FormData for requests.
 */
function createFormData(fields: Record<string, string | Blob | File | undefined>): FormData {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });
  return formData;
}

export async function startSession(): Promise<{ session_id: string }> {
  const response = await api.post('/session/start');
  return response.data;
}

export async function uploadRequirements(
  sessionId: string,
  file: File
): Promise<{ status: string; preview: string }> {
  const formData = createFormData({
    session_id: sessionId,
    file: file,
  });
  const response = await api.post('/upload/requirements', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function uploadPlatform(
  sessionId: string,
  inputType: 'text' | 'file' | 'url',
  value: string | File
): Promise<{ status: string; preview: string }> {
  const fields: Record<string, any> = {
    session_id: sessionId,
    input_type: inputType,
  };

  if (inputType === 'text') {
    fields.text_value = value as string;
  } else if (inputType === 'url') {
    fields.url_value = value as string;
  } else if (inputType === 'file') {
    fields.file = value as File;
  }

  const formData = createFormData(fields);
  const response = await api.post('/upload/platform', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function uploadRegulatory(
  sessionId: string,
  inputType: 'text' | 'file' | 'url',
  value: string | File
): Promise<{ status: string; preview: string }> {
  const fields: Record<string, any> = {
    session_id: sessionId,
    input_type: inputType,
  };

  if (inputType === 'text') {
    fields.text_value = value as string;
  } else if (inputType === 'url') {
    fields.url_value = value as string;
  } else if (inputType === 'file') {
    fields.file = value as File;
  }

  const formData = createFormData(fields);
  const response = await api.post('/upload/regulatory', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function classify(
  sessionId: string,
  rulesText: string
): Promise<{ rows: any[]; total_statements: number }> {
  const formData = createFormData({
    rules_text: rulesText,
  });
  const response = await api.post(`/classify/${sessionId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}
