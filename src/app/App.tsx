import { renderRoute } from './routes';

export default function App() {
  return renderRoute(window.location.pathname);
}
