// auth guard that wraps protected routes - redirects to /login if the user is not signed in
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { Navigate } from "react-router-dom";
import { app } from "../firebase";

export default function SafeRoute({ children }) {
  const [userChecked, setUserChecked] = useState(false);
  const [user, setUser] = useState(undefined);

  // onAuthStateChanged resolves asynchronously - userChecked prevents a flash
  // redirect to /login before firebase has confirmed the session
  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setUserChecked(true);
    });
    return unsubscribe;
  }, []);

  // hold on the loading screen until firebase confirms auth state
  if (!userChecked) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}