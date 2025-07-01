import {
  FileResponse,
  FileNodesResponse,
  FileImageResponse,
  FileStylesResponse,
  FileComponentSetsResponse,
  FileComponentsResponse,
} from "../../../types/figma";

const BASE_URL = "https://api.figma.com/v1/";

let counter = 0;

export const getFile = async (fileId: string, accessToken: string): Promise<{ data: FileResponse }> => {
  counter++;
  const headers = getFigmaAuthHeaders(accessToken);
  const response = await fetch(`${BASE_URL}files/${fileId}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json() as FileResponse;
  return { data };
};

/**
 * Fetch the frontend components
 * @param fileId
 * @param accessToken
 * @returns Promise<{ data: FileComponentsResponse }>
 */
export const getFileComponent = async (fileId: string, accessToken: string): Promise<{ data: FileComponentsResponse }> => {
  counter++;
  const headers = getFigmaAuthHeaders(accessToken);
  const response = await fetch(`${BASE_URL}files/${fileId}/components`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json() as FileComponentsResponse;
  return { data };
};

export const getFileNodes = async (
  fileId: string,
  ids: string[],
  accessToken: string
): Promise<{ data: FileNodesResponse }> => {
  counter++;
  const headers = getFigmaAuthHeaders(accessToken);
  const response = await fetch(`${BASE_URL}files/${fileId}/nodes?ids=${ids.join(",")}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json() as FileNodesResponse;
  return { data };
};

export const getAssetURL = async (
  fileId: string,
  ids: string[],
  extension: string,
  accessToken: string
): Promise<{ data: FileImageResponse }> => {
  counter++;
  const headers = getFigmaAuthHeaders(accessToken);
  const response = await fetch(`${BASE_URL}images/${fileId}/?ids=${ids.join(",")}&format=${extension}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json() as FileImageResponse;
  return { data };
};

export const getFileStyles = async (fileId: string, accessToken: string): Promise<{ data: FileStylesResponse }> => {
  counter++;
  const headers = getFigmaAuthHeaders(accessToken);
  const response = await fetch(`${BASE_URL}files/${fileId}/styles`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json() as FileStylesResponse;
  return { data };
};

export const getComponentSets = async (fileId: string, accessToken: string): Promise<{ data: FileComponentSetsResponse }> => {
  counter++;
  const headers = getFigmaAuthHeaders(accessToken);
  const response = await fetch(`${BASE_URL}files/${fileId}/component_sets`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json() as FileComponentSetsResponse;
  return { data };
};

export const getComponentSetNodes = async (
  fileId: string,
  ids: string[],
  accessToken: string
): Promise<{ data: FileNodesResponse }> => {
  counter++;
  const headers = getFigmaAuthHeaders(accessToken);
  const response = await fetch(`${BASE_URL}files/${fileId}/nodes?ids=${ids.join(",")}&plugin_data=shared`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json() as FileNodesResponse;
  return { data };
};

export const getRequestCount = () => counter;

const getFigmaAuthHeaders = (
  accessToken: string
): Record<string, string> =>
  accessToken.startsWith("Bearer ")
    ? { Authorization: accessToken }
    : { "X-Figma-Token": accessToken };
