export const CHAT_MAX_LENGTH = 200;
export const CHAT_HISTORY_LIMIT = 50;
export const CHAT_COOLDOWN_MS = 1000;

export interface ChatMessage {
  id: number;
  sessionId: string;
  nickname: string;
  text: string;
  sentAt: number;
}
