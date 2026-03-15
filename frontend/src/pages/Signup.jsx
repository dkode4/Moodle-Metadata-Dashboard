// signup page - handles new user registration with username uniqueness validation
// and firebase authentication before redirecting to the dashboard
import { useState } from "react";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { app } from "../firebase";
import { getFirestore, setDoc, getDoc, doc } from "firebase/firestore";


export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const auth = getAuth(app);
  const navigate = useNavigate();
  const db = getFirestore(app);

  // checks the usernames collection for an existing document with this username -
  // returns true if the document does not exist (username is free to use)
  async function isUsernameAvailable(username) {
    const snap = await getDoc(doc(db, "usernames", username));
    return !snap.exists();
  }

  // usernames must be 2-18 characters and contain only lowercase letters, digits, or underscores
  function validUsername(username) {
    return /^[a-z0-9_]{2,18}$/.test(username);
  }

  const signup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // validate format before hitting firestore to avoid unnecessary reads
    if (!validUsername(username)) {
      setError("Username format invalid.");
      setLoading(false);
      return;
    }
    if (!(await isUsernameAvailable(username))) {
      setError("Username is taken.");
      setLoading(false);
      return;
    }

    try {
      // create the firebase auth account first, then write the user document to firestore
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // store the username and profile info under the user's uid so it can be looked up later
      await setDoc(doc(db, "users", user.uid), {
        username,
        uid: user.uid,
        email: user.email,
        createdAt: new Date().toISOString()
      });

      // claim the username in the usernames collection so it can't be registered again
      await setDoc(doc(db, "usernames", username), { uid: user.uid });

      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="w-screen h-screen flex items-center justify-center"
      style={{
        backgroundImage: `url(/images/welcome.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <form
        onSubmit={signup}
        className="bg-white/40 p-20 rounded-lg shadow-xl w-150 flex flex-col gap-4"
      >
        <h2 className="text-4xl font-semibold text-center text-gray-700 mb-2">
          Sign Up
        </h2>
        <input
          type="text"
          className="border rounded px-3 py-2 w-full focus:outline-none focus:border-blue-500"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
        />
        <input
          type="email"
          className="border rounded px-3 py-2 w-full focus:outline-none focus:border-blue-500"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="border rounded px-3 py-2 w-full focus:outline-none focus:border-blue-500"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          className="bg-blue-600 text-white rounded py-2 font-semibold hover:bg-blue-700 transition"
          disabled={loading}
        >
          {loading ? "Signing up..." : "Sign Up"}
        </button>
        {error && <div className="text-red-600 text-sm text-center">{error}</div>}
        <div className="text-center text-gray-700 text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-700 hover:underline font-medium">
            Log in
          </Link>
        </div>
      </form>
    </div>
  );
}
