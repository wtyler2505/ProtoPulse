import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { Project } from '@shared/schema';

// ---------------------------------------------------------------------------
// Mock wouter
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/', mockNavigate],
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// ---------------------------------------------------------------------------
// Mock queryClient module — apiRequest + getQueryFn
// ---------------------------------------------------------------------------
const mockApiRequest = vi.fn();
vi.mock('@/lib/queryClient', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/queryClient');
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

// ---------------------------------------------------------------------------
// Import component under test (after vi.mock declarations are hoisted)
// ---------------------------------------------------------------------------
import ProjectPickerPage from '@/pages/ProjectPickerPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: 'Test Project',
    description: 'A test project',
    ownerId: 1,
    version: 1,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-04T12:00:00Z'),
    deletedAt: null,
    ...overrides,
  } as Project;
}

const LAST_PROJECT_KEY = 'protopulse-last-project';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderPage(qc?: QueryClient) {
  const client = qc ?? createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ProjectPickerPage />
    </QueryClientProvider>,
  );
}

// Mock fetch globally for React Query's default queryFn
let fetchMock: ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Setup & Teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  mockNavigate.mockReset();
  mockApiRequest.mockReset();
  localStorage.clear();

  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Helper: configure fetch to return a project list
function mockFetchProjects(projects: Project[]) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: projects, total: projects.length }),
    text: async () => JSON.stringify({ data: projects, total: projects.length }),
    headers: new Headers(),
  });
}

