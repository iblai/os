export const mockTranscripts = [
  {
    id: 1,
    message:
      'I want to know why your returns policy is absolutely terrible! I recently purchased a pair of shoes from your store, and they turned...',
    topics: [
      'Solar Energy',
      'Environmental Ethics',
      'Digital Literacy',
      'Civic Responsibility',
      'Space Exploration',
      'Historical Analysis',
    ],
    sentiment: 'negative',
    model: 'gpt-3.5-turbo-4k',
    userId: 'user_5041',
    studentName: 'John Smith',
    mentorName: 'AI Tutor',
    messageCount: 9,
    cost: 0.12,
    createdAt: '1 minute ago',
    suggestedTopics: true,
    fullTranscript: [
      {
        role: 'user',
        content:
          'I want to know why your returns policy is absolutely terrible! I recently purchased a pair of shoes from your store, and they turned out to be completely different from what was advertised.',
        timestamp: '2 minutes ago',
      },
      {
        role: 'assistant',
        content:
          'I understand your frustration with our returns policy, and I sincerely apologize for the disappointing experience with your shoe purchase. Let me help you resolve this issue.',
        timestamp: '2 minutes ago',
      },
      {
        role: 'user',
        content:
          "The shoes were supposed to be waterproof but they're not! And the color is completely wrong.",
        timestamp: '1 minute ago',
      },
    ],
  },
  {
    id: 2,
    message:
      "Can you help me understand calculus derivatives? I'm struggling with the chain rule and need some examples to practice with...",
    topics: [
      'Mathematics',
      'Calculus',
      'Chain Rule',
      'Derivatives',
      'Problem Solving',
    ],
    sentiment: 'neutral',
    model: 'gpt-4',
    userId: 'user_2847',
    studentName: 'Sarah Johnson',
    mentorName: 'Math Agent',
    messageCount: 15,
    cost: 0.24,
    createdAt: '5 minutes ago',
    suggestedTopics: false,
    fullTranscript: [
      {
        role: 'user',
        content:
          "Can you help me understand calculus derivatives? I'm struggling with the chain rule.",
        timestamp: '10 minutes ago',
      },
      {
        role: 'assistant',
        content:
          "I'd be happy to help you with derivatives and the chain rule! Let's start with the basics.",
        timestamp: '9 minutes ago',
      },
    ],
  },
  {
    id: 3,
    message:
      "What are the best practices for React component optimization? I'm working on a large application and performance is becoming an issue...",
    topics: [
      'React',
      'Performance',
      'Optimization',
      'JavaScript',
      'Web Development',
    ],
    sentiment: 'positive',
    model: 'gpt-3.5-turbo',
    userId: 'user_9123',
    studentName: 'Mike Chen',
    mentorName: 'Code Agent',
    messageCount: 22,
    cost: 0.18,
    createdAt: '10 minutes ago',
    suggestedTopics: true,
    fullTranscript: [],
  },
];
