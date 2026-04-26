import React, { useEffect, useRef } from 'react';
import { Send, X } from 'lucide-react';

const TutorChatPanel = ({
  isOpen,
  onClose,
  messages,
  inputValue,
  onInputChange,
  onSend,
  isLoading,
  context,
  isDarkMode,
}) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const moduleTitle = context?.module;
  const subtitle = moduleTitle ? `Ask about: ${moduleTitle}` : 'Ask anything';

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close tutor panel overlay"
          className="fixed inset-0 z-40 bg-black/45 sm:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 right-0 h-full z-50 w-full sm:w-[420px] border-l shadow-2xl transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${
          isDarkMode
            ? 'bg-[#0b0b0d] border-white/10 text-white'
            : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        <div className={`h-full flex flex-col ${isDarkMode ? 'bg-[#0b0b0d]' : 'bg-white'}`}>
          <div
            className={`px-4 py-3 border-b flex items-start justify-between ${
              isDarkMode ? 'border-white/10' : 'border-gray-200'
            }`}
          >
            <div>
              <h3 className="text-base font-semibold">Tutor Assistant</h3>
              <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                isDarkMode ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
              }`}
              title="Close tutor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className={`text-sm leading-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Ask the tutor anything about your current lesson.
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      message.role === 'user'
                        ? isDarkMode
                          ? 'bg-indigo-500/25 border border-indigo-400/40 text-indigo-50'
                          : 'bg-indigo-100 border border-indigo-300 text-indigo-900'
                        : isDarkMode
                        ? 'bg-white/5 border border-white/10 text-gray-100'
                        : 'bg-gray-50 border border-gray-200 text-gray-900'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm border ${
                    isDarkMode
                      ? 'bg-white/5 border-white/10 text-gray-300'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                >
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className={`p-3 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your doubt..."
                disabled={isLoading}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none transition-colors disabled:opacity-60 ${
                  isDarkMode
                    ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-cyan-400/50'
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-cyan-500'
                }`}
              />
              <button
                type="button"
                onClick={onSend}
                disabled={isLoading || !inputValue.trim()}
                className="rounded-lg px-3 py-2 bg-gradient-to-r from-indigo-500 to-cyan-400 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default TutorChatPanel;