function mockFetchError(status: number, message: string) {
  fetchMock.mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ message }),
    text: async () => message,
    statusText: message,
    headers: new Headers(),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ProjectPickerPage', () => {
  // ========================================================================
  // RENDERING
  // ========================================================================
  describe('Rendering', () => {
    it('renders the page container with correct test ID', async () => {
      mockFetchProjects([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-picker-page')).toBeDefined();
      });
    });

    it('renders the ProtoPulse heading', async () => {
      mockFetchProjects([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('ProtoPulse')).toBeDefined();
      });
    });

    it('renders subtitle text', async () => {
      mockFetchProjects([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Select a project to continue')).toBeDefined();
      });
    });
  });

  // ========================================================================
  // LOADING STATE
  // ========================================================================
  describe('Loading state', () => {
    it('shows skeleton cards while loading', async () => {
      // Never resolve fetch — stays in loading state
      fetchMock.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.getByTestId('skeleton-grid')).toBeDefined();
    });

    it('shows 3 skeleton cards', async () => {
      fetchMock.mockReturnValue(new Promise(() => {}));
      renderPage();
      const skeletons = screen.getAllByTestId('project-card-skeleton');
      expect(skeletons).toHaveLength(3);
    });

    it('shows heading during loading', async () => {
      fetchMock.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.getByText('ProtoPulse')).toBeDefined();
    });
  });

  // ========================================================================
  // ERROR STATE
  // ========================================================================
  describe('Error state', () => {
    it('shows error state when fetch fails', async () => {
      mockFetchError(500, 'Internal Server Error');
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeDefined();
      });
    });

    it('shows error message', async () => {
      mockFetchError(500, 'Internal Server Error');
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Internal Server Error/)).toBeDefined();
      });
    });

    it('shows retry button', async () => {
      mockFetchError(500, 'Internal Server Error');
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-retry')).toBeDefined();
      });
    });

    it('retries fetch when retry button is clicked', async () => {
      mockFetchError(500, 'Server Error');
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-retry')).toBeDefined();
      });

      // Now make fetch succeed
      mockFetchProjects([makeProject()]);
      fireEvent.click(screen.getByTestId('button-retry'));

      await waitFor(() => {
        expect(screen.getByTestId('project-card-1')).toBeDefined();
      });
    });

    it('shows "Failed to load projects" heading in error state', async () => {
      mockFetchError(403, 'Forbidden');
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Failed to load projects')).toBeDefined();
      });
    });
  });

  // ========================================================================
  // EMPTY STATE
  // ========================================================================
  describe('Empty state', () => {
    it('shows empty state when no projects exist', async () => {
      mockFetchProjects([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeDefined();
      });
    });

    it('shows "No projects yet" message', async () => {
      mockFetchProjects([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('No projects yet')).toBeDefined();
      });
    });

    it('shows create first project button', async () => {
      mockFetchProjects([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-first-project')).toBeDefined();
      });
    });

    it('opens create dialog when "Create Your First Project" is clicked', async () => {
      mockFetchProjects([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-first-project')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-create-first-project'));
      await waitFor(() => {
        expect(screen.getByTestId('create-project-dialog')).toBeDefined();
      });
    });

    it('does not show search bar in empty state', async () => {
      mockFetchProjects([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeDefined();
      });
      expect(screen.queryByTestId('input-search-projects')).toBeNull();
    });

    it('does not show the "New Project" header button in empty state', async () => {
      mockFetchProjects([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeDefined();
      });
      expect(screen.queryByTestId('button-create-project')).toBeNull();
    });
  });

  // ========================================================================
  // PROJECT LIST
  // ========================================================================
  describe('Project list', () => {
    it('renders project cards', async () => {
      const projects = [
        makeProject({ id: 1, name: 'Rover Controller' }),
        makeProject({ id: 2, name: 'LED Matrix' }),
      ];
      mockFetchProjects(projects);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-card-1')).toBeDefined();
        expect(screen.getByTestId('project-card-2')).toBeDefined();
      });
    });

    it('displays project names', async () => {
      mockFetchProjects([makeProject({ id: 1, name: 'Rover Controller' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Rover Controller')).toBeDefined();
      });
    });

    it('displays project descriptions', async () => {
      mockFetchProjects([makeProject({ id: 1, description: 'Arduino-based rover' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Arduino-based rover')).toBeDefined();
      });
    });

    it('displays project version', async () => {
      mockFetchProjects([makeProject({ id: 1, version: 5 })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-version-1')).toBeDefined();
        expect(screen.getByTestId('project-version-1').textContent).toContain('v5');
      });
    });

    it('renders project grid container', async () => {
      mockFetchProjects([makeProject()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-grid')).toBeDefined();
      });
    });

    it('shows "New Project" button in header when projects exist', async () => {
      mockFetchProjects([makeProject()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-project')).toBeDefined();
      });
    });

    it('renders multiple projects in grid', async () => {
      const projects = Array.from({ length: 6 }, (_, i) =>
        makeProject({ id: i + 1, name: `Project ${String(i + 1)}` }),
      );
      mockFetchProjects(projects);
      renderPage();
      await waitFor(() => {
        for (let i = 1; i <= 6; i++) {
          expect(screen.getByTestId(`project-card-${String(i)}`)).toBeDefined();
        }
      });
    });

    it('handles project without description gracefully', async () => {
      mockFetchProjects([makeProject({ id: 1, name: 'No Desc', description: '' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('No Desc')).toBeDefined();
      });
    });

    it('handles project with null description', async () => {
      mockFetchProjects([makeProject({ id: 1, name: 'Null Desc', description: null as unknown as string })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Null Desc')).toBeDefined();
      });
    });
  });

  // ========================================================================
  // NAVIGATION
  // ========================================================================
  describe('Navigation', () => {
    it('navigates to project workspace on card click', async () => {
      mockFetchProjects([makeProject({ id: 42, name: 'My Circuit' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-card-42')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('project-card-42'));
      expect(mockNavigate).toHaveBeenCalledWith('/projects/42');
    });

    it('saves last project to localStorage on navigation', async () => {
      mockFetchProjects([makeProject({ id: 7, name: 'Saved Project' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-card-7')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('project-card-7'));
      expect(localStorage.getItem(LAST_PROJECT_KEY)).toBe('7');
    });

    it('navigates on Enter key press on project card', async () => {
      mockFetchProjects([makeProject({ id: 3, name: 'Keyboard Nav' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-card-3')).toBeDefined();
      });
      fireEvent.keyDown(screen.getByTestId('project-card-3'), { key: 'Enter' });
      expect(mockNavigate).toHaveBeenCalledWith('/projects/3');
    });

    it('navigates on Space key press on project card', async () => {
      mockFetchProjects([makeProject({ id: 4, name: 'Space Nav' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-card-4')).toBeDefined();
      });
      fireEvent.keyDown(screen.getByTestId('project-card-4'), { key: ' ' });
      expect(mockNavigate).toHaveBeenCalledWith('/projects/4');
    });

    it('does not navigate on other key presses', async () => {
      mockFetchProjects([makeProject({ id: 5, name: 'No Nav' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-card-5')).toBeDefined();
      });
      fireEvent.keyDown(screen.getByTestId('project-card-5'), { key: 'Tab' });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // SEARCH / FILTER
  // ========================================================================
  describe('Search and filter', () => {
    it('renders the search input', async () => {
      mockFetchProjects([makeProject()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('input-search-projects')).toBeDefined();
      });
    });

    it('filters projects by name', async () => {
      mockFetchProjects([
        makeProject({ id: 1, name: 'Rover Controller' }),
        makeProject({ id: 2, name: 'LED Matrix' }),
      ]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-card-1')).toBeDefined();
      });

      fireEvent.change(screen.getByTestId('input-search-projects'), { target: { value: 'Rover' } });

      expect(screen.getByTestId('project-card-1')).toBeDefined();
      expect(screen.queryByTestId('project-card-2')).toBeNull();
    });

    it('filters projects by description', async () => {
      mockFetchProjects([
        makeProject({ id: 1, name: 'Project A', description: 'Arduino motor control' }),
        makeProject({ id: 2, name: 'Project B', description: 'ESP32 WiFi module' }),
      ]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-card-1')).toBeDefined();
      });

      fireEvent.change(screen.getByTestId('input-search-projects'), { target: { value: 'WiFi' } });

      expect(screen.queryByTestId('project-card-1')).toBeNull();
      expect(screen.getByTestId('project-card-2')).toBeDefined();
    });

    it('search is case-insensitive', async () => {
      mockFetchProjects([makeProject({ id: 1, name: 'Rover Controller' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-card-1')).toBeDefined();
      });

      fireEvent.change(screen.getByTestId('input-search-projects'), { target: { value: 'rover' } });
      expect(screen.getByTestId('project-card-1')).toBeDefined();
    });

    it('shows "no results" message when search has no matches', async () => {
      mockFetchProjects([makeProject({ id: 1, name: 'Rover Controller' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-card-1')).toBeDefined();
      });

      fireEvent.change(screen.getByTestId('input-search-projects'), { target: { value: 'zzzzz' } });
      expect(screen.getByTestId('no-results')).toBeDefined();
    });

    it('shows all projects when search is cleared', async () => {
      mockFetchProjects([
        makeProject({ id: 1, name: 'Rover Controller', description: 'Motor driver' }),
        makeProject({ id: 2, name: 'LED Matrix', description: 'Pixel display' }),
      ]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-card-1')).toBeDefined();
      });

      fireEvent.change(screen.getByTestId('input-search-projects'), { target: { value: 'Rover' } });
      expect(screen.queryByTestId('project-card-2')).toBeNull();

      fireEvent.change(screen.getByTestId('input-search-projects'), { target: { value: '' } });
      expect(screen.getByTestId('project-card-1')).toBeDefined();
      expect(screen.getByTestId('project-card-2')).toBeDefined();
    });

    it('trims whitespace in search query', async () => {
      mockFetchProjects([makeProject({ id: 1, name: 'Rover' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-card-1')).toBeDefined();
      });

      fireEvent.change(screen.getByTestId('input-search-projects'), { target: { value: '  Rover  ' } });
      expect(screen.getByTestId('project-card-1')).toBeDefined();
    });

    it('includes the search term in the no-results message', async () => {
      mockFetchProjects([makeProject({ id: 1, name: 'Project A' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-card-1')).toBeDefined();
      });

      fireEvent.change(screen.getByTestId('input-search-projects'), { target: { value: 'xyz123' } });
      const noResults = screen.getByTestId('no-results');
      expect(noResults.textContent).toContain('xyz123');
    });
  });

  // ========================================================================
  // CREATE PROJECT
  // ========================================================================
  describe('Create project', () => {
    it('opens create dialog from header button', async () => {
      mockFetchProjects([makeProject()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-project')).toBeDefined();
      });

      fireEvent.click(screen.getByTestId('button-create-project'));
      await waitFor(() => {
        expect(screen.getByTestId('create-project-dialog')).toBeDefined();
      });
    });

    it('dialog has name input', async () => {
      mockFetchProjects([makeProject()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-project')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-create-project'));
      await waitFor(() => {
        expect(screen.getByTestId('input-project-name')).toBeDefined();
      });
    });

    it('dialog has description input', async () => {
      mockFetchProjects([makeProject()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-project')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-create-project'));
      await waitFor(() => {
        expect(screen.getByTestId('input-project-description')).toBeDefined();
      });
    });

    it('create button is disabled when name is empty', async () => {
      mockFetchProjects([makeProject()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-project')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-create-project'));
      await waitFor(() => {
        expect(screen.getByTestId('button-confirm-create')).toBeDefined();
      });
      expect(screen.getByTestId('button-confirm-create')).toHaveProperty('disabled', true);
    });

    it('create button is enabled when name is provided', async () => {
      mockFetchProjects([makeProject()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-project')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-create-project'));
      await waitFor(() => {
        expect(screen.getByTestId('input-project-name')).toBeDefined();
      });
      fireEvent.change(screen.getByTestId('input-project-name'), { target: { value: 'New Circuit' } });
      expect(screen.getByTestId('button-confirm-create')).toHaveProperty('disabled', false);
    });

    it('create button is disabled when name is only whitespace', async () => {
      mockFetchProjects([makeProject()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-project')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-create-project'));
      await waitFor(() => {
        expect(screen.getByTestId('input-project-name')).toBeDefined();
      });
      fireEvent.change(screen.getByTestId('input-project-name'), { target: { value: '   ' } });
      expect(screen.getByTestId('button-confirm-create')).toHaveProperty('disabled', true);
    });

    it('calls POST /api/projects on submit', async () => {
      const newProject = makeProject({ id: 99, name: 'Created Project' });
      mockFetchProjects([makeProject()]);
      mockApiRequest.mockResolvedValue({
        ok: true,
        json: async () => newProject,
      });

      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-project')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-create-project'));
      await waitFor(() => {
        expect(screen.getByTestId('input-project-name')).toBeDefined();
      });

      fireEvent.change(screen.getByTestId('input-project-name'), { target: { value: 'Created Project' } });
      fireEvent.change(screen.getByTestId('input-project-description'), { target: { value: 'A description' } });
      fireEvent.click(screen.getByTestId('button-confirm-create'));

      await waitFor(() => {
        expect(screen.getByTestId('team-template-selector')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-skip-template'));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/projects', {
          name: 'Created Project',
          description: 'A description',
        });
      });
    });

    it('navigates to new project after creation', async () => {
      const newProject = makeProject({ id: 99, name: 'New One' });
      mockFetchProjects([makeProject()]);
      mockApiRequest.mockResolvedValue({
        ok: true,
        json: async () => newProject,
      });

      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-project')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-create-project'));
      await waitFor(() => {
        expect(screen.getByTestId('input-project-name')).toBeDefined();
      });

      fireEvent.change(screen.getByTestId('input-project-name'), { target: { value: 'New One' } });
      fireEvent.click(screen.getByTestId('button-confirm-create'));

      await waitFor(() => {
        expect(screen.getByTestId('team-template-selector')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-skip-template'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/projects/99');
      });
    });

    it('saves created project id as last project', async () => {
      const newProject = makeProject({ id: 55, name: 'Saved' });
      mockFetchProjects([makeProject()]);
      mockApiRequest.mockResolvedValue({
        ok: true,
        json: async () => newProject,
      });

      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-project')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-create-project'));
      await waitFor(() => {
        expect(screen.getByTestId('input-project-name')).toBeDefined();
      });

      fireEvent.change(screen.getByTestId('input-project-name'), { target: { value: 'Saved' } });
      fireEvent.click(screen.getByTestId('button-confirm-create'));

      await waitFor(() => {
        expect(screen.getByTestId('team-template-selector')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-skip-template'));

      await waitFor(() => {
        expect(localStorage.getItem(LAST_PROJECT_KEY)).toBe('55');
      });
    });

    it('closes dialog after cancel', async () => {
      mockFetchProjects([makeProject()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-project')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-create-project'));
      await waitFor(() => {
        expect(screen.getByTestId('create-project-dialog')).toBeDefined();
      });

      fireEvent.click(screen.getByTestId('button-cancel-create'));
      await waitFor(() => {
        expect(screen.queryByTestId('create-project-dialog')).toBeNull();
      });
    });

    it('resets form fields when dialog reopens', async () => {
      mockFetchProjects([makeProject()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-project')).toBeDefined();
      });

      // Open and type something
      fireEvent.click(screen.getByTestId('button-create-project'));
      await waitFor(() => {
        expect(screen.getByTestId('input-project-name')).toBeDefined();
      });
      fireEvent.change(screen.getByTestId('input-project-name'), { target: { value: 'Typed Name' } });

      // Cancel
      fireEvent.click(screen.getByTestId('button-cancel-create'));
      await waitFor(() => {
        expect(screen.queryByTestId('create-project-dialog')).toBeNull();
      });

      // Reopen
      fireEvent.click(screen.getByTestId('button-create-project'));
      await waitFor(() => {
        const nameInput = screen.getByTestId('input-project-name') as HTMLInputElement;
        expect(nameInput.value).toBe('');
      });
    });

    it('submits via Enter key in name input', async () => {
      const newProject = makeProject({ id: 88, name: 'Enter Project' });
      mockFetchProjects([makeProject()]);
      mockApiRequest.mockResolvedValue({
        ok: true,
        json: async () => newProject,
      });

      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-project')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-create-project'));
      await waitFor(() => {
        expect(screen.getByTestId('input-project-name')).toBeDefined();
      });

      fireEvent.change(screen.getByTestId('input-project-name'), { target: { value: 'Enter Project' } });
      fireEvent.keyDown(screen.getByTestId('input-project-name'), { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByTestId('team-template-selector')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-skip-template'));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/projects', {
          name: 'Enter Project',
          description: '',
        });
      });
    });

    it('dialog has title and description', async () => {
      mockFetchProjects([makeProject()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-create-project')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('button-create-project'));
      await waitFor(() => {
        expect(screen.getByText('Create New Project')).toBeDefined();
        expect(screen.getByText('Start a new electronics design project.')).toBeDefined();
      });
    });
  });

  // ========================================================================
  // AUTO-REDIRECT
  // ========================================================================
  describe('Auto-redirect', () => {
    it('auto-redirects to last project when saved in localStorage', async () => {
      localStorage.setItem(LAST_PROJECT_KEY, '10');
      mockFetchProjects([makeProject({ id: 10, name: 'Last Visited' })]);
      renderPage();
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/projects/10');
      });
    });

    it('shows auto-redirect notice while redirecting', async () => {
      localStorage.setItem(LAST_PROJECT_KEY, '10');
      mockFetchProjects([makeProject({ id: 10, name: 'Last Visited' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('auto-redirect-notice')).toBeDefined();
      });
    });

    it('shows "View All Projects" button during auto-redirect', async () => {
      localStorage.setItem(LAST_PROJECT_KEY, '10');
      mockFetchProjects([makeProject({ id: 10, name: 'Last Visited' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-view-all-projects')).toBeDefined();
      });
    });

    it('dismisses auto-redirect when "View All Projects" is clicked', async () => {
      localStorage.setItem(LAST_PROJECT_KEY, '10');
      mockFetchProjects([makeProject({ id: 10, name: 'Last Visited' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('button-view-all-projects')).toBeDefined();
      });

      mockNavigate.mockClear();
      fireEvent.click(screen.getByTestId('button-view-all-projects'));

      await waitFor(() => {
        expect(screen.getByTestId('project-grid')).toBeDefined();
      });
    });

    it('does not auto-redirect if saved project no longer exists', async () => {
      localStorage.setItem(LAST_PROJECT_KEY, '999');
      mockFetchProjects([makeProject({ id: 1, name: 'Only Project' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-grid')).toBeDefined();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not auto-redirect if no last project saved', async () => {
      mockFetchProjects([makeProject({ id: 1, name: 'Some Project' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-grid')).toBeDefined();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not auto-redirect if localStorage has invalid value', async () => {
      localStorage.setItem(LAST_PROJECT_KEY, 'not-a-number');
      mockFetchProjects([makeProject({ id: 1, name: 'Project' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-grid')).toBeDefined();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not auto-redirect when project list is empty', async () => {
      localStorage.setItem(LAST_PROJECT_KEY, '1');
      mockFetchProjects([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeDefined();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not auto-redirect if last project id is negative', async () => {
      localStorage.setItem(LAST_PROJECT_KEY, '-5');
      mockFetchProjects([makeProject({ id: 1, name: 'Project' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-grid')).toBeDefined();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // DATA-TESTID COVERAGE
  // ========================================================================
  describe('data-testid coverage', () => {
    it('project-picker-page is present', async () => {
      mockFetchProjects([makeProject()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-picker-page')).toBeDefined();
      });
    });

    it('search-container is present when projects exist', async () => {
      mockFetchProjects([makeProject()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('search-container')).toBeDefined();
      });
    });

    it('project-updated timestamp is present', async () => {
      mockFetchProjects([makeProject({ id: 1 })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-updated-1')).toBeDefined();
      });
    });
  });

  // ========================================================================
  // RELATIVE TIME FORMATTING
  // ========================================================================
  describe('Relative time formatting', () => {
    it('shows "Just now" for very recent timestamps', async () => {
      mockFetchProjects([makeProject({ id: 1, updatedAt: new Date() })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-updated-1').textContent).toContain('Just now');
      });
    });

    it('shows minutes for recent timestamps', async () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      mockFetchProjects([makeProject({ id: 1, updatedAt: fiveMinAgo })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-updated-1').textContent).toContain('5m ago');
      });
    });

    it('shows hours for older timestamps', async () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      mockFetchProjects([makeProject({ id: 1, updatedAt: threeHoursAgo })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-updated-1').textContent).toContain('3h ago');
      });
    });

    it('shows days for older timestamps', async () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      mockFetchProjects([makeProject({ id: 1, updatedAt: fiveDaysAgo })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('project-updated-1').textContent).toContain('5d ago');
      });
    });
  });
});
