'use client';

import type React from 'react';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

export default function JobScoutPage() {
  const [, setSelectedPrompt] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>(
    [],
  );
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePromptClick = (prompt: string) => {
    setSelectedPrompt(prompt);
    setMessages([
      { role: 'user', content: prompt },
      {
        role: 'assistant',
        content: "I'm thinking about your question regarding " + prompt.toLowerCase() + ' ...',
      },
    ]);
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      let response = '';
      if (prompt.includes('presentation skills')) {
        response =
          "Improving presentation skills is a great goal! Here are some tips:\n\n1. Practice regularly - even if it's just in front of a mirror\n2. Record yourself and review the footage\n3. Join groups like Toastmasters\n4. Focus on body language and vocal variety\n5. Use storytelling techniques to engage your audience\n\nWould you like more specific advice on any of these areas?";
      } else if (prompt.includes('advocate with my manager')) {
        response =
          "Advocating for a promotion requires preparation and strategy. Here's how to approach it:\n\n1. Document your achievements and contributions\n2. Research comparable roles and salary ranges\n3. Tie your accomplishments to business outcomes\n4. Choose the right timing for the conversation\n5. Practice your talking points beforehand\n\nWould you like me to help you prepare specific talking points?";
      } else if (prompt.includes('job interview')) {
        response =
          'Preparing for behavioral interviews is crucial! The STAR method can help structure your answers:\n\n- Situation: Describe the context\n- Task: Explain your responsibility\n- Action: Detail the steps you took\n- Result: Share the outcome\n\nCommon behavioral questions include:\n- Tell me about a time you faced a challenge\n- Describe a situation where you showed leadership\n- Share an example of resolving a conflict\n\nWould you like to practice with some sample questions?';
      } else if (prompt.includes('find a mentor')) {
        response =
          "Finding a mentor can significantly accelerate your career growth. Here's how to approach it:\n\n1. Identify what you want to learn and develop\n2. Look within your organization first\n3. Attend industry events and networking opportunities\n4. Consider professional associations in your field\n5. Don't limit yourself to just one mentor\n\nWhen approaching potential mentors, be specific about what you admire about their work and what you hope to learn.";
      }

      setMessages([
        { role: 'user', content: prompt },
        { role: 'assistant', content: response },
      ]);
      setIsLoading(false);
    }, 1500);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const newMessages = [...messages, { role: 'user' as const, content: inputValue }];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      setMessages([
        ...newMessages,
        {
          role: 'assistant' as const,
          content:
            "Thank you for your follow-up question. I'm here to help with more specific advice about your career development. Could you provide more details about your situation so I can give you more tailored guidance?",
        },
      ]);
      setIsLoading(false);
    }, 1500);
  };

  const suggestionCards = [
    {
      id: 1,
      text: "I'd like to improve my presentation skills.",
    },
    {
      id: 2,
      text: 'Help me figure out how to advocate with my manager for a promotion.',
    },
    {
      id: 3,
      text: 'How do I prepare for a job interview with behavioral questions?',
    },
    {
      id: 4,
      text: 'Give me advice on how to find a mentor.',
    },
  ];

  const recentActivities = [
    {
      id: 1,
      title: 'Improving Presentation Skills',
    },
    {
      id: 2,
      title: 'Career Guidance Offered',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <div className="mx-auto max-w-4xl p-4 md:p-6">
        {messages.length === 0 ? (
          <>
            <div className="mb-8 flex items-start gap-4">
              <Avatar className="h-14 w-14 border-2 border-amber-400">
                <AvatarImage
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202025-03-07%20at%2018.22.00-3usAlQ4ctrcMPSnZcXBJdR0PtVg6QF.png"
                  alt="AI Job Scout Assistant"
                />
                <AvatarFallback className="bg-amber-400 text-white">AI</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  AI Job Scout Assistant • Careers
                </h1>
                <p className="mt-1 text-gray-600">
                  Hello! I&apos;m your AI Job Scout Assistant, here to help you find job
                  opportunities. What type of job are you interested in exploring today?
                </p>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              {suggestionCards.map((card) => (
                <button
                  key={card.id}
                  className="flex h-full flex-col justify-start rounded-lg bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50"
                  onClick={() => handlePromptClick(card.text)}
                >
                  <p className="text-sm text-gray-700">{card.text}</p>
                </button>
              ))}
            </div>

            <div>
              <h2 className="mb-3 text-sm font-medium text-gray-500">Recent</h2>
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202025-03-07%20at%2018.22.00-3usAlQ4ctrcMPSnZcXBJdR0PtVg6QF.png"
                        alt="AI Job Scout Assistant"
                      />
                      <AvatarFallback className="bg-amber-400 text-white">AI</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-gray-700">{activity.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-[80vh] flex-col rounded-lg bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b p-4">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202025-03-07%20at%2018.22.00-3usAlQ4ctrcMPSnZcXBJdR0PtVg6QF.png"
                  alt="AI Job Scout Assistant"
                />
                <AvatarFallback className="bg-amber-400 text-white">AI</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-medium text-gray-800">AI Job Scout Assistant</h2>
                <p className="text-xs text-gray-500">Careers</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  setMessages([]);
                  setSelectedPrompt(null);
                }}
              >
                New Chat
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="mt-1 mr-2 h-8 w-8 flex-shrink-0">
                      <AvatarImage
                        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202025-03-07%20at%2018.22.00-3usAlQ4ctrcMPSnZcXBJdR0PtVg6QF.png"
                        alt="AI Job Scout Assistant"
                      />
                      <AvatarFallback className="bg-amber-400 text-white">AI</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="whitespace-pre-line">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <Avatar className="mt-1 mr-2 h-8 w-8 flex-shrink-0">
                    <AvatarImage
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202025-03-07%20at%2018.22.00-3usAlQ4ctrcMPSnZcXBJdR0PtVg6QF.png"
                      alt="AI Job Scout Assistant"
                    />
                    <AvatarFallback className="bg-amber-400 text-white">AI</AvatarFallback>
                  </Avatar>
                  <div className="max-w-[80%] rounded-lg bg-gray-100 p-3 text-gray-800">
                    <div className="flex space-x-2">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400"></div>
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: '0.2s' }}
                      ></div>
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: '0.4s' }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t p-4">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                  autoComplete="off"
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !inputValue.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
