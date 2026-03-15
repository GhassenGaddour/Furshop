"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

/* ─────────────── SUPABASE ─────────────── */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/* ─────────────── PARSERS ─────────────── */
function parseItems(text) {
  const items = [];
  const regex = new RegExp("ITEM_START\\s+NAME:\\s*(.+?)\\s*\\nBRAND:\\s*(.+?)\\s*\\nPRICE:\\s*(.+?)\\s*\\nDESCRIPTION:\\s*([\\s\\S]+?)\\nPET_TYPE:\\s*(.+?)\\s*\\nURL:\\s*(.+?)\\s*\\nIMAGE:\\s*(.*?)\\s*\\nITEM_END", "g");
  let m;
  while ((m = regex.exec(text)) !== null) {
    items.push({ name: m[1].trim(), brand: m[2].trim(), price: m[3].trim(), description: m[4].trim(), petType: m[5].trim().toLowerCase(), url: m[6].trim(), image: m[7].trim(), id: Math.random().toString(36).slice(2, 9) });
  }
  const cleaned = text.replace(/ITEM_START[\s\S]*?ITEM_END/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return { items, conversationalText: cleaned };
}

function findBestValueId(items) {
  if (!items || items.length === 0) return null;
  let bestId = null;
  let lowestPrice = Infinity;
  items.forEach((item) => {
    const match = item.price.replace(/[^0-9.,]/g, "").replace(",", ".");
    const num = parseFloat(match);
    if (!isNaN(num) && num < lowestPrice) {
      lowestPrice = num;
      bestId = item.id;
    }
  });
  return bestId;
}

/* ─────────────── THEME ─────────────── */
const DARK = {
  key: "dark", bg: "#0D0F0B", bgWarm: "#111408", surface: "#181C13", surfaceHover: "#1E2418",
  card: "#141810", border: "#263020", borderLight: "#344030",
  orange: "#D4620A", orangeLight: "#E8771F", orangeDeep: "#A84C08",
  orangeGlow: "#F08030", green: "#5A8C3A", greenLight: "#6FA348", greenDim: "#3D6028",
  cream: "#F5EFE0", textPrimary: "#EDE8D8", textSecondary: "#9A9080",
  textDim: "#666050", textFaint: "#2E3020",
  userBubble: "linear-gradient(135deg, #D4620A, #A84C08)",
  userBubbleBorder: "rgba(212,98,10,0.25)", userBubbleShadow: "rgba(212,98,10,0.3)",
  userBubbleText: "#F5EFE0", scrollThumb: "rgba(212,98,10,0.4)", inputBg: "#181C13",
};
const LIGHT = {
  key: "light", bg: "#FAF8F2", bgWarm: "#F5F2EA", surface: "#FFFFFF", surfaceHover: "#FDF9F4",
  card: "#FFFFFF", border: "#E5DFD0", borderLight: "#D5CCBC",
  orange: "#D4620A", orangeLight: "#E8771F", orangeDeep: "#A84C08",
  orangeGlow: "#F08030", green: "#5A8C3A", greenLight: "#6FA348", greenDim: "#4A7030",
  cream: "#FFFFFF", textPrimary: "#1A1808", textSecondary: "#6B6050",
  textDim: "#9C9080", textFaint: "#D8D0C0",
  userBubble: "linear-gradient(135deg, #D4620A, #E8771F)",
  userBubbleBorder: "rgba(212,98,10,0.2)", userBubbleShadow: "rgba(212,98,10,0.18)",
  userBubbleText: "#FFFFFF", scrollThumb: "rgba(212,98,10,0.2)", inputBg: "#FFFFFF",
};

const PET_FILTERS = ["All", "Dog", "Cat"];

const QUICK = [
  "High-protein dry food for an adult Labrador",
  "Interactive toys for a bored indoor cat",
  "Waterproof jacket for a small dog, under \u20ac40",
  "Best value flea treatment for cats",
];

/* ─────────────── API ─────────────── */
async function callChat(messages) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.text || "Something went wrong — try again?";
}

