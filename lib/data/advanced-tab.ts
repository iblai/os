import { CheckCircle, HelpCircle, List, Target } from 'lucide-react';

export const advancedTabsProperties = {
  chat: {
    display: 'Chat',
    name: 'chat',
    showHeader: false,
    prompts: [
      {
        type: 'static',
        icon: HelpCircle,
        summary: 'Ask questions to clarify material and stay on track',
        content: 'Ask questions to clarify material and stay on track',
      },
      {
        type: 'static',
        icon: List,
        summary: 'Summarize key takeaways for better note-taking',
        content: 'Summarize key takeaways for better note-taking',
      },
      {
        type: 'static',
        icon: CheckCircle,
        summary:
          'Practice for quizzes and tests to solidify knowledge and identify gaps',
        content:
          'Practice for quizzes and tests to solidify knowledge and identify gaps',
      },
      {
        type: 'static',
        icon: Target,
        summary: 'Explore how is learning aligned with current or future goals',
        content: 'Explore how is learning aligned with current or future goals',
      },
    ],
  },
  summarize: {
    display: 'Summarize',
    showHeader: true,
    name: 'summarize',
    prompts: [
      {
        type: 'human',
        proactive: true,
        hide: true,
        content:
          'Summarize the core content of this webpage, focusing on the main ideas, key details, and actionable insights. Ignore any placeholder messages, instructions about enabling JavaScript, or irrelevant sections like headers, footers, ads, or navigation menus. Provide the summary in bullet points or concise paragraphs, prioritizing educational or instructional material if available.',
      },
    ],
  },
  translate: {
    display: 'Translate',
    showHeader: true,
    name: 'translate',
    prompts: [
      {
        type: 'ai',
        hide: false,
        tag: 'translate',
      },
    ],
  },
  expand: {
    display: 'Expand',
    showHeader: true,
    name: 'expand',
    prompts: [
      {
        type: 'human',
        proactive: true,
        hide: true,
        content:
          'For each key idea, provide a detailed explanation, include relevant examples, and expand with additional insights to make the content more comprehensive and engaging. Focus on meaningful and relevant information, and avoid elaborating on placeholder messages, technical notices, or irrelevant sections like headers, footers, ads, or navigation menus.',
      },
    ],
  },
};

export const advancedTabs = Object.keys(advancedTabsProperties).map((tab) => {
  const tabProperties = advancedTabsProperties[tab as AdvancedTab];
  return tabProperties.name as AdvancedTab;
});

export type AdvancedTab = keyof typeof advancedTabsProperties;

export const translatePrompt = (language: string) =>
  `Please translate the summarized content into ${language}`;
