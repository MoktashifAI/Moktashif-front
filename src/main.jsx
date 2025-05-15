import { createRoot } from 'react-dom/client'
import './index.css';
import './assets/GlobalStyle.css';
import App from './App.jsx'
import '@fortawesome/fontawesome-free/css/all.min.css';
import { QueryClient, QueryClientProvider } from 'react-query';
let queryClient = new QueryClient();
createRoot(document.getElementById('root')).render(
        <QueryClientProvider client={queryClient}>
                <App />
        </QueryClientProvider>
)
