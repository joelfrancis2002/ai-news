import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../lib/apiClient";
import toast from "react-hot-toast";

export function LoginPage() {
  const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  
  const [loginType, setLoginType] = useState<"admin" | "reader">("admin");
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.userType === "reader") {
        navigate("/summaries", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        await apiClient.post<{ success: boolean; message: string }>("/auth/register", {
          id: userId,
          name,
          password,
        });
        toast.success("Account registered! Please sign in.");
        setIsSignUp(false);
        setPassword("");
      } else {
        const emailOrId = loginType === "admin" ? email : userId;
        await login(emailOrId, password, loginType);
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="text-sm font-medium text-slate-300">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/85 p-8 shadow-2xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              AI Newsroom
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-100">
              {isSignUp
                ? "Create Reader Account"
                : loginType === "admin"
                ? "Editorial Login"
                : "Reader Login"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {isSignUp
                ? "Register a new User ID to access the news summaries and feeds."
                : loginType === "admin"
                ? "Sign in to manage sources, review summaries, and publish clusters."
                : "Sign in to view published summaries, articles, and sources."}
            </p>
          </div>

          {!isSignUp && (
            <div className="inline-flex rounded-lg bg-slate-950 border border-slate-800 p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setLoginType("reader");
                  setError(null);
                  setUserId("");
                  setPassword("");
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  loginType === "reader"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                User
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginType("admin");
                  setError(null);
                  setEmail("");
                  setPassword("");
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  loginType === "admin"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Admin
              </button>
            </div>
          )}
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
          {isSignUp ? (
            <>
              <div>
                <label htmlFor="userId" className="mb-1.5 block text-xs font-medium text-slate-400">
                  User Name (Email)
                </label>
                <input
                  id="userId"
                  type="email"
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
                  placeholder="name@example.com"
                  required
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Your email address will serve as your unique username to log in.
                </p>
              </div>

              <div>
                <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-slate-400">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
                  placeholder="Enter your full name"
                  required
                />
              </div>
            </>
          ) : loginType === "admin" ? (
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-slate-400">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
                placeholder="name@example.com"
                required
              />
            </div>
          ) : (
            <div>
              <label htmlFor="userId" className="mb-1.5 block text-xs font-medium text-slate-400">
                User Name (Email)
              </label>
              <input
                id="userId"
                type="text"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
                placeholder="name@example.com"
                required
              />
            </div>
          )}

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium text-slate-400"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 pl-3 pr-10 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
          >
            {loading
              ? isSignUp
                ? "Creating account..."
                : "Signing in..."
              : isSignUp
              ? "Sign Up & Register"
              : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center">
          {isSignUp ? (
            <button
              onClick={() => {
                setIsSignUp(false);
                setError(null);
                setUserId("");
                setPassword("");
              }}
              className="text-xs text-blue-400 hover:underline"
            >
              Already have an account? Sign In
            </button>
          ) : (
            loginType === "reader" && (
              <button
                onClick={() => {
                  setIsSignUp(true);
                  setError(null);
                  setName("");
                  setUserId("");
                  setPassword("");
                }}
                className="text-xs text-blue-400 hover:underline"
              >
                Don't have an account? Sign Up
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
