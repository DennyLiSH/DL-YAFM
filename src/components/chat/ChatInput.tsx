import { useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

export function ChatInput() {
  const [input, setInput] = useState('');
  const { addMessage, isLoading } = useChatStore();

  const handleSend = () => {
    if (!input.trim() || isLoading) return;

    addMessage('user', input.trim());
    const userInput = input.trim();
    setInput('');

    // Simple echo response (can be replaced with actual AI integration)
    setTimeout(() => {
      addMessage('assistant', `收到: "${userInput}"`);
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t p-4">
      <div className="flex gap-2">
        <Textarea
          placeholder="输入消息... (Shift+Enter 换行)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[60px] max-h-[120px] resize-none"
          disabled={isLoading}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          size="icon"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
