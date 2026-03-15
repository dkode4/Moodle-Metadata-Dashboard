// top navigation bar - shows a personalised greeting, notification bell with
// alert badge, user avatar, and a hamburger toggle for the mobile sidebar
import { FiBell, FiMenu } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { app } from "../firebase";
import { useActiveDataset } from '../contexts/useActiveDataset';
import { severityOf } from '../utils/notificationUtils';

export default function Header({ user, onMenuClick }) {
  const navigate = useNavigate();
  const [profileAvatar, setProfileAvatar] = useState(null);
  const [username, setUsername] = useState(null);
  const { metrics } = useActiveDataset();

  // show the red dot if the active dataset has any warnings or errors
  const hasAlerts = metrics ? severityOf(metrics.dataAlerts) === 'error' || severityOf(metrics.dataAlerts) === 'warning' : false;

  // listen to the user's firestore doc so avatar and username update in real time
  useEffect(() => {
    if (!user?.uid) return;
    const db = getFirestore(app);
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        setProfileAvatar(snap.data().avatar || null);
        setUsername(snap.data().username || null);
      }
    });
    return () => unsub();
  }, [user]);

  // fall back to a generic greeting if the username hasn't loaded yet
  const greeting = username ? `Welcome, ${username}` : 'Welcome';

  return (
    <header className="flex items-center gap-3 px-3 py-3 md:px-6 md:py-4 bg-white shadow-sm rounded-lg min-w-0">
      {/* hamburger only visible on mobile - triggers the drawer sidebar */}
      <button
        className="md:hidden shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        onClick={onMenuClick}
        type="button"
        aria-label="Open menu"
      >
        <FiMenu className="w-5 h-5" />
      </button>
      <span className="hidden md:block text-xl font-medium text-gray-800 truncate flex-1">{greeting}</span>
      <span className="md:hidden flex-1 text-base font-semibold text-gray-800 truncate">{greeting}</span>
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <button
          onClick={() => navigate('/notifications')}
          className="shrink-0 relative flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:text-blue-600 hover:bg-gray-100 transition-colors"
          aria-label="Notifications"
        >
          <FiBell className="w-5 h-5" />
          {hasAlerts && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
          )}
        </button>
        {/* fall back to the app logo if the user hasn't set an avatar */}
        <img
          src={profileAvatar || "/src/assets/logo.png"}
          alt="Avatar"
          className="w-8 h-8 rounded-full shadow object-cover bg-gray-100 shrink-0"
        />
      </div>
    </header>
  );
}