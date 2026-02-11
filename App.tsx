
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatInput from './components/ChatInput';
import ChatMessage from './components/ChatMessage';
import LoadingSpinner from './components/LoadingSpinner';
import { ReservationAgentService } from './services/geminiService';
import { Message, FunctionCallMessage, ToolResponseMessage } from './types';

// Declare a global type for window.aistudio if it exists
declare global {
  // Moved AIStudio interface definition here to ensure a single global declaration
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const agentServiceRef = useRef<ReservationAgentService | null>(null);

  // Function to scroll to the bottom of the chat
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Initialize or re-initialize the agent service
  const initializeAgentService = useCallback(() => {
    try {
      // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key from the dialog.
      // Do not create GoogleGenAI when the component is first rendered.
      agentServiceRef.current = new ReservationAgentService();
      console.log("ReservationAgentService initialized.");
    } catch (error: any) {
      console.error("Failed to initialize ReservationAgentService:", error);
      setMessages(prev => [...prev, {
        id: `sys-err-${Date.now()}`,
        sender: 'system',
        text: `Error initializing agent: ${error.message}. Please check your API key or environment setup.`
      }]);
    }
  }, []);

  // Check API key on component mount
  useEffect(() => {
    const checkApiKey = async () => {
      // Use `await window.aistudio.hasSelectedApiKey()` to check whether an API key has been selected.
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const keySelected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(keySelected);
        if (keySelected) {
          initializeAgentService();
        } else {
          setMessages(prev => [...prev, {
            id: 'sys-welcome',
            sender: 'system',
            text: 'Welcome! Please select your API key to start using the Reservation Agent.'
          }]);
        }
      } else {
        // Fallback for environments without window.aistudio
        // Assume API_KEY is set via process.env for local development
        if (process.env.API_KEY) {
          setHasApiKey(true);
          initializeAgentService();
        } else {
          setMessages(prev => [...prev, {
            id: 'sys-fallback-warn',
            sender: 'system',
            text: 'Warning: Running in an environment without `window.aistudio` and `process.env.API_KEY` is not set. Please ensure `API_KEY` is configured.'
          }]);
          console.warn("window.aistudio not available and process.env.API_KEY not set. Cannot proceed.");
        }
      }
    };
    checkApiKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSelectApiKey = async () => {
    // If not, add a button which calls `await window.aistudio.openSelectKey()` to open a dialog for the user to select their API key.
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      try {
        await window.aistudio.openSelectKey();
        // Assume key selection was successful to mitigate race condition
        // If the request fails with an error message containing "Requested entity was not found.",
        // reset the key selection state and prompt the user to select a key again via `openSelectKey()`.
        setHasApiKey(true);
        // Re-initialize agent service with the potentially new API key
        // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key from the dialog.
        // Do not create GoogleGenAI when the component is first rendered.
        initializeAgentService();
        setMessages(prev => [...prev, {
          id: `sys-key-selected-${Date.now()}`,
          sender: 'system',
          text: 'API key selected. You can now chat with the Reservation Agent.'
        }]);
      } catch (error) {
        console.error("Error selecting API key:", error);
        setMessages(prev => [...prev, {
          id: `sys-key-error-${Date.now()}`,
          sender: 'system',
          text: 'Failed to select API key. Please try again.'
        }]);
      }
    } else {
      setMessages(prev => [...prev, {
        id: `sys-key-na-${Date.now()}`,
        sender: 'system',
        text: 'API key selection is not available in this environment. Ensure `process.env.API_KEY` is set.'
      }]);
    }
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!agentServiceRef.current) {
      setMessages(prev => [...prev, { id: `err-${Date.now()}`, sender: 'system', text: 'Reservation agent not initialized. Please refresh or select API key.' }]);
      return;
    }

    const userMessage: Message = { id: `user-${Date.now()}`, sender: 'user', text };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setIsLoading(true);

    try {
      const response = await agentServiceRef.current.sendMessage(text);

      const newMessages: Message[] = [];
      if (response.functionCalls && response.functionCalls.length > 0) {
        response.functionCalls.forEach((fc: FunctionCallMessage) => {
          newMessages.push({
            id: fc.id,
            sender: 'tool',
            text: `Tool Call: \`${fc.functionCall.name}(${JSON.stringify(fc.functionCall.args)})\``,
            isMarkdown: true
          });
        });
      }
      if (response.toolResponses && response.toolResponses.length > 0) {
        response.toolResponses.forEach((tr: ToolResponseMessage) => {
          newMessages.push({
            id: tr.id,
            sender: 'tool',
            text: `Tool Response: \`${tr.toolResponse.name}\` returned \`${JSON.stringify(tr.toolResponse.result)}\``,
            isMarkdown: true
          });
        });
      }

      newMessages.push({ id: `agent-${Date.now()}`, sender: 'agent', text: response.text, isMarkdown: true });
      setMessages(prevMessages => [...prevMessages, ...newMessages]);

    } catch (error: any) {
      console.error("Error sending message to Gemini:", error);
      // If the request fails with an error message containing "Requested entity was not found.",
      // reset the key selection state and prompt the user to select a key again via `openSelectKey()`.
      if (error.message && error.message.includes("Requested entity was not found.")) {
        // This is a common error when API key is invalid or permissions are wrong
        setMessages(prevMessages => [...prevMessages, {
          id: `error-${Date.now()}`,
          sender: 'system',
          text: `An API error occurred. This might be due to an invalid or unbilled API key. Please select your API key again.`,
          isMarkdown: false
        }]);
        // Reset hasApiKey to prompt user to re-select
        setHasApiKey(false);
      } else {
        setMessages(prevMessages => [...prevMessages, {
          id: `error-${Date.now()}`,
          sender: 'system',
          text: `An unexpected error occurred: ${error.message}`,
          isMarkdown: false
        }]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array, functions inside useCallback should not depend on state that changes frequently.

  return (
    <div className="flex flex-col h-[90vh] sm:h-[80vh] w-full max-w-2xl bg-white rounded-lg shadow-xl border border-gray-200">
      <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-t-lg shadow-md">
        <h1 className="text-2xl font-bold text-center">Reservation Agent</h1>
      </div>

      <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && <LoadingSpinner />}
        <div ref={messagesEndRef} />
      </div>

      {!hasApiKey && (
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col items-center">
          <p className="text-gray-700 mb-3 text-center">
            To use the Reservation Agent, please select your API key from a paid GCP project.
          </p>
          <button
            onClick={handleSelectApiKey}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors duration-200 shadow-md"
          >
            Select API Key
          </button>
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline mt-2 text-sm"
          >
            Billing Information
          </a>
        </div>
      )}

      {hasApiKey && (
        <ChatInput onSendMessage={sendMessage} isLoading={isLoading} />
      )}
    </div>
  );
}

export default App;