/* ─────────────── AUTH SCREEN ─────────────── */
function AuthScreen({ onAuth, C }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    if (!email || !password) { setError("Please fill in all fields"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      if (!supabase) { setError("Auth not configured"); setLoading(false); return; }
      if (isLogin) {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onAuth(data.user);
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        if (data.user?.identities?.length === 0) {
          setError("An account with this email already exists");
        } else {
          setSuccess("Account created! Check your email to confirm, then log in.");
          setIsLogin(true);
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div style={{ width: "100%", height: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 24, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${C.orange}0C 0%, transparent 65%)`, filter: "blur(60px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 250, height: 250, borderRadius: "50%", top: "20%", right: "10%", background: `radial-gradient(circle, ${C.green}08 0%, transparent 65%)`, filter: "blur(40px)", pointerEvents: "none" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, margin: "0 auto 16px", background: `linear-gradient(145deg, ${C.orange}, ${C.orangeDeep})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 6px 24px ${C.orange}35` }}>
          <span style={{ fontSize: 30 }}>🐾</span>
        </div>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 34, fontWeight: 800, color: C.textPrimary, marginBottom: 4 }}>
          Fur<span style={{ color: C.orangeLight }}>Shop</span>
        </div>
        <div style={{ fontSize: 12, color: C.greenDim, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 32 }}>Pet Product Discovery</div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, textAlign: "left" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: C.textPrimary, marginBottom: 20 }}>{isLogin ? "Welcome back" : "Create account"}</div>
          {error && <div style={{ background: `${C.orange}15`, border: `1px solid ${C.orange}30`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: C.orangeLight }}>{error}</div>}
          {success && <div style={{ background: `${C.green}15`, border: `1px solid ${C.green}30`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: C.greenLight }}>{success}</div>}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 6, letterSpacing: "0.05em" }}>EMAIL</div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" onKeyDown={e => e.key === "Enter" && handleSubmit()} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.textPrimary, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 6, letterSpacing: "0.05em" }}>PASSWORD</div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" onKeyDown={e => e.key === "Enter" && handleSubmit()} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.textPrimary, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
          </div>
          <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDeep})`, color: "#FFFFFF", fontSize: 15, fontWeight: 600, cursor: loading ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif", opacity: loading ? 0.6 : 1, boxShadow: `0 4px 18px ${C.orange}30`, transition: "opacity 0.3s" }}>
            {loading ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
          </button>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: C.textDim }}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <span onClick={() => { setIsLogin(!isLogin); setError(""); setSuccess(""); }} style={{ color: C.orangeLight, cursor: "pointer", fontWeight: 600 }}>{isLogin ? "Sign up" : "Sign in"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── TYPING DOTS ─────────────── */
function TypingDots({ C }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "6px 0", alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: C.orangeLight, animation: `breathe 1.6s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </div>
  );
}

/* ─────────────── THEME TOGGLE ─────────────── */
function ThemeToggle({ isDark, onToggle, C }) {
  return (
    <button onClick={onToggle} style={{ width: 52, height: 28, borderRadius: 14, border: `1px solid ${C.border}`, background: isDark ? C.surface : C.border, cursor: "pointer", position: "relative", transition: "all 0.4s ease", flexShrink: 0, padding: 0 }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: isDark ? `linear-gradient(135deg, ${C.orange}, ${C.orangeDeep})` : `linear-gradient(135deg, ${C.green}, ${C.greenDim})`, position: "absolute", top: 2, left: isDark ? 3 : 26, transition: "all 0.4s cubic-bezier(0.68,-0.55,0.27,1.55)", boxShadow: isDark ? `0 2px 8px ${C.orange}50` : `0 2px 8px ${C.green}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11 }}>{isDark ? "🌙" : "☀️"}</span>
      </div>
    </button>
  );
}

/* ─────────────── ITEM CARD ─────────────── */
function ItemCard({ item, index, variant, C, isBestValue }) {
  const [hovered, setHovered] = useState(false);
  const isFeed = variant === "feed";
  const isDark = C.key === "dark";
  const accentColor = item.petType === "cat" ? C.green : C.orange;
  const accentLight = item.petType === "cat" ? C.greenLight : C.orangeLight;

  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: "block", textDecoration: "none", color: "inherit", background: C.card, border: `1px solid ${hovered ? C.borderLight : C.border}`, borderRadius: isFeed ? 10 : 8, padding: isFeed ? 0 : "16px 18px", marginTop: isFeed ? 0 : 12, overflow: "hidden", transition: "all 0.4s cubic-bezier(0.25,0.1,0.25,1)", transform: hovered ? "translateY(-2px)" : "none", boxShadow: hovered ? `0 14px 44px rgba(212,98,10,0.12)` : `0 2px 10px rgba(0,0,0,${isDark ? "0.2" : "0.06"})`, position: "relative" }}>
      {isBestValue && (
        <div style={{ position: "absolute", top: 8, left: 8, zIndex: 2, background: `linear-gradient(135deg, ${C.green}, ${C.greenDim})`, color: "#FFFFFF", fontSize: 9.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20, letterSpacing: "0.08em", textTransform: "uppercase", boxShadow: `0 2px 8px ${C.green}50` }}>Best Value</div>
      )}
      {isFeed && (
        <div style={{ height: 130, position: "relative", overflow: "hidden", background: isDark ? `linear-gradient(160deg, ${accentColor}14, ${C.bg})` : `linear-gradient(160deg, ${accentColor}0A, ${C.bg})` }}>
          {item.image ? (
            <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} onError={e => { e.currentTarget.style.display = "none"; }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, opacity: 0.3 }}>
              {item.petType === "cat" ? "🐱" : "🐶"}
            </div>
          )}
          <div style={{ position: "absolute", bottom: 12, left: 14, background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)`, padding: "5px 14px", borderRadius: 5, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#FFFFFF", boxShadow: `0 2px 10px ${accentColor}40` }}>{item.price}</div>
          <div style={{ position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: "50%", background: hovered ? `${accentColor}20` : `${C.bg}50`, border: `1px solid ${hovered ? accentLight : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={hovered ? accentLight : C.textDim} strokeWidth="2.5"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg>
          </div>
        </div>
      )}
      <div style={{ padding: isFeed ? "14px 14px 16px" : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, fontWeight: 600, color: accentLight, letterSpacing: "0.16em", textTransform: "uppercase" }}>{item.brand}</div>
          <span style={{ fontSize: 10, opacity: 0.5 }}>{item.petType === "cat" ? "🐱" : "🐶"}</span>
        </div>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: isFeed ? 14 : 15, fontWeight: 700, color: C.textPrimary, lineHeight: 1.35, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.name}</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.textSecondary, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: isFeed ? 2 : 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.description}</div>
        {!isFeed && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: accentColor }}>{item.price}</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: hovered ? accentLight : C.textDim, letterSpacing: "0.1em", textTransform: "uppercase", transition: "color 0.3s", display: "flex", alignItems: "center", gap: 5 }}>
              View <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg>
            </span>
          </div>
        )}
      </div>
    </a>
  );
}

