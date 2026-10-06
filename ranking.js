import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, query, orderBy, limit, getDocs }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Cole aqui o objeto que o Firebase mostra ao registrar o app web.
// Essas chaves são públicas por design: a segurança vem das regras do Firestore.
const firebaseConfig = {
  apiKey: "AIzaSyDyMYeuthf9Prdt3wGWyusE65p-LI5x-RE",
  authDomain: "projeto-flappy.firebaseapp.com",
  projectId: "projeto-flappy",
  appId: "1:415400652187:web:5bba7d6d53b716a5aa853e"
};

const $ = id => document.getElementById(id);
const configured = !firebaseConfig.apiKey.startsWith("COLE");
let auth, db, user = null, serverBest = 0;

function explain(e) {
  const c = (e && e.code) || "";
  if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return "";
  if (c === "auth/unauthorized-domain") return `Domínio não autorizado. No Firebase, em Authentication → Settings → Authorized domains, adicione: ${location.hostname}`;
  if (c === "auth/popup-blocked") return "O navegador bloqueou a janela de login. Permita pop-ups neste site.";
  if (c === "auth/operation-not-allowed") return "Ative o provedor Google em Authentication → Sign-in method.";
  if (c.includes("api-key")) return "Chave do Firebase inválida. Confira o firebaseConfig no ranking.js.";
  if (c === "permission-denied") return "O Firestore recusou. Confira se as regras do firestore.rules foram publicadas.";
  return "Erro: " + (c || (e && e.message) || e);
}
const fail = e => { console.error(e); window.showMsg(explain(e)); };

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
    user = u;
    $("login").textContent = u ? "Sair" : "Entrar com Google";
    $("who").textContent = u ? u.displayName.split(" ")[0] : "";
    serverBest = 0;
    try {
      if (u) { const s = await getDoc(doc(db, "scores", u.uid)); if (s.exists()) serverBest = s.data().best; }
    } catch (e) { fail(e); }
    loadTop();
  });
}

$("login").onclick = async () => {
  window.showMsg("");
  if (!configured) return window.showMsg("Falta preencher o firebaseConfig no arquivo ranking.js.");
  try { user ? await signOut(auth) : await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { fail(e); }
};
$("toggle").addEventListener("click", () => {
  if ($("panel").style.display === "block") {
    if (!configured) $("list").textContent = "Ranking ainda não configurado.";
    loadTop();
  }
});

window.onGameOver = async score => {
  if (!user || score <= serverBest) return;
  try {
    await setDoc(doc(db, "scores", user.uid), {
      name: user.displayName.slice(0, 30), best: score, updatedAt: serverTimestamp()
    });
    serverBest = score; loadTop();
  } catch (e) { fail(e); }
};

window.__rankingReady = true;