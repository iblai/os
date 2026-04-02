import { describe, it, expect } from 'vitest';
import {
  advancedTabsProperties,
  advancedTabs,
  translatePrompt,
  type AdvancedTab,
} from '../advanced-tab';

describe('advancedTabsProperties', () => {
  describe('chat tab', () => {
    it('should have correct display name', () => {
      expect(advancedTabsProperties.chat.display).toBe('Chat');
    });

    it('should have correct name', () => {
      expect(advancedTabsProperties.chat.name).toBe('chat');
    });

    it('should not show header', () => {
      expect(advancedTabsProperties.chat.showHeader).toBe(false);
    });

    it('should have 4 prompts', () => {
      expect(advancedTabsProperties.chat.prompts).toHaveLength(4);
    });

    it('should have static type prompts with icons', () => {
      advancedTabsProperties.chat.prompts.forEach((prompt) => {
        expect(prompt.type).toBe('static');
        expect(prompt.icon).toBeDefined();
        expect(prompt.summary).toBeDefined();
        expect(prompt.content).toBeDefined();
      });
    });

    it('should have prompts with summary equal to content', () => {
      advancedTabsProperties.chat.prompts.forEach((prompt) => {
        expect(prompt.summary).toBe(prompt.content);
      });
    });
  });

  describe('summarize tab', () => {
    it('should have correct display name', () => {
      expect(advancedTabsProperties.summarize.display).toBe('Summarize');
    });

    it('should have correct name', () => {
      expect(advancedTabsProperties.summarize.name).toBe('summarize');
    });

    it('should show header', () => {
      expect(advancedTabsProperties.summarize.showHeader).toBe(true);
    });

    it('should have 1 prompt', () => {
      expect(advancedTabsProperties.summarize.prompts).toHaveLength(1);
    });

    it('should have human type prompt', () => {
      const prompt = advancedTabsProperties.summarize.prompts[0];
      expect(prompt.type).toBe('human');
    });

    it('should have proactive prompt', () => {
      const prompt = advancedTabsProperties.summarize.prompts[0];
      expect(prompt.proactive).toBe(true);
    });

    it('should have hidden prompt', () => {
      const prompt = advancedTabsProperties.summarize.prompts[0];
      expect(prompt.hide).toBe(true);
    });

    it('should have summarization content', () => {
      const prompt = advancedTabsProperties.summarize.prompts[0];
      expect(prompt.content).toContain('Summarize');
      expect(prompt.content).toContain('core content');
    });
  });

  describe('translate tab', () => {
    it('should have correct display name', () => {
      expect(advancedTabsProperties.translate.display).toBe('Translate');
    });

    it('should have correct name', () => {
      expect(advancedTabsProperties.translate.name).toBe('translate');
    });

    it('should show header', () => {
      expect(advancedTabsProperties.translate.showHeader).toBe(true);
    });

    it('should have 1 prompt', () => {
      expect(advancedTabsProperties.translate.prompts).toHaveLength(1);
    });

    it('should have ai type prompt', () => {
      const prompt = advancedTabsProperties.translate.prompts[0];
      expect(prompt.type).toBe('ai');
    });

    it('should have translate tag', () => {
      const prompt = advancedTabsProperties.translate.prompts[0];
      expect(prompt.tag).toBe('translate');
    });

    it('should not hide the prompt', () => {
      const prompt = advancedTabsProperties.translate.prompts[0];
      expect(prompt.hide).toBe(false);
    });
  });

  describe('expand tab', () => {
    it('should have correct display name', () => {
      expect(advancedTabsProperties.expand.display).toBe('Expand');
    });

    it('should have correct name', () => {
      expect(advancedTabsProperties.expand.name).toBe('expand');
    });

    it('should show header', () => {
      expect(advancedTabsProperties.expand.showHeader).toBe(true);
    });

    it('should have 1 prompt', () => {
      expect(advancedTabsProperties.expand.prompts).toHaveLength(1);
    });

    it('should have human type prompt', () => {
      const prompt = advancedTabsProperties.expand.prompts[0];
      expect(prompt.type).toBe('human');
    });

    it('should have proactive prompt', () => {
      const prompt = advancedTabsProperties.expand.prompts[0];
      expect(prompt.proactive).toBe(true);
    });

    it('should have hidden prompt', () => {
      const prompt = advancedTabsProperties.expand.prompts[0];
      expect(prompt.hide).toBe(true);
    });

    it('should have expansion content', () => {
      const prompt = advancedTabsProperties.expand.prompts[0];
      expect(prompt.content).toContain('detailed explanation');
      expect(prompt.content).toContain('expand');
    });
  });
});

