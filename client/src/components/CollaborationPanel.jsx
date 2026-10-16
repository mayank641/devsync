import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import styled from 'styled-components';
import { api, errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';

const Wrap = styled.section`margin-top:24px;background:#11192b;border:1px solid #26314a;border-radius:14px;padding:18px;color:#e9edf8;`;
const Tabs = styled.div`display:flex;gap:8px;border-bottom:1px solid #29344d;padding-bottom:12px;margin-bottom:16px;button{background:transparent;border:1px solid transparent;color:#9aa6bf;padding:8px 12px;border-radius:8px;cursor:pointer;font:inherit;font-size:12px}button[aria-selected="true"]{background:#25264c;color:#fff;border-color:#45416f}`;
const Row = styled.div`display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:11px 0;border-bottom:1px solid #222d43; &:last-child{border-bottom:0} .identity{min-width:0;flex:1}strong{display:block;font-size:12px}small{display:block;color:#8491ab;font-size:11px;margin-top:4px}select,input{background:#0b1222;color:#e9edf8;border:1px solid #34405b;border-radius:7px;padding:8px;font-size:12px;max-width:100%}button{cursor:pointer}`;
const Form = styled.form`display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 16px;input{flex:1;min-width:180px;background:#0b1222;color:#fff;border:1px solid #34405b;border-radius:8px;padding:10px}select{background:#0b1222;color:#fff;border:1px solid #34405b;border-radius:8px;padding:10px}button{background:#7665ed;border:0;border-radius:8px;color:white;padding:10px 13px;font-size:12px;cursor:pointer}`;
const Messages = styled.div`display:flex;flex-direction:column;gap:10px;min-height:100px;max-height:300px;overflow:auto;padding:4px 0 14px;.message{max-width:85%;background:#1c2740;border:1px solid #2a3550;border-radius:10px;padding:9px 11px;align-self:flex-start;overflow-wrap:anywhere}.mine{align-self:flex-end;background:#29264e}.who{font-size:10px;color:#a7a0ff;margin-bottom:5px}.body{font-size:12px;white-space:pre-wrap}.when{font-size:9px;color:#8794ad;margin-top:5px}`;
const Notice = styled.p`font-size:12px;line-height:1.5;color:#f0c983;overflow-wrap:anywhere`;
export default function CollaborationPanel({ projectId, project }) {
  const { user, token } = useAuth();
  const [tab, setTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [role, setRole] = useState('member');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteLink, setInviteLink] = useState('');
  const [notice, setNotice] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const isOwner = String(project?.owner?._id || project?.owner) === String(user?._id || user?.id);
  const loadMembers = useCallback(async () => {
    try { const { data } = await api.get(`/projects/${projectId}/members`); setMembers(data.members || []); setRole(data.currentRole || 'member'); }
    catch (e) { setNotice(errorMessage(e)); }
  }, [projectId]);
  const loadMessages = useCallback(async () => {
    try { const { data } = await api.get(`/projects/${projectId}/messages`); setMessages(data.messages || []); }
    catch (e) { setNotice(errorMessage(e)); }
  }, [projectId]);
  useEffect(() => { loadMembers(); loadMessages(); }, [loadMembers, loadMessages]);
  useEffect(() => {
    if (!token) return;
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', { auth: { token } });
    socket.on('connect', () => socket.emit('project:join', projectId));
    socket.on('chat:message', (event) => {
      if (event.projectId === projectId) setMessages((prev) => prev.some((m) => String(m._id) === String(event.message._id)) ? prev : [...prev, event.message].slice(-100));
    });
    socket.on('project:members-updated', (event) => { if (event.projectId === projectId) loadMembers(); });
    return () => { socket.emit('project:leave', projectId); socket.disconnect(); };
  }, [projectId, token, loadMembers]);
  const invite = async (e) => {
    e.preventDefault(); setBusy(true); setNotice(''); setInviteLink('');
    try {
      const { data } = await api.post(`/projects/${projectId}/invitations`, { email, role: inviteRole });
      setInviteLink(data.inviteLink); setNotice(data.note || 'Invitation email sent.'); setEmail('');
    } catch (e) { setNotice(errorMessage(e)); } finally { setBusy(false); }
  };
  const changeRole = async (userId, nextRole) => {
    try { await api.patch(`/projects/${projectId}/members/${userId}/role`, { role: nextRole }); await loadMembers(); setNotice('Role updated.'); }
    catch (e) { setNotice(errorMessage(e)); }
  };
  const removeMember = async (userId) => {
    if (!window.confirm('Remove this member from the project?')) return;
    try { await api.delete(`/projects/${projectId}/members/${userId}`); await loadMembers(); setNotice('Member removed.'); }
    catch (e) { setNotice(errorMessage(e)); }
  };
  const sendMessage = async (e) => {
    e.preventDefault(); if (!text.trim()) return; setBusy(true);
    try { const { data } = await api.post(`/projects/${projectId}/messages`, { text }); setMessages((prev) => prev.some((m) => String(m._id) === String(data.message._id)) ? prev : [...prev, data.message].slice(-100)); setText(''); }
    catch (e) { setNotice(errorMessage(e)); } finally { setBusy(false); }
  };
  return <Wrap>
    <Tabs><button aria-selected={tab === 'members'} onClick={() => setTab('members')}>Team members ({members.length})</button><button aria-selected={tab === 'chat'} onClick={() => setTab('chat')}>Team chat</button></Tabs>
    {notice && <Notice role="status">{notice}</Notice>}
    {tab === 'members' ? <>
      {(isOwner || role === 'admin') && <Form onSubmit={invite}><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Invite by email address" aria-label="Invite email"/><select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} aria-label="Invitation role"><option value="member">Member</option><option value="admin">Admin</option></select><button disabled={busy}>{busy ? 'Creating…' : 'Send invitation email'}</button></Form>}
      {inviteLink && <><Notice>Email sent successfully. You can copy the invitation link as a backup; it expires in 7 days.</Notice><Row><input aria-label="Invitation link" readOnly value={inviteLink} style={{flex:1}}/><button className="btn secondary" onClick={() => { navigator.clipboard?.writeText(inviteLink); setNotice('Invitation link copied if clipboard permission was granted.'); }}>Copy link</button></Row></>}
      {members.map(({ user: member, role: memberRole }) => <Row key={member._id}><div className="identity"><strong>{member.name}{String(member._id) === String(user?._id || user?.id) ? ' (you)' : ''}</strong><small>{member.email}</small></div><small>{memberRole}</small>{isOwner && memberRole !== 'owner' && <><select aria-label={`Role for ${member.name}`} value={memberRole} onChange={(e) => changeRole(member._id, e.target.value)}><option value="member">Member</option><option value="admin">Admin</option></select><button className="btn secondary" onClick={() => removeMember(member._id)}>Remove</button></>}</Row>)}
      {!isOwner && <Row><small>Your role: {role}. Only owners can change roles or remove other members.</small></Row>}
    </> : <>
      <Messages>{messages.length ? messages.map((m) => <div className={`message ${String(m.sender?._id) === String(user?._id || user?.id) ? 'mine' : ''}`} key={m._id}><div className="who">{m.sender?.name || 'Member'}</div><div className="body">{m.text}</div><div className="when">{m.createdAt ? new Date(m.createdAt).toLocaleString() : 'Just now'}</div></div>) : <Notice>No messages yet. Start the team conversation.</Notice>}</Messages>
      <Form onSubmit={sendMessage}><input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Message your team…" aria-label="Team message"/><button disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send'}</button></Form>
      <Notice>Messages are saved to the database. Recent messages update live for connected project members.</Notice>
    </>}
  </Wrap>;
}
