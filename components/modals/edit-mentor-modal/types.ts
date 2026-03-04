export interface SystemPrompt {
  id: string;
  name: string;
  content: string;
}

export interface LLMModel {
  id: string;
  name: string;
  logo: string;
  provider: string;
}

export interface MentorFormData {
  name: string;
  description: string;
  category: string;
  isAnonymous: boolean;
  isFeatured: boolean;
  image?: string;
  systemPrompts: SystemPrompt[];
  proactivePrompt: string;
  webSearchTool: boolean;
  wikipediaSearchTool: boolean;
  moderationPrompt: boolean;
  safetyPrompt: boolean;
  moderationResponse: string;
  safetyResponse: string;
  systemPromptActive: boolean;
  proactivePromptActive: boolean;
  guidedPromptActive: boolean;
}
