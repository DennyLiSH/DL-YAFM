import { create } from 'zustand';
import { configService, ChatMessage } from '@/services/configService';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  addMessage: (role: 'user' | 'assistant', content: string) => Promise<void>;
  clearMessages: () => Promise<void>;
  setSending: (sending: boolean) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  isLoading: true,
  isSending: false,
  isInitialized: false,

  initialize: async () => {
    try {
      const messages = await configService.getChatMessages();
      set({
        messages,
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      console.error('Failed to load chat messages:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  addMessage: async (role, content) => {
    try {
      const message = await configService.addChatMessage(role, content);
      set((state) => ({ messages: [...state.messages, message] }));
    } catch (error) {
      console.error('Failed to add message:', error);
    }
  },

  clearMessages: async () => {
    try {
      await configService.clearChatMessages();
      set({ messages: [] });
    } catch (error) {
      console.error('Failed to clear messages:', error);
    }
  },

  setSending: (sending) => set({ isSending: sending }),
}));
