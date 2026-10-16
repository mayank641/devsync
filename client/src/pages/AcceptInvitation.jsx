import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api';

export default function AcceptInvitation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Checking invitation…');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    const token = params.get('token');
    if (!token) { setMessage('This invitation link is missing its token. Ask the project owner for a new link.'); setBusy(false); return; }
    let active = true;
    api.post('/projects/invitations/accept', { token })
      .then(({ data }) => { if (active) { setMessage(data.message); navigate(`/projects/${data.projectId}`, { replace: true }); } })
      .catch((e) => { if (active) setMessage(errorMessage(e)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [params, navigate]);
  return <section style={{ maxWidth: 560, margin: '40px auto', padding: 24, border: '1px solid #293550', borderRadius: 14, background: '#121a2d' }}>
    <h1 style={{ fontSize: 22 }}>Accept project invitation</h1>
    <p role="status" style={{ color: '#aab5cc', lineHeight: 1.6 }}>{message}</p>
    {!busy && <button className="btn secondary" onClick={() => navigate('/')}>Back to workspace</button>}
  </section>;
}
