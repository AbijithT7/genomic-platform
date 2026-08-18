import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 120000,
});

export async function uploadVcfFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('vcfFile', file);

  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  const data = response.data;
  // If backend returns patientId but not full patient object, fetch it
  if (data.patientId && !data.patient) {
    try {
      const patientData = await fetchPatient(data.patientId);
      data.patient = patientData;
    } catch (e) {
      console.warn('Failed to fetch patient after upload:', e);
    }
  }

  return data;
}

export async function analyzePatient(patientId) {
  const response = await api.post(`/analyze/${patientId}`);
  return response.data;
}

export async function fetchPatients() {
  const response = await api.get('/patients');
  return response.data;
}

export async function fetchPatient(patientId) {
  const response = await api.get(`/patients/${patientId}`);
  return response.data;
}

export async function fetchVariantsByPatient(patientId) {
  const response = await api.get('/variants', {
    params: { patientId },
  });
  return response.data;
}

export async function fetchEvidenceForVariant(variantId) {
  const response = await api.get(`/evidence/variant/${variantId}`);
  return response.data;
}

export async function clearAllPatients() {
  const response = await api.delete('/patients');
  return response.data;
}

export default api;
