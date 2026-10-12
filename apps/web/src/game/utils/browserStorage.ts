type StorageName = 'localStorage' | 'sessionStorage';
let warned = false;

export const storageWarning =
  'Trình duyệt hạn chế lưu dữ liệu. Bạn vẫn có thể chơi trong phiên này.';

function reportStorageError(error: unknown) {
  if (
    !(error instanceof DOMException) ||
    !['SecurityError', 'QuotaExceededError'].includes(error.name)
  )
    throw error;
  if (!warned) console.warn(storageWarning, error);
  warned = true;
}

export function readStoredValue(
  key: string,
  storage: StorageName = 'localStorage',
) {
  try {
    return window[storage].getItem(key);
  } catch (error) {
    reportStorageError(error);
    return null;
  }
}

export function writeStoredValue(
  key: string,
  value: string | null,
  storage: StorageName = 'localStorage',
) {
  try {
    if (value === null) window[storage].removeItem(key);
    else window[storage].setItem(key, value);
    return true;
  } catch (error) {
    reportStorageError(error);
    return false;
  }
}
