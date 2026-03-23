import { createBrowserRouter, Outlet } from 'react-router-dom';

import App from './App';
import { AppProvider } from './components/AppContext';

import Home from './pages/Home';
import Upload from './pages/Upload';
import OCRResult from './pages/OCRResult';
import SchemaGenerator from './pages/SchemaGenerator';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AppProvider>
        <App>
          <Outlet />
        </App>
      </AppProvider>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'upload', element: <Upload /> },
      { path: 'app/:appName', element: <Upload /> },
      { path: 'ocr/result/:id', element: <OCRResult /> },
      { path: 'schema', element: <SchemaGenerator /> },
      { path: 'schema/:appName', element: <SchemaGenerator /> },
      { path: 'schema-generator/:appName', element: <SchemaGenerator /> },
    ],
  },
]);

export default router;
