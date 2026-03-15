// root application component - handles authentication state, routing, and layout
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SafeRoute from "./components/SafeRoute";
import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "./firebase";

// page components are lazy loaded so each route gets its own bundle
// that is only downloaded when the user first navigates to that page
const Dashboard    = lazy(() => import("./pages/Dashboard"));
const Profile      = lazy(() => import("./pages/Profile"));
const DataPage     = lazy(() => import("./pages/Data"));
const UserProfile  = lazy(() => import("./pages/UserProfile"));
const Users        = lazy(() => import("./pages/Users"));
const AllUsers     = lazy(() => import("./pages/AllUsers"));
const Connections  = lazy(() => import("./pages/Connections"));
const IPBreakdown  = lazy(() => import("./pages/IPBreakdown"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Events       = lazy(() => import("./pages/Events"));

export default function App() {
  const [user, setUser] = useState();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // subscribe to firebase auth state changes - setUser is called whenever
  // the user logs in or out, and the returned function unsubscribes on unmount
  useEffect(() => {
    const auth = getAuth(app);
    return onAuthStateChanged(auth, setUser);
  }, []);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen(v => !v), []);

  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50 overflow-x-hidden">

        {/* sidebar is only rendered when a user is authenticated */}
        {user && (
          <>
            {/* persistent sidebar shown on medium screens and above */}
            <div className="hidden md:flex shrink-0">
              <Sidebar onClose={closeSidebar} />
            </div>
            {/* overlay drawer shown on mobile when sidebar is toggled open */}
            {sidebarOpen && (
              <div className="md:hidden fixed inset-0 z-50 flex">
                <div
                  className="absolute inset-0 bg-black/50"
                  onClick={closeSidebar}
                />
                <div className="relative z-10 flex">
                  <Sidebar onClose={closeSidebar} />
                </div>
              </div>
            )}
          </>
        )}

        {/* unauthenticated users are restricted to login and signup routes
            any other path redirects to /login */}
        {!user ? (
          <div className="w-full overflow-x-hidden">
            <Routes>
              <Route path="/login"  element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="*"       element={<Navigate to="/login" />} />
            </Routes>
          </div>
        ) : (
          // authenticated shell - renders the header and all protected routes
          <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden md:pl-72">
            <div className="mx-2 mt-2">
              <Header user={user} onMenuClick={toggleSidebar} />
            </div>
            <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden mt-2">
              {/* suspense displays a fallback while a lazy page component is loading */}
              <Suspense fallback={<div className="p-6 text-center text-sm text-gray-400">Loading...</div>}>
              <Routes>
                <Route path="/events"                   element={<SafeRoute user={user}><Events /></SafeRoute>} />
                <Route path="/dashboard"                element={<SafeRoute user={user}><Dashboard /></SafeRoute>} />
                <Route path="/profile"                  element={<SafeRoute user={user}><Profile /></SafeRoute>} />
                <Route path="/connections"              element={<SafeRoute user={user}><Connections /></SafeRoute>} />
                <Route path="/connections/ip-breakdown" element={<SafeRoute user={user}><IPBreakdown /></SafeRoute>} />
                <Route path="/notifications"            element={<SafeRoute user={user}><Notifications /></SafeRoute>} />
                <Route path="/data"                     element={<SafeRoute user={user}><DataPage /></SafeRoute>} />
                <Route path="/users"                    element={<SafeRoute user={user}><Users /></SafeRoute>} />
                <Route path="/users/all"                element={<SafeRoute user={user}><AllUsers /></SafeRoute>} />
                <Route path="/users/:userId"            element={<SafeRoute user={user}><UserProfile /></SafeRoute>} />
                {/* any unmatched route redirects to dashboard */}
                <Route path="*"                         element={<Navigate to="/dashboard" />} />
              </Routes>
              </Suspense>
            </main>
          </div>
        )}
      </div>
    </Router>
  );
}
