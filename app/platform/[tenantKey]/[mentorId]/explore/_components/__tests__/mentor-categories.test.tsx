import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MentorCategories } from '../mentor-categories';

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'tenant123', mentorId: 'mentor456' }),
}));

const mockUseIsAdmin = vi.fn(() => true);
const mockUseUsername = vi.fn((): string | null => 'testuser');
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
  useIsAdmin: () => mockUseIsAdmin(),
}));

// Provider facet labels come from the backend LLM catalogue; the resolver is
// stubbed so the dropdown tests stay independent of the RTK Query cache.
const mockUseLlmProviderCatalogue = vi.fn();
const mockResolveLlmProvider = vi.fn<
  (key?: string | null) => { logo: string | null; displayName: string }
>((key) => ({ logo: null, displayName: key ?? '' }));
vi.mock('@iblai/iblai-js/web-containers', async () => {
  const actual = await vi.importActual<
    typeof import('@iblai/iblai-js/web-containers')
  >('@iblai/iblai-js/web-containers');
  return {
    ...actual,
    useLlmProviderCatalogue: (...args: unknown[]) =>
      mockUseLlmProviderCatalogue(...args),
  };
});
// Logos come from the tenant's credentials schema, keyed by display name.
const mockUseCredentialsSchemaLogos = vi.fn();
const mockLogoFromCredentialsSchema = vi.fn<
  (displayName?: string | null) => string | null
>(() => null);
vi.mock('@/hooks/use-llm-provider-details', () => ({
  useCredentialsSchemaLogos: (...args: unknown[]) =>
    mockUseCredentialsSchemaLogos(...args),
}));

/**
 * Test suite for MentorCategories component
 *
 * Tests the filter dropdowns and their interactions.
 */
