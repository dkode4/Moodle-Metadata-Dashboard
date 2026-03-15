// login page - authenticates the user with firebase email/password
// and redirects to the dashboard on success
import { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app } from "../firebase";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const auth = getAuth(app);
  const navigate = useNavigate();

  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      // firebase returns a descriptive message so it can be shown directly to the user
      setError(err.message);
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
        onSubmit={login}
        className="bg-white/40 p-20 rounded-lg shadow-xl w-150 flex flex-col gap-4"
      >
        <h2 className="text-4xl font-semibold text-center text-gray-700 mb-2">
          Login
        </h2>
        {/* autoComplete hints let the browser offer saved credentials */}
        <input
          type="email"
          autoComplete="email"
          className="border rounded px-3 py-2 w-full focus:outline-none focus:border-blue-500"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          autoComplete="current-password"
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
          {loading ? "Logging in..." : "Login"}
        </button>
        {error && <div className="text-red-600 text-sm text-center">{error}</div>}
        <div className="text-center text-gray-700 text-sm">
          Don't have an account?{" "}
          <Link to="/signup" className="text-blue-700 hover:underline font-medium">
            Sign up
          </Link>
        </div>
      </form>
    </div>
  );
}
