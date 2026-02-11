
import React, { useState } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="p-4 bg-white border-t border-gray-200 flex items-center sticky bottom-0 z-10">
      <input
        type="text"
        className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
        placeholder={isLoading ? "Agent is typing..." : "Type your message..."}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={isLoading}
      />
      <button
        onClick={handleSend}
        className={`ml-3 px-6 py-3 rounded-lg text-white font-semibold transition-colors duration-200 ${
          input.trim() && !isLoading
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-blue-400 cursor-not-allowed'
        }`}
        disabled={!input.trim() || isLoading}
      >
        Send
      </button>
    </div>
  );
};

export default ChatInput;
