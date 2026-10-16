import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import Learning from './pages/Learning';
import Settings from './pages/Settings';
import AcceptInvitation from './pages/AcceptInvitation';
import './styles.css';

function App(){return <AuthProvider><BrowserRouter><Routes><Route path="/login" element={<AuthPage mode="login"/>}/><Route path="/register" element={<AuthPage mode="register"/>}/><Route element={<ProtectedRoute/>}><Route element={<Layout/>}><Route path="/" element={<Dashboard/>}/><Route path="/projects" element={<Dashboard/>}/><Route path="/projects/:projectId" element={<ProjectDetail/>}/><Route path="/invitations/accept" element={<AcceptInvitation/>}/><Route path="/learning" element={<Learning/>}/><Route path="/settings" element={<Settings/>}/></Route></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes></BrowserRouter></AuthProvider>}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
