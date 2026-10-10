import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { Protected } from './components/Protected';
import Home from './pages/Home';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import MyTickets from './pages/MyTickets';
import TicketDetail from './pages/TicketDetail';
import Profile from './pages/Profile';
import Admin from './pages/Admin';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="etkinlikler" element={<Events />} />
        <Route path="etkinlik/:id" element={<EventDetail />} />
        <Route path="odeme/:eventId" element={<Protected><Checkout /></Protected>} />
        <Route path="giris" element={<Login />} />
        <Route path="kayit" element={<Register />} />
        <Route path="sifremi-unuttum" element={<ForgotPassword />} />
        <Route path="biletlerim" element={<Protected><MyTickets /></Protected>} />
        <Route path="bilet/:id" element={<Protected><TicketDetail /></Protected>} />
        <Route path="profil" element={<Protected><Profile /></Protected>} />
        <Route path="admin" element={<Protected admin><Admin /></Protected>} />
      </Route>
    </Routes>
  );
}
