import { ExpenseCategory } from "../types";
import { Capacitor } from "@capacitor/core";

export const fileToGenerativePart = async (file: File | Blob): Promise<{ mimeType: string; data: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      let mimeType = file.type;
      if (!mimeType && file instanceof File) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') mimeType = 'application/pdf';
        else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
        else if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'webp') mimeType = 'image/webp';
        else mimeType = 'image/jpeg';
      }
      resolve({ mimeType: mimeType || 'image/jpeg', data: base64String });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const extractInvoiceData = async (file: File | Blob) => {
  try {
    const filePart = await fileToGenerativePart(file);

    // Use relative path for web (to same origin) and absolute path for mobile
    const API_BASE_URL = Capacitor.isNativePlatform() ? (process.env.VITE_API_URL || '') : '';
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: filePart.data,
        mimeType: filePart.mimeType
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown server error' }));
      throw new Error(err.error || response.statusText);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Error calling Analysis API:", error);
    // Include more details if it's a fetch error to help identify CORS issues
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      console.error("This is likely a CORS or connection error. Ensure VITE_API_URL is correct and backend allows requests from mobile Origins.");
    }
    throw error;
  }
};