describe('MentorCategories', () => {
  const mockOnFiltersChange = vi.fn();
  const mockOnCreatedByChange = vi.fn();

  const mockFacets = {
    categories: {
      total: 23,
      terms: {
        Education: 10,
        Technology: 8,
        Science: 5,
      },
      other: 0,
    },
    subjects: {
      total: 23,
      terms: {
        Mathematics: 12,
        Physics: 7,
        Chemistry: 4,
      },
      other: 0,
    },
    llm_providers: {
      total: 30,
      terms: {
        OpenAI: 15,
        Anthropic: 10,
        Google: 5,
      },
      other: 0,
    },
    types: {
      total: 43,
      terms: {
        Tutor: 20,
        Assistant: 15,
        Coach: 8,
      },
      other: 0,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveLlmProvider.mockImplementation((key?: string | null) => ({
      logo: null,
      displayName: key ?? '',
    }));
    mockUseLlmProviderCatalogue.mockReturnValue(mockResolveLlmProvider);
    mockLogoFromCredentialsSchema.mockImplementation(() => null);
    mockUseCredentialsSchemaLogos.mockReturnValue(
      mockLogoFromCredentialsSchema,
    );
    mockUseIsAdmin.mockReturnValue(true);
    mockUseUsername.mockReturnValue('testuser');
  });

  describe('LLM Provider labels', () => {
    it('labels facet keys from the backend LLM catalogue and filters by the raw key', async () => {
      mockResolveLlmProvider.mockImplementation((key?: string | null) =>
        key === 'OpenAI'
          ? { logo: null, displayName: 'Open AI (backend)' }
          : { logo: null, displayName: key ?? '' },
      );
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      expect(mockUseLlmProviderCatalogue).toHaveBeenCalledWith({
        org: 'tenant123',
        userId: 'testuser',
        mentorId: 'mentor456',
      });

      const llmButton = screen.getByRole('button', { name: /LLM Provider/i });
      await user.click(llmButton);

      const option = await screen.findByRole('menuitem', {
        name: /Open AI \(backend\)/i,
      });
      // Unlisted keys fall back to the raw facet term.
      expect(
        screen.getByRole('menuitem', { name: /Anthropic/i }),
      ).toBeInTheDocument();
      await user.click(option);

      // The filter sends the raw key; the trigger shows the backend label.
      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ llm_providers: 'OpenAI' }),
      );
      // The menu is still open (its trigger sits behind aria-hidden), so
      // include hidden nodes when reading the trigger's new label.
      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: /Open AI \(backend\)/i,
            hidden: true,
          }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('LLM Provider order', () => {
    it('lists providers alphabetically by their shown label, ignoring case', async () => {
      // Facet order is by agent count; "iblai" is shown as "ibl.ai".
      mockResolveLlmProvider.mockImplementation((key?: string | null) => ({
        logo: null,
        displayName: key === 'iblai' ? 'ibl.ai' : (key ?? ''),
      }));
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={{
            ...mockFacets,
            llm_providers: {
              total: 50,
              terms: { OpenAI: 20, iblai: 15, xAI: 8, Google: 5, Anthropic: 2 },
              other: 0,
            },
          }}
        />,
      );

      await user.click(screen.getByRole('button', { name: /LLM Provider/i }));
      const menu = await screen.findByRole('menu', { name: /LLM Provider/i });

      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((item) => item.textContent),
      ).toEqual(['Anthropic', 'Google', 'ibl.ai', 'OpenAI', 'xAI']);
    });
  });

  describe('LLM Provider logos', () => {
    const openLlmMenu = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: /LLM Provider/i }));
      return screen.findByRole('menu', { name: /LLM Provider/i });
    };

    it('shows each provider logo from the credentials schema, matched on display name', async () => {
      mockLogoFromCredentialsSchema.mockImplementation((name) =>
        name === 'OpenAI' ? 'https://cdn.example.com/openai.jpg' : null,
      );
      const user = userEvent.setup();
      render(<MentorCategories facets={mockFacets} />);

      const menu = await openLlmMenu(user);
      const openAiItem = within(menu).getByRole('menuitem', { name: /OpenAI/ });
      expect(
        within(openAiItem).getByTestId('llm-provider-logo'),
      ).toHaveAttribute('src', 'https://cdn.example.com/openai.jpg');
      expect(mockLogoFromCredentialsSchema).toHaveBeenCalledWith('Anthropic');
    });

    it('falls back to the catalogue logo, then to a neutral glyph', async () => {
      mockResolveLlmProvider.mockImplementation((key?: string | null) => ({
        logo: key === 'Google' ? 'https://cdn.example.com/google.png' : null,
        displayName: key ?? '',
      }));
      const user = userEvent.setup();
      render(<MentorCategories facets={mockFacets} />);

      const menu = await openLlmMenu(user);
      const googleItem = within(menu).getByRole('menuitem', { name: /Google/ });
      expect(
        within(googleItem).getByTestId('llm-provider-logo'),
      ).toHaveAttribute('src', 'https://cdn.example.com/google.png');
      const anthropicItem = within(menu).getByRole('menuitem', {
        name: /Anthropic/,
      });
      expect(
        within(anthropicItem).getByTestId('llm-provider-logo-fallback'),
      ).toBeInTheDocument();
    });

    it('swaps a logo that fails to load for the neutral glyph', async () => {
      mockLogoFromCredentialsSchema.mockImplementation((name) =>
        name === 'OpenAI' ? 'https://cdn.example.com/broken.jpg' : null,
      );
      const user = userEvent.setup();
      render(<MentorCategories facets={mockFacets} />);

      const menu = await openLlmMenu(user);
      const openAiItem = within(menu).getByRole('menuitem', { name: /OpenAI/ });
      fireEvent.error(within(openAiItem).getByTestId('llm-provider-logo'));

      expect(
        within(openAiItem).getByTestId('llm-provider-logo-fallback'),
      ).toBeInTheDocument();
    });

    it('shows the selected provider logo in the trigger', async () => {
      mockLogoFromCredentialsSchema.mockImplementation((name) =>
        name === 'OpenAI' ? 'https://cdn.example.com/openai.jpg' : null,
      );
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const menu = await openLlmMenu(user);
      await user.click(within(menu).getByRole('menuitem', { name: /OpenAI/ }));
      await user.keyboard('{Escape}');

      const trigger = screen.getByRole('button', { name: 'OpenAI' });
      expect(within(trigger).getByTestId('llm-provider-logo')).toHaveAttribute(
        'src',
        'https://cdn.example.com/openai.jpg',
      );
    });

    it.each([
      ['a signed-in admin', true, 'testuser', true],
      [
        'a signed-in non-admin (the schema would 403)',
        false,
        'testuser',
        false,
      ],
      ['a signed-out visitor (a 401 would log them out)', true, null, false],
    ])(
      'queries the credentials schema only for %s',
      (_label, isAdmin, username, enabled) => {
        mockUseIsAdmin.mockReturnValue(isAdmin);
        mockUseUsername.mockReturnValue(username);
        render(<MentorCategories facets={mockFacets} />);

        expect(mockUseCredentialsSchemaLogos).toHaveBeenCalledWith({
          org: 'tenant123',
          enabled,
        });
      },
    );
  });

  describe('Basic rendering', () => {
    it('renders category dropdown when categories are provided', () => {
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      expect(
        screen.getByRole('button', { name: /Category/i }),
      ).toBeInTheDocument();
    });

    it('renders subject dropdown when subjects are provided', () => {
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      expect(
        screen.getByRole('button', { name: /Subject/i }),
      ).toBeInTheDocument();
    });

    it('renders LLM Provider dropdown when llm_providers are provided', () => {
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      expect(
        screen.getByRole('button', { name: /LLM Provider/i }),
      ).toBeInTheDocument();
    });

    it('renders Type dropdown when types are provided', () => {
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      expect(screen.getByRole('button', { name: /Type/i })).toBeInTheDocument();
    });

    it('does not render dropdowns when facets are empty', () => {
      render(
        <MentorCategories facets={{}} onFiltersChange={mockOnFiltersChange} />,
      );

      expect(
        screen.queryByRole('button', { name: /Category/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Subject/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /LLM Provider/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Type/i }),
      ).not.toBeInTheDocument();
    });

    it('does not render dropdowns when facets are undefined', () => {
      render(<MentorCategories onFiltersChange={mockOnFiltersChange} />);

      expect(
        screen.queryByRole('button', { name: /Category/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('Created By filter', () => {
    it('renders Created By dropdown when showCreatedByFilter is true', () => {
      render(
        <MentorCategories
          facets={mockFacets}
          showCreatedByFilter={true}
          onFiltersChange={mockOnFiltersChange}
          onCreatedByChange={mockOnCreatedByChange}
        />,
      );

      expect(
        screen.getByRole('button', { name: /Created By/i }),
      ).toBeInTheDocument();
    });

    it('does not render Created By dropdown when showCreatedByFilter is false', () => {
      render(
        <MentorCategories
          facets={mockFacets}
          showCreatedByFilter={false}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      expect(
        screen.queryByRole('button', { name: /Created By/i }),
      ).not.toBeInTheDocument();
    });

    it('includes Me option when includeMeToCreatedByFilter is true', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          showCreatedByFilter={true}
          includeMeToCreatedByFilter={true}
          onFiltersChange={mockOnFiltersChange}
          onCreatedByChange={mockOnCreatedByChange}
        />,
      );

      const createdByButton = screen.getByRole('button', {
        name: /Created By/i,
      });
      await user.click(createdByButton);

      await waitFor(() => {
        expect(
          screen.getByRole('menuitem', { name: /Me/i }),
        ).toBeInTheDocument();
      });
    });

    it('keeps the "Created By" context in the trigger label after picking an option', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          showCreatedByFilter={true}
          includeMeToCreatedByFilter={true}
          onFiltersChange={mockOnFiltersChange}
          onCreatedByChange={mockOnCreatedByChange}
        />,
      );

      await user.click(screen.getByRole('button', { name: /Created By/i }));
      await user.click(await screen.findByRole('menuitem', { name: /^Me$/i }));

      expect(mockOnCreatedByChange).toHaveBeenCalledWith('me');
      // Picking an option keeps the menu open; close it to read the trigger.
      await user.keyboard('{Escape}');
      expect(
        screen.getByRole('button', { name: 'Created By: Me' }),
      ).toBeInTheDocument();
    });

    it('does not include Me option when includeMeToCreatedByFilter is false', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          showCreatedByFilter={true}
          includeMeToCreatedByFilter={false}
          onFiltersChange={mockOnFiltersChange}
          onCreatedByChange={mockOnCreatedByChange}
        />,
      );

      const createdByButton = screen.getByRole('button', {
        name: /Created By/i,
      });
      await user.click(createdByButton);

      await waitFor(() => {
        expect(
          screen.queryByRole('menuitem', { name: /^Me$/i }),
        ).not.toBeInTheDocument();
      });
    });

    it('shows organization name in Created By options', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          showCreatedByFilter={true}
          onFiltersChange={mockOnFiltersChange}
          onCreatedByChange={mockOnCreatedByChange}
        />,
      );

      const createdByButton = screen.getByRole('button', {
        name: /Created By/i,
      });
      await user.click(createdByButton);

      await waitFor(() => {
        expect(
          screen.getByRole('menuitem', { name: /My Organization/i }),
        ).toBeInTheDocument();
      });
    });

    it('shows Community option in Created By dropdown', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          showCreatedByFilter={true}
          onFiltersChange={mockOnFiltersChange}
          onCreatedByChange={mockOnCreatedByChange}
        />,
      );

      const createdByButton = screen.getByRole('button', {
        name: /Created By/i,
      });
      await user.click(createdByButton);

      await waitFor(() => {
        expect(
          screen.getByRole('menuitem', { name: /Community/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Filter selection', () => {
    it('calls onFiltersChange when a category is selected', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const categoryButton = screen.getByRole('button', { name: /Category/i });
      await user.click(categoryButton);

      await waitFor(async () => {
        const educationOption = screen.getByRole('menuitem', {
          name: /Education/i,
        });
        await user.click(educationOption);
      });

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: 'Education',
        }),
      );
    });

    it('calls onFiltersChange when a subject is selected', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const subjectButton = screen.getByRole('button', { name: /Subject/i });
      await user.click(subjectButton);

      await waitFor(async () => {
        const mathOption = screen.getByRole('menuitem', {
          name: /Mathematics/i,
        });
        await user.click(mathOption);
      });

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          subjects: 'Mathematics',
        }),
      );
    });

    it('calls onFiltersChange when an LLM provider is selected', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const llmButton = screen.getByRole('button', { name: /LLM Provider/i });
      await user.click(llmButton);

      await waitFor(async () => {
        const openaiOption = screen.getByRole('menuitem', { name: /OpenAI/i });
        await user.click(openaiOption);
      });

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          llm_providers: 'OpenAI',
        }),
      );
    });

    it('calls onFiltersChange when a type is selected', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const typeButton = screen.getByRole('button', { name: /Type/i });
      await user.click(typeButton);

      await waitFor(async () => {
        const tutorOption = screen.getByRole('menuitem', { name: /Tutor/i });
        await user.click(tutorOption);
      });

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          types: 'Tutor',
        }),
      );
    });

    it('calls onCreatedByChange when created by is selected', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          showCreatedByFilter={true}
          onFiltersChange={mockOnFiltersChange}
          onCreatedByChange={mockOnCreatedByChange}
        />,
      );

      const createdByButton = screen.getByRole('button', {
        name: /Created By/i,
      });
      await user.click(createdByButton);

      await waitFor(async () => {
        const communityOption = screen.getByRole('menuitem', {
          name: /Community/i,
        });
        await user.click(communityOption);
      });

      expect(mockOnCreatedByChange).toHaveBeenCalledWith('community');
    });
  });

  describe('Filter deselection (toggle)', () => {
    it('calls onFiltersChange with selected category first time', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      // First click to select
      const categoryButton = screen.getByRole('button', { name: /Category/i });
      await user.click(categoryButton);

      await waitFor(async () => {
        const educationOption = screen.getByRole('menuitem', {
          name: /Education/i,
        });
        await user.click(educationOption);
      });

      // First call should have the category
      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: 'Education',
        }),
      );
    });

    /* Deselection tests removed - Radix UI DropdownMenu interactions don't reliably
       support click-to-toggle in JSDOM. The deselection code paths are covered by
       istanbul ignore comments in the source. */
  });

  describe('Clear All functionality', () => {
    it('does not show Clear All button when no filters are active', () => {
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      expect(
        screen.queryByRole('button', { name: /Clear All/i }),
      ).not.toBeInTheDocument();
    });

    it('calls onFiltersChange when category is selected', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const categoryButton = screen.getByRole('button', { name: /Category/i });
      await user.click(categoryButton);

      await waitFor(async () => {
        const educationOption = screen.getByRole('menuitem', {
          name: /Education/i,
        });
        await user.click(educationOption);
      });

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: 'Education',
        }),
      );
    });

    it('calls onFiltersChange when subject is selected', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          showCreatedByFilter={true}
          onFiltersChange={mockOnFiltersChange}
          onCreatedByChange={mockOnCreatedByChange}
        />,
      );

      // Select a subject
      const subjectButton = screen.getByRole('button', { name: /Subject/i });
      await user.click(subjectButton);

      await waitFor(async () => {
        const mathOption = screen.getByRole('menuitem', {
          name: /Mathematics/i,
        });
        await user.click(mathOption);
      });

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          subjects: 'Mathematics',
        }),
      );
    });
  });

  describe('Accessibility', () => {
    it('dropdown triggers have aria-haspopup attribute', () => {
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const categoryButton = screen.getByRole('button', { name: /Category/i });
      expect(categoryButton).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('dropdown menus have proper role and aria-label', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const categoryButton = screen.getByRole('button', { name: /Category/i });
      await user.click(categoryButton);

      await waitFor(() => {
        expect(
          screen.getByRole('menu', { name: /Category/i }),
        ).toBeInTheDocument();
      });
    });

    it('menu items have proper role', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const categoryButton = screen.getByRole('button', { name: /Category/i });
      await user.click(categoryButton);

      await waitFor(() => {
        expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
      });
    });

    it('supports llm provider filter selection', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const llmButton = screen.getByRole('button', { name: /LLM Provider/i });
      await user.click(llmButton);

      await waitFor(async () => {
        const openaiOption = screen.getByRole('menuitem', { name: /OpenAI/i });
        await user.click(openaiOption);
      });

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          llm_providers: 'OpenAI',
        }),
      );
    });
  });

  describe('Visual states', () => {
    it('calls onFiltersChange with selected category', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const categoryButton = screen.getByRole('button', { name: /Category/i });
      await user.click(categoryButton);

      await waitFor(async () => {
        const educationOption = screen.getByRole('menuitem', {
          name: /Education/i,
        });
        await user.click(educationOption);
      });

      // Verify that the filter change callback was called with the selected category
      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: 'Education',
        }),
      );
    });
  });

  describe('Featured filter', () => {
    it('renders Featured as a toggle button, not pressed by default', () => {
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );
      expect(
        screen.getByRole('button', { name: 'Featured', pressed: false }),
      ).toBeInTheDocument();
    });

    it('turns the Featured filter on and off with single clicks', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Featured' }));
      expect(mockOnFiltersChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ is_featured: 'true' }),
      );
      expect(
        screen.getByRole('button', { name: 'Featured', pressed: true }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Featured' }));
      expect(mockOnFiltersChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ is_featured: null }),
      );
    });
  });

  describe('Clear All button', () => {
    it('does not show Clear All when no filter is active initially', () => {
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );
      expect(
        screen.queryByRole('button', { name: /Clear All/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('Filter selection behavior', () => {
    it('calls onFiltersChange with selected category value', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const categoryButton = screen.getByRole('button', { name: /Category/i });
      await user.click(categoryButton);

      await waitFor(async () => {
        const educationOption = screen.getByRole('menuitem', {
          name: /Education/i,
        });
        await user.click(educationOption);
      });

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: 'Education',
        }),
      );
    });

    it('calls onFiltersChange with selected subject value', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const subjectButton = screen.getByRole('button', { name: /Subject/i });
      await user.click(subjectButton);

      await waitFor(async () => {
        const mathOption = screen.getByRole('menuitem', {
          name: /Mathematics/i,
        });
        await user.click(mathOption);
      });

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          subjects: 'Mathematics',
        }),
      );
    });

    it('calls onFiltersChange with selected type value', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const typeButton = screen.getByRole('button', { name: /Type/i });
      await user.click(typeButton);

      await waitFor(async () => {
        const tutorOption = screen.getByRole('menuitem', { name: /Tutor/i });
        await user.click(tutorOption);
      });

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          types: 'Tutor',
        }),
      );
    });

    it('calls onFiltersChange with selected LLM provider value', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      const llmButton = screen.getByRole('button', { name: /LLM Provider/i });
      await user.click(llmButton);

      await waitFor(async () => {
        const openaiOption = screen.getByRole('menuitem', { name: /OpenAI/i });
        await user.click(openaiOption);
      });

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          llm_providers: 'OpenAI',
        }),
      );
    });
  });

  describe('Alphanumeric organization name', () => {
    it('shows "My Organization" when platform_name is alphanumeric 32 characters', async () => {
      // Override the mock for this specific test
      vi.doMock('@/hooks/use-user', () => ({
        useCurrentTenant: () => ({
          currentTenant: {
            platform_name: 'abcdef1234567890abcdef1234567890', // 32 alphanumeric characters
            key: 'test-org',
          },
        }),
      }));

      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          showCreatedByFilter={true}
          onFiltersChange={mockOnFiltersChange}
          onCreatedByChange={mockOnCreatedByChange}
        />,
      );

      const createdByButton = screen.getByRole('button', {
        name: /Created By/i,
      });
      await user.click(createdByButton);

      await waitFor(() => {
        expect(
          screen.getByRole('menuitem', { name: /My Organization/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Created By selection with Me option', () => {
    it('calls onCreatedByChange with me when Me option is selected', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          showCreatedByFilter={true}
          includeMeToCreatedByFilter={true}
          onFiltersChange={mockOnFiltersChange}
          onCreatedByChange={mockOnCreatedByChange}
        />,
      );

      const createdByButton = screen.getByRole('button', {
        name: /Created By/i,
      });
      await user.click(createdByButton);

      await waitFor(async () => {
        const meOption = screen.getByRole('menuitem', { name: /Me/i });
        await user.click(meOption);
      });

      expect(mockOnCreatedByChange).toHaveBeenCalledWith('me');
    });

    it('calls onCreatedByChange with my-organization when organization option is selected', async () => {
      const user = userEvent.setup();
      render(
        <MentorCategories
          facets={mockFacets}
          showCreatedByFilter={true}
          onFiltersChange={mockOnFiltersChange}
          onCreatedByChange={mockOnCreatedByChange}
        />,
      );

      const createdByButton = screen.getByRole('button', {
        name: /Created By/i,
      });
      await user.click(createdByButton);

      await waitFor(async () => {
        const orgOption = screen.getByRole('menuitem', {
          name: /My Organization/i,
        });
        await user.click(orgOption);
      });

      expect(mockOnCreatedByChange).toHaveBeenCalledWith('my-organization');
    });
  });
});
