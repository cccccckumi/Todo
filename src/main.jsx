import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import FloatingApp from './components/FloatingApp.jsx';
import './styles.css';

// React 从 index.html 中的 root 节点开始渲染整个页面。
const floating = window.location.hash === '#floating' && Boolean(window.desktopTodo);
document.body.classList.toggle('is-floating', floating);
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {floating ? <FloatingApp /> : <App />}
  </React.StrictMode>,
);
