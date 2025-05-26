const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentDocUrl = "";

const allowedEmails = ['cindyclaralid@gmail.com', 'a.taveras@unphu.edu.do', 'aaguilar@unphu.edu.do' , 'cguzman@unphu.edu.do'];
const adminEmail = 'cindyclaralid@gmail.com';

function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(alert);
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

    if (user.email === adminEmail) {
      document.getElementById("adminSection").style.display = "block";
    } else {
      document.getElementById("adminSection").style.display = "none";
    }

    loadDocumentURL();
    loadComments();
  } else {
    auth.signOut().then(() => {
      document.body.innerHTML = '<div style="padding:20px;font-family:sans-serif;"><h2>❌ Acceso no autorizado</h2><p>Este correo no está autorizado para usar esta plataforma.</p></div>';
    });
  }
});

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
    const embedUrl = docId ? `https://docs.google.com/document/d/${docId}/preview` : "";
    document.getElementById("viewer").innerHTML = embedUrl ? `<iframe src="${embedUrl}"></iframe>` : "No se ha configurado un documento.";
  }
}

async function addComment() {
  const text = document.getElementById("commentText").value;
  const page = document.getElementById("commentPage").value;
  if (!text || !currentUser) return;
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
  const pending = document.getElementById("pendingComments");
  const resolved = document.getElementById("resolvedComments");
  pending.innerHTML = "";
  resolved.innerHTML = "";

  const snapshot = await db.collection("comentarios").orderBy("timestamp", "desc").get();
  snapshot.forEach(doc => {
    const c = doc.data();
    const html = `
      <div class="comment">
        <strong>${c.user} - ${new Date(c.timestamp).toLocaleString()}</strong><br>
        Página: ${c.page || 'No indicada'}<br>
        ${c.text}<br>
        ${c.resolved 
          ? "<div class='resolved'>✅ Resuelto</div>"
          : `<button onclick="resolveComment('${doc.id}')">Marcar como resuelto</button>`}
        <button onclick="deleteComment('${doc.id}')">Eliminar</button>
      </div>
    `;
    if (c.resolved) {
      resolved.innerHTML += html;
    } else {
      pending.innerHTML += html;
    }
  });
}