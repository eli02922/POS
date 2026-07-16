const defaultHeaders = {
  'Content-Type': 'application/json'
};

export const apiRequest = async (path, { method = 'GET', token, body } = {}) => {
  const response = await fetch(path, {
    method,
    headers: {
      ...defaultHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
};