describe('advancedTabs', () => {
  it('should be an array', () => {
    expect(Array.isArray(advancedTabs)).toBe(true);
  });

  it('should have 4 tabs', () => {
    expect(advancedTabs).toHaveLength(4);
  });

  it('should contain all tab names', () => {
    expect(advancedTabs).toContain('chat');
    expect(advancedTabs).toContain('summarize');
    expect(advancedTabs).toContain('translate');
    expect(advancedTabs).toContain('expand');
  });

  it('should match the keys of advancedTabsProperties', () => {
    const propertyKeys = Object.keys(advancedTabsProperties);
    expect(advancedTabs).toHaveLength(propertyKeys.length);
    advancedTabs.forEach((tab) => {
      expect(propertyKeys).toContain(tab);
    });
  });
});

describe('translatePrompt', () => {
  it('should return a string', () => {
    const result = translatePrompt('Spanish');
    expect(typeof result).toBe('string');
  });

  it('should include the language in the prompt', () => {
    const language = 'French';
    const result = translatePrompt(language);
    expect(result).toContain(language);
  });

  it('should include translation instruction', () => {
    const result = translatePrompt('German');
    expect(result).toContain('translate');
  });

  it('should include reference to summarized content', () => {
    const result = translatePrompt('Japanese');
    expect(result).toContain('summarized content');
  });

  it('should work with various languages', () => {
    const languages = ['English', 'Spanish', 'Mandarin', 'Arabic', 'Hindi'];
    languages.forEach((language) => {
      const result = translatePrompt(language);
      expect(result).toContain(language);
    });
  });

  it('should return the exact expected format', () => {
    const result = translatePrompt('Italian');
    expect(result).toBe('Please translate the summarized content into Italian');
  });
});

describe('AdvancedTab type', () => {
  it('should allow valid tab keys', () => {
    const validTabs: AdvancedTab[] = [
      'chat',
      'summarize',
      'translate',
      'expand',
    ];
    validTabs.forEach((tab) => {
      expect(advancedTabsProperties[tab]).toBeDefined();
    });
  });

  it('should have all tabs with required properties', () => {
    const tabs: AdvancedTab[] = ['chat', 'summarize', 'translate', 'expand'];
    tabs.forEach((tab) => {
      const tabProps = advancedTabsProperties[tab];
      expect(tabProps.display).toBeDefined();
      expect(tabProps.name).toBeDefined();
      expect(typeof tabProps.showHeader).toBe('boolean');
      expect(Array.isArray(tabProps.prompts)).toBe(true);
    });
  });
});

describe('data integrity', () => {
  it('should have unique tab names', () => {
    const names = new Set(advancedTabs);
    expect(names.size).toBe(advancedTabs.length);
  });

  it('should have unique display names', () => {
    const displays = Object.values(advancedTabsProperties).map(
      (t) => t.display,
    );
    const uniqueDisplays = new Set(displays);
    expect(uniqueDisplays.size).toBe(displays.length);
  });

  it('should have name matching the object key', () => {
    Object.entries(advancedTabsProperties).forEach(([key, value]) => {
      expect(value.name).toBe(key);
    });
  });
});
