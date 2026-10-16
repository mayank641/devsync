import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CollaborationPanel from './CollaborationPanel';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  socketOn: vi.fn(),
  socketEmit: vi.fn(),
  socketDisconnect: vi.fn()
}));

vi.mock('../api', () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, delete: mocks.delete },
  errorMessage: (e) => e?.message || 'Request failed'
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1', name: 'Asha', email: 'asha@example.com' }, token: 'test-token' })
}));
vi.mock('socket.io-client', () => ({
  io: () => ({ on: mocks.socketOn, emit: mocks.socketEmit, disconnect: mocks.socketDisconnect })
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('CollaborationPanel', () => {
  it('shows members and exposes invitation controls to the owner', async () => {
    mocks.get.mockImplementation((url) => {
      if (url.endsWith('/members')) return Promise.resolve({ data: { currentRole: 'owner', members: [{ role: 'owner', user: { _id: 'owner-1', name: 'Asha', email: 'asha@example.com' } }] } });
      if (url.endsWith('/messages')) return Promise.resolve({ data: { messages: [] } });
      return Promise.resolve({ data: {} });
    });

    render(<CollaborationPanel projectId="project-1" project={{ owner: { _id: 'owner-1' } }} />);

    expect(await screen.findByText('asha@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send invitation email' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Invite email' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Team chat' }));
    expect(await screen.findByText('No messages yet. Start the team conversation.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Team message' })).toBeInTheDocument();
  });

  it('sends an invitation email and displays a backup link', async () => {
    mocks.get.mockImplementation((url) => url.endsWith('/members')
      ? Promise.resolve({ data: { currentRole: 'owner', members: [{ role: 'owner', user: { _id: 'owner-1', name: 'Asha', email: 'asha@example.com' } }] } })
      : Promise.resolve({ data: { messages: [] } }));
    mocks.post.mockResolvedValue({ data: { inviteLink: 'https://devsync.example/invitations/accept?token=abc123', note: 'Invitation email sent.' } });

    render(<CollaborationPanel projectId="project-1" project={{ owner: { _id: 'owner-1' } }} />);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Invite email' }), { target: { value: 'member@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation email' }));

    expect(await screen.findByDisplayValue('https://devsync.example/invitations/accept?token=abc123')).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledWith('/projects/project-1/invitations', { email: 'member@example.com', role: 'member' });
  });
});
