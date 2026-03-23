import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import router from './router';
import './index.css';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_WyJY9hmBG',
      userPoolClientId: '63cjpr57sb6fooca1u5ea9jn6r',
      allowGuestAccess: false,
      identityPoolId: ''
    }
  }
} as any);

cognitoUserPoolsTokenProvider.setKeyValueStorage({
  getItem: (key) => Promise.resolve(localStorage.getItem(key)),
  setItem: (key, value) => { localStorage.setItem(key, value); return Promise.resolve(); },
  removeItem: (key) => { localStorage.removeItem(key); return Promise.resolve(); },
  clear: () => { localStorage.clear(); return Promise.resolve(); }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
