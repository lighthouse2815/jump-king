let blocked = false;

export function readGamepads(): (Gamepad | null)[] {
  if (blocked) return [];
  try {
    return navigator.getGamepads?.() || [];
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'SecurityError')
      throw error;
    blocked = true;
    console.warn('Trình duyệt không cho phép dùng tay cầm.', error);
    return [];
  }
}
