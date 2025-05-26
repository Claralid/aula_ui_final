// app.js
// Solicita permiso de notificaciones al cargar
if ('Notification' in window) {
  Notification.requestPermission().then(permission => {
    console.log('Permiso de notificaciones:', permission);
  });
}

const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentDocUrl = "";

const allowedEmails = [
  'cindyclaralid@gmail.com',
  'a.taveras@unphu.edu.do',
  'aaguilar@unphu.edu.do',
  'cguzman@unphu.edu.do'
];
const adminEmail = 'cindyclaralid@gmail.com';

function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => alert(err.message));
}

function logout() {
  auth.signOut().then(() => location.reload());
}

auth.onAuthStateChanged(user => {
  if (!user) return;

  if (allowedEmails.includes(user.email)) {
    currentUser = user;
    document.getElementById("username").innerText = user.displayName;
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("mainApp").style.display = "block";

    // Muestra sección admin solo al admin
    document.getElementById("adminSection").style.display =
      user.email === adminEmail ? "block" : "none";

    loadDocumentURL();
    loadComments();
  } else {
    auth.signOut().then(() => {
      document.body.innerHTML = '<p>Acceso no autorizado</p>';
    });
  }
});

// Guarda el enlace de Google Docs
function setDocURL() {
  const url = document.getElementById("docUrl").value;
  db.collection("config").doc("docLink").set({ url });
  loadDocumentURL();
}

async function loadDocumentURL() {
  const doc = await db.collection("config").doc("docLink").get();
  if (doc.exists) {
    currentDocUrl = doc.data().url;
    const match = currentDocUrl.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    const docId = match ? match[1] : null;
    const embedUrl = docId
      ? `https://docs.google.com/document/d/${docId}/preview`
      : "";
    document.getElementById("viewer").innerHTML = embedUrl
      ? `<iframe src="${embedUrl}" width="100%" height="600px"></iframe>`
      : "No se ha configurado un documento.";
  }
}

async function addComment() {
  const text = document.getElementById("commentText").value.trim();
  const page = document.getElementById("commentPage").value.trim();
  if (!text || !currentUser) return alert('Escribe un comentario antes de enviar.');

  await db.collection("comentarios").add({
    text,
    page,
    timestamp: new Date().toISOString(),
    user: currentUser.displayName,
    email: currentUser.email,
    resolved: false
  });

  document.getElementById("commentText").value = "";
  document.getElementById("commentPage").value = "";
  loadComments();
}

async function resolveComment(id) {
  await db.collection("comentarios").doc(id).update({ resolved: true });
  loadComments();
}

async function deleteComment(id) {
  if (confirm("¿Estás segura de que quieres eliminar este comentario?")) {
    await db.collection("comentarios").doc(id).delete();
    loadComments();
  }
}

async function loadComments() {
  const pendingEl  = document.getElementById("pendingComments");
  const resolvedEl = document.getElementById("resolvedComments");
  const pendingCountEl  = document.getElementById("pendingCount");
  const resolvedCountEl = document.getElementById("resolvedCount");

  pendingEl.innerHTML  = "";
  resolvedEl.innerHTML = "";

  let pendingCount = 0;
  let resolvedCount = 0;

  const snapshot = await db.collection("comentarios")
    .orderBy("timestamp", "desc")
    .get();

  snapshot.forEach(doc => {
    const c = doc.data();
    const dateStr = new Date(c.timestamp).toLocaleString();
    const html = `
      <div class="comment">
        <strong>${c.user} - ${dateStr}</strong><br>
        Página: ${c.page || 'No indicada'}<br>
        ${c.text}<br>
        ${c.resolved
          ? "<div class='resolved'>✅ Resuelto</div>"
          : `<button class="btn-resolve" onclick="resolveComment('${doc.id}')">Marcar como resuelto</button>`}
        <button class="btn-delete" onclick="deleteComment('${doc.id}')">Eliminar</button>
      </div>
    `;

    if (c.resolved) {
      resolvedEl.innerHTML += html;
      resolvedCount++;
    } else {
      pendingEl.innerHTML += html;
      pendingCount++;
      if (Notification.permission === 'granted') {
        new Notification('Nuevo comentario de ' + c.user, {
          body: c.text.substring(0, 50) + '...',
          tag: doc.id
        });
      }
    }
  });

  pendingCountEl.innerText  = pendingCount;
  resolvedCountEl.innerText = resolvedCount;
}
