import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import {
  getMenuUploadUrls,
  getCheckInUploadUrls,
  getShopUploadUrls,
  MAX_CHECKIN_PHOTOS,
  photoContentType,
  putPhotoToStorage,
  type UploadUrlRequest,
  type UploadUrlResponse,
} from '../api/photos';
import type { ApiResponse } from '../api/core/types';
import { TokenManager } from '../api/core/httpClient';
import { isApiRequestError } from '../api/core/apiError';
import { ErrorCodes } from '../utils/errorHandler';

const RATE_LIMIT_MESSAGE = ErrorCodes[429].message;

export interface UploadedPhoto {
  fileName: string;
  contentType: string;
  storageKey: string;
  size: number;
}

export interface UsePhotoUploadReturn {
  selectedFiles: File[];
  uploadingPhotos: boolean;
  error: string | null;
  setSelectedFiles: Dispatch<SetStateAction<File[]>>;
  handleFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  removeFile: (index: number) => void;
  uploadPhotos: () => Promise<UploadedPhoto[]>;
  clearFiles: () => void;
  clearError: () => void;
}

type GetUrls = (requests: UploadUrlRequest[]) => Promise<ApiResponse<UploadUrlResponse[]>>;

export function usePhotoUpload(options?: {
  getUrls?: GetUrls;
  maxFiles?: number;
}): UsePhotoUploadReturn {
  const getUrls = options?.getUrls ?? getShopUploadUrls;
  const maxFiles = options?.maxFiles;
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles((prev) => {
        const next = [...prev, ...files];
        return typeof maxFiles === 'number' ? next.slice(0, maxFiles) : next;
      });
      setError(null);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    setError(null);
  };

  const clearError = () => setError(null);

  const uploadPhotos = async (): Promise<UploadedPhoto[]> => {
    if (selectedFiles.length === 0) return [];

    const token = TokenManager.getAccessToken();
    if (!token) {
      throw new Error('Не авторизован');
    }

    setUploadingPhotos(true);
    setError(null);

    try {
      const uploadRequests = selectedFiles.map((file) => ({
        fileName: file.name,
        contentType: photoContentType(file),
        sizeBytes: file.size,
      }));

      let uploadUrlsResponse;
      try {
        uploadUrlsResponse = await getUrls(uploadRequests);
      } catch (err) {
        if (isApiRequestError(err) && err.status === 429) {
          setError(RATE_LIMIT_MESSAGE);
        }
        throw err;
      }

      if (!uploadUrlsResponse.success || !uploadUrlsResponse.data) {
        throw new Error('Ошибка при получении URL для загрузки');
      }

      const uploadPromises = selectedFiles.map(async (file, index) => {
        const { uploadUrl, storageKey } = uploadUrlsResponse.data[index];

        const uploadResponse = await putPhotoToStorage(uploadUrl, file);

        if (uploadResponse.status === 429) {
          setError(RATE_LIMIT_MESSAGE);
          throw new Error(RATE_LIMIT_MESSAGE);
        }

        if (!uploadResponse.ok) {
          throw new Error(`Ошибка загрузки файла ${file.name}`);
        }

        return {
          fileName: file.name,
          contentType: photoContentType(file),
          storageKey,
          size: file.size,
        };
      });

      return await Promise.all(uploadPromises);
    } finally {
      setUploadingPhotos(false);
    }
  };

  return {
    selectedFiles,
    uploadingPhotos,
    error,
    setSelectedFiles,
    handleFileSelect,
    removeFile,
    uploadPhotos,
    clearFiles,
    clearError,
  };
}

export function useMenuPhotoUpload(): UsePhotoUploadReturn {
  return usePhotoUpload({ getUrls: getMenuUploadUrls, maxFiles: 4 });
}

export function useCheckInPhotoUpload(): UsePhotoUploadReturn {
  return usePhotoUpload({ getUrls: getCheckInUploadUrls, maxFiles: MAX_CHECKIN_PHOTOS });
}
