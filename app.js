// ====== Firebase ======
const auth = firebase.auth();
const db   = firebase.firestore();

let currentUser = null;
const allowedEmails = [
  'cindyclaralid@gmail.com',
  'a.taveras@unphu.edu.do',
  'aaguilar@unphu.edu.do',
  'cguzman@unphu.edu.do'
];

// ====== Notificaciones ======
if ('Notification' in window) {
  Notification.requestPermission().then(p => {
    console.log('Permiso de notificaciones:', p);
  });
}

// ====== Auth ======
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => alert(err.message));
}
function logout() {
  auth.signOut().then(() => location.reload());
}
auth.onAuthStateChanged(user => {
  if (!user) {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('appSection').style.display   = 'none';
    return;
  }
  if (!allowedEmails.includes(user.email)) {
    auth.signOut().then(() => {
      document.body.innerHTML = '<p>Acceso no autorizado</p>';
    });
    return;
  }
  currentUser = user;
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('appSection').style.display   = 'block';
  loadComments();
});

// ====== CRUD Comentarios ======
async function addComment() {
  const textEl = document.getElementById("commentText");
  const pageEl = document.getElementById("commentPage");
  const text = textEl.value.trim();
  const page = pageEl.value.trim();
  if (!text) return alert('Escribe algo antes de enviar.');
  await db.collection("comentarios").add({
    user:      currentUser.email,
    text,
    page,
    resolved:  false,
    timestamp: Date.now()
  });
  textEl.value = '';
  pageEl.value = '';
  loadComments();
}

function resolveComment(id) {
  db.collection("comentarios").doc(id).update({ resolved: true });
  loadComments();
}

function deleteComment(id) {
  db.collection("comentarios").doc(id).delete();
  loadComments();
}

// ====== Mostrar comentarios & notificar ======
async function loadComments() {
  const pendEl    = document.getElementById("pendingComments");
  const resEl     = document.getElementById("resolvedComments");
  const pendCntEl = document.getElementById("pendingCount");
  const resCntEl  = document.getElementById("resolvedCount");

  pendEl.innerHTML = "";
  resEl.innerHTML  = "";
  let pendCount = 0, resCount = 0;

  const snap = await db.collection("comentarios")
    .orderBy("timestamp", "desc")
    .get();

  snap.forEach(doc => {
    const c = doc.data();
    const tpl = `
      <div class="comment">
        <strong>${c.user} – ${new Date(c.timestamp).toLocaleString()}</strong><br>
        Página: ${c.page || '—'}<br>
        ${c.text}<br>
        ${c.resolved
          ? "<span>✅ Resuelto</span>"
          : `<button onclick="resolveComment('${doc.id}')">Marcar resuelto</button>`}
        <button onclick="deleteComment('${doc.id}')">Eliminar</button>
      </div>
    `;
    if (c.resolved) {
      resEl.innerHTML += tpl;
      resCount++;
    } else {
      pendEl.innerHTML += tpl;
      pendCount++;
      if (Notification.permission === 'granted') {
        new Notification(`Nuevo comentario de ${c.user}`, {
          body: c.text.slice(0, 50) + '…',
          tag: doc.id
        });
      }
    }
  });

  pendCntEl.innerText = pendCount;
  resCntEl.innerText  = resCount;
}
