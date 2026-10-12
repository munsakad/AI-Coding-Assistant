// Shared plumbing for the static GitHub Pages build: an in-browser stand-in
// for Prisma (a JSON document in localStorage), for NextAuth's credential
// endpoints, and a fetch hook that routes /api/* to the demo handlers.
// Everything is per visitor and per browser; there is no server.

export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const newId = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function hashPassword(password) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Seed users keep the documented demo password from prisma/seed.ts
export async function checkPassword(user, password) {
  if (user.seedPassword) return password === user.seedPassword;
  return user.passwordHash === (await hashPassword(password));
}

export function createDb(app, seed) {
  const key = "demo." + app + ".db";
  let cache = null;
  const read = () => {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(key);
      cache = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(seed));
    } catch {
      cache = JSON.parse(JSON.stringify(seed));
    }
    return cache;
  };
  return {
    read,
    write(fn) {
      const db = read();
      const result = fn(db);
      try {
        localStorage.setItem(key, JSON.stringify(db));
      } catch {
        /* storage full or unavailable: changes last until reload */
      }
      return result;
    },
  };
}

export function createAuth(app) {
  const key = "demo." + app + ".session";
  const getSession = () => {
    try {
      const s = JSON.parse(localStorage.getItem(key));
      return s && new Date(s.expires) > new Date() ? s : null;
    } catch {
      return null;
    }
  };
  const setSession = (user) => {
    try {
      if (!user) localStorage.removeItem(key);
      else
        localStorage.setItem(key, JSON.stringify({
          user,
          expires: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        }));
    } catch {
      /* ignore */
    }
  };
  const requireUser = () => {
    const s = getSession();
    if (!s) throw new HttpError(401, "Not authenticated");
    return s.user;
  };
  return { getSession, setSession, requireUser };
}

function absoluteUrl(url) {
  const origin = window.location.origin;
  if (!url) return origin + BASE + "/";
  if (/^https?:\/\//.test(url)) return url;
  return origin + (BASE && url.startsWith(BASE + "/") ? "" : BASE) + url;
}

// Emulates the NextAuth v4 REST endpoints that next-auth/react calls for the
// credentials provider: session, csrf, providers, callback, signout.
export async function handleNextAuth(action, init, auth, authorize) {
  const origin = window.location.origin;
  const form = () => new URLSearchParams(init.body || "");
  switch (action) {
    case "session":
      return json(auth.getSession() || {});
    case "csrf":
      return json({ csrfToken: "static-demo" });
    case "providers":
      return json({
        credentials: {
          id: "credentials",
          name: "credentials",
          type: "credentials",
          signinUrl: origin + "/api/auth/signin/credentials",
          callbackUrl: origin + "/api/auth/callback/credentials",
        },
      });
    case "callback/credentials": {
      const f = form();
      const user = await authorize(f.get("email") || "", f.get("password") || "");
      if (!user) return json({ url: origin + BASE + "/api/auth/error?error=CredentialsSignin" }, 401);
      auth.setSession(user);
      return json({ url: absoluteUrl(f.get("callbackUrl")) });
    }
    case "signout":
      auth.setSession(null);
      return json({ url: absoluteUrl(form().get("callbackUrl") || "/") });
    case "_log":
      return json({});
    default:
      return json({ error: "Not found" }, 404);
  }
}

// Routes every fetch whose path contains /api/ to handler(path, init, url)
export function installFetch(handler) {
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    const i = url.origin === window.location.origin ? url.pathname.indexOf("/api/") : -1;
    if (i === -1) return realFetch(input, init);
    const path = url.pathname.slice(i).replace(/\/$/, "");
    return Promise.resolve()
      .then(() => handler(path, init, url))
      .catch((err) => {
        if (err instanceof HttpError) return json({ error: err.message }, err.status);
        if (err && err.issues) return json({ error: "Invalid input" }, 400);
        console.error(err);
        return json({ error: "Internal server error" }, 500);
      });
  };
}