/* ─────────────── MESSAGE BUBBLE ─────────────── */
function MessageBubble({ message, C }) {
  const isUser = message.role === "user";
  const { items, conversationalText } = isUser ? { items: [], conversationalText: message.content } : parseItems(message.content);
  const bestValueId = findBestValueId(items);

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 18, animation: "fadeUp 0.4s ease-out" }}>
      {!isUser && (
        <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, marginRight: 10, marginTop: 2, background: `linear-gradient(145deg, ${C.orange}, ${C.orangeDeep})`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.orangeLight}30`, boxShadow: `0 3px 14px ${C.orange}30` }}>
          <span style={{ fontSize: 16 }}>🐾</span>
        </div>
      )}
      <div style={{ maxWidth: isUser ? "72%" : "84%", background: isUser ? C.userBubble : C.surface, color: isUser ? C.userBubbleText : C.textPrimary, padding: isUser ? "11px 18px" : "15px 18px", borderRadius: isUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.65, border: isUser ? `1px solid ${C.userBubbleBorder}` : `1px solid ${C.border}`, fontWeight: isUser ? 500 : 400, boxShadow: isUser ? `0 4px 20px ${C.userBubbleShadow}` : "none" }}>
        {conversationalText && <div style={{ whiteSpace: "pre-wrap" }}>{conversationalText}</div>}
        {items.length > 0 && (
          <div style={{ marginTop: conversationalText ? 14 : 0 }}>
            {items.map((item, i) => <ItemCard key={i} item={item} index={i} variant="chat" C={C} isBestValue={item.id === bestValueId} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── MAIN APP ─────────────── */
export default function FurShop() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [petFilter, setPetFilter] = useState("All");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const C = isDark ? DARK : LIGHT;

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    supabase.from("user_collections").select("items").eq("user_id", user.id).single()
      .then(({ data }) => { if (data?.items) setSavedItems(data.items); });
  }, [user]);

  useEffect(() => {
    if (!user || !supabase || savedItems.length === 0) return;
    const timeout = setTimeout(() => {
      supabase.from("user_collections").upsert({ user_id: user.id, items: savedItems, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [savedItems, user]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    const all = [...savedItems];
    messages.filter(m => m.role === "assistant").forEach(m => {
      const { items } = parseItems(m.content);
      items.forEach(item => {
        if (!all.find(x => x.name === item.name && x.brand === item.brand)) all.push(item);
      });
    });
    if (all.length !== savedItems.length) setSavedItems(all);
  }, [messages]);

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null); setMessages([]); setSavedItems([]);
  };

  const sendMessage = useCallback(async (text) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput("");
    const newMsgs = [...messages, { role: "user", content: msg }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const reply = await callChat(newMsgs.map(m => ({ role: m.role, content: m.content })));
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection issue — please try again." }]);
    } finally { setLoading(false); }
  }, [messages, loading]);

  const filteredSaved = petFilter === "All" ? savedItems : savedItems.filter(i => i.petType === petFilter.toLowerCase());
  const bestValueId = findBestValueId(filteredSaved);

  if (authLoading) {
    return (
      <div style={{ width: "100%", height: "100vh", background: DARK.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 28, fontWeight: 800, color: DARK.textPrimary }}>
          Fur<span style={{ color: DARK.orangeLight }}>Shop</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <style>{`input:focus { border-color: #D4620A !important; }`}</style>
        <AuthScreen onAuth={setUser} C={isDark ? DARK : LIGHT} />
      </>
    );
  }

  return (
    <div style={{ width: "100%", height: "100vh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "'DM Sans', sans-serif", transition: "background 0.5s ease" }}>
      <style>{`
        @keyframes breathe{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:.8;transform:scale(1.15)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${C.scrollThumb};border-radius:10px}
        textarea:focus,button:focus{outline:none}
      `}</style>

      {/* HEADER */}
      <div style={{ padding: "18px 20px 0", flexShrink: 0, background: C.bgWarm, borderBottom: `1px solid ${C.border}`, transition: "all 0.5s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(145deg, ${C.orange}, ${C.orangeDeep})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 18px ${C.orange}30` }}>
              <span style={{ fontSize: 20 }}>🐾</span>
            </div>
            <div>
              <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 24, fontWeight: 800, color: C.textPrimary, letterSpacing: "-0.01em" }}>
                Fur<span style={{ color: C.orangeLight }}>Shop</span>
              </div>
              <div style={{ fontSize: 9.5, color: C.greenDim, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", marginTop: -1 }}>Pet Product Discovery</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} C={C} />
            <button onClick={handleLogout} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 11, color: C.textDim, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Sign out</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 32, paddingLeft: 2 }}>
          {[{ id: "chat", label: "Chat" }, { id: "saved", label: "Saved", badge: savedItems.length || null }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 14px", color: tab === t.id ? C.textPrimary : C.textDim, fontSize: 14, fontWeight: tab === t.id ? 600 : 400, fontFamily: "'DM Sans', sans-serif", borderBottom: tab === t.id ? `2px solid ${C.orange}` : "2px solid transparent", transition: "all 0.3s", display: "flex", alignItems: "center", gap: 7 }}>
              {t.label}
              {t.badge && <span style={{ background: `${C.orange}20`, color: C.orangeLight, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, border: `1px solid ${C.orange}25` }}>{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* CHAT TAB */}
      {tab === "chat" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px 18px" }}>
            {messages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", animation: "fadeUp 0.6s ease-out" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🐾</div>
                <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 32, fontWeight: 800, color: C.textPrimary, lineHeight: 1.2, marginBottom: 10 }}>
                  What does your<br />
                  <span style={{ color: C.orangeLight }}>furry friend</span> need?
                </div>
                <div style={{ fontSize: 14, color: C.textSecondary, maxWidth: 300, lineHeight: 1.65, marginBottom: 32 }}>
                  Describe your pet and what you need — I'll find real products with prices and links.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 340 }}>
                  {QUICK.map((p, i) => (
                    <button key={i} onClick={() => sendMessage(p)}
                      style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", fontSize: 13.5, color: C.textSecondary, textAlign: "left", fontFamily: "'DM Sans', sans-serif", cursor: "pointer", transition: "all 0.35s", display: "flex", alignItems: "center", gap: 12 }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.orange + "50"; e.currentTarget.style.color = C.textPrimary; e.currentTarget.style.background = C.surfaceHover; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSecondary; e.currentTarget.style.background = C.surface; }}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.orange, flexShrink: 0, opacity: 0.5 }} />
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => <MessageBubble key={i} message={msg} C={C} />)}
            {loading && (
              <div style={{ display: "flex", gap: 10, animation: "fadeUp 0.3s ease-out" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(145deg, ${C.orange}, ${C.orangeDeep})`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.orangeLight}30`, boxShadow: `0 3px 14px ${C.orange}30` }}>
                  <span style={{ fontSize: 16 }}>🐾</span>
                </div>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "18px 18px 18px 4px", padding: "12px 18px" }}>
                  <div style={{ fontSize: 11, color: C.textDim, fontWeight: 500, marginBottom: 2 }}>Finding products...</div>
                  <TypingDots C={C} />
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: "12px 18px 18px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: C.inputBg, borderRadius: 14, padding: "5px 5px 5px 18px", border: `1px solid ${C.border}` }}>
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder="Describe what your pet needs..." rows={1}
                style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: C.textPrimary, resize: "none", padding: "10px 0", lineHeight: 1.5 }} />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading} style={{ width: 42, height: 42, borderRadius: 12, border: "none", background: input.trim() && !loading ? `linear-gradient(135deg, ${C.orange}, ${C.orangeDeep})` : C.textFaint, cursor: input.trim() && !loading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s", flexShrink: 0, boxShadow: input.trim() && !loading ? `0 4px 14px ${C.orange}30` : "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !loading ? "#FFFFFF" : C.textDim} strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVED TAB */}
      {tab === "saved" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {savedItems.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 28, animation: "fadeUp 0.5s ease-out" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🛒</div>
              <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 22, fontWeight: 800, color: C.textPrimary, marginBottom: 8 }}>No saved products yet</div>
              <div style={{ fontSize: 14, color: C.textSecondary, maxWidth: 280, lineHeight: 1.6, marginBottom: 24 }}>Chat with FurShop and every product discovered will appear here automatically.</div>
              <button onClick={() => setTab("chat")} style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDeep})`, color: "#FFFFFF", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: `0 4px 18px ${C.orange}30` }}>Start exploring</button>
            </div>
          ) : (
            <>
              <div style={{ padding: "18px 18px 0", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 20, fontWeight: 800, color: C.textPrimary }}>Saved Products</div>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 3, fontWeight: 500 }}>{savedItems.length} product{savedItems.length !== 1 ? "s" : ""} found</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 14 }}>
                  {PET_FILTERS.map(f => {
                    const count = f === "All" ? savedItems.length : savedItems.filter(i => i.petType === f.toLowerCase()).length;
                    if (f !== "All" && count === 0) return null;
                    const active = petFilter === f;
                    return (
                      <button key={f} onClick={() => setPetFilter(f)} style={{ background: active ? `linear-gradient(135deg, ${C.orange}, ${C.orangeDeep})` : "transparent", color: active ? "#FFFFFF" : C.textDim, border: `1px solid ${active ? C.orange : C.border}`, borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", transition: "all 0.3s", boxShadow: active ? `0 2px 10px ${C.orange}20` : "none" }}>
                        {f}{f !== "All" && ` (${count})`}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 20px" }}>
                {filteredSaved.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: C.textDim, fontSize: 13 }}>No {petFilter.toLowerCase()} products yet.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {filteredSaved.map((item, i) => (
                      <div key={item.id || i} style={{ animation: `fadeUp 0.4s ease-out ${i * 0.05}s both` }}>
                        <ItemCard item={item} index={i} variant="feed" C={C} isBestValue={item.id === bestValueId} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
