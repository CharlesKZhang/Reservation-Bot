
import React from 'react';
import { Message } from '../types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  const isTool = message.sender === 'tool';
  const isSystem = message.sender === 'system';

  const containerClasses = isUser
    ? 'flex justify-end'
    : 'flex justify-start';

  const bubbleClasses = isUser
    ? 'bg-blue-500 text-white rounded-br-none'
    : isTool
      ? 'bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-lg'
      : isSystem
        ? 'bg-red-100 text-red-800 border border-red-300 rounded-lg'
        : 'bg-gray-200 text-gray-800 rounded-bl-none';

  return (
    <div className={`mb-4 ${containerClasses}`}>
      <div className={`p-3 max-w-[80%] rounded-lg shadow-md ${bubbleClasses}`}>
        {message.isMarkdown ? (
          <Markdown remarkPlugins={[remarkGfm]}>
            {message.text}
          </Markdown>
        ) : (
          message.text
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
