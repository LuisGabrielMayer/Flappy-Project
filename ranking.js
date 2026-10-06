import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, query, orderBy, limit, getDocs }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const $ = id => document.getElementById(id);
const configured = !firebaseConfig.apiKey.startsWith("COLE");
const NICK_RE = /^[A-Za-z0-9][A-Za-z0-9_ -]{2,15}$/; // igual à regra do firestore.rules
let auth, db, user = null, nick = null, serverBest = 0, hasDoc = false;

function explain(e) {
  const c = (e && e.code) || "";
  if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return "";
  if (c === "auth/unauthorized-domain") return `Domínio não autorizado. No Firebase, em Authentication → Configurações → Domínios autorizados, adicione: ${location.hostname}`;
  if (c === "auth/popup-blocked") return "O navegador bloqueou a janela de login. Permita pop-ups neste site.";
  if (c === "auth/operation-not-allowed") return "Ative o provedor Google em Authentication → Sign-in method.";
  if (c.includes("api-key")) return "Chave do Firebase inválida. Confira o config.js.";
  if (c === "permission-denied") return "O Firestore recusou. Confira se as regras do firestore.rules foram publicadas.";
  return "Erro: " + (c || (e && e.message) || e);
}
const fail = e => { console.error(e); window.showMsg(explain(e)); };

function updateUI() {
  $("login").textContent = user ? "Sair" : "Entrar com Google";
  $("who").textContent = nick || "";
  $("nickbtn").style.display = user && hasDoc ? "inline-block" : "none";
}
function openNick(required) {
  $("nickin").value = nick || (user.displayName || "").split(" ")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_ -]/g, "").slice(0, 16);
  $("nickerr").textContent = "";
  $("nickcancel").style.display = required ? "none" : "inline-block";
  $("nickbox").style.display = "flex";
  setTimeout(() => $("nickin").focus(), 0);
}
const closeNick = () => { $("nickbox").style.display = "none"; };

async function loadTop() {
  if (!configured) return;
  try {
    const snap = await getDocs(query(collection(db, "scores"), orderBy("best", "desc"), limit(10)));
    const ol = $("list"); ol.textContent = "";
    snap.forEach(d => {
      const li = document.createElement("li");
      li.textContent = `${d.data().name}: ${d.data().best}`; // textContent evita injeção de HTML
      ol.appendChild(li);
    });
    if (snap.empty) ol.textContent = "Ninguém ainda. Seja o primeiro!";
  } catch (e) { fail(e); }
}

if (configured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, async u => {
    user = u; nick = null; serverBest = 0; hasDoc = false;
    if (!u) { closeNick(); updateUI(); loadTop(); return; }
    try {
      const s = await getDoc(doc(db, "scores", u.uid));
      if (s.exists()) { hasDoc = true; nick = s.data().name; serverBest = s.data().best; }
      else openNick(true); // primeiro acesso: apelido obrigatório
    } catch (e) { fail(e); }
    updateUI(); loadTop();
  });
}

$("login").onclick = async () => {
  window.showMsg("");
  if (!configured) return window.showMsg("Falta preencher o firebaseConfig no arquivo config.js.");
  try { user ? await signOut(auth) : await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { fail(e); }
};
$("nickbtn").onclick = () => user && openNick(false);
$("nickcancel").onclick = closeNick;
$("nickin").addEventListener("keydown", e => { if (e.key === "Enter") $("nicksave").click(); });
$("nicksave").onclick = async () => {
  const v = $("nickin").value.trim().replace(/\s+/g, " ");
  if (!NICK_RE.test(v)) { $("nickerr").textContent = "Use 3 a 16 caracteres: letras sem acento, números, espaço, _ ou -, começando por letra ou número."; return; }
  try {
    await setDoc(doc(db, "scores", user.uid), { name: v, best: serverBest, updatedAt: serverTimestamp() });
    nick = v; hasDoc = true; closeNick(); updateUI(); loadTop();
  } catch (e) { console.error(e); $("nickerr").textContent = explain(e) || "Não foi possível salvar."; }
};
$("toggle").addEventListener("click", () => {
  if ($("panel").style.display === "block") {
    if (!configured) $("list").textContent = "Ranking ainda não configurado.";
    loadTop();
  }
});

window.onGameOver = async score => {
  if (!user || !nick || score <= serverBest) return;
  try {
    await setDoc(doc(db, "scores", user.uid), { name: nick, best: score, updatedAt: serverTimestamp() });
    serverBest = score; loadTop();
  } catch (e) { fail(e); }
};

window.getNick = () => nick;
window.__rankingReady = true;
