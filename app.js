// Inicializa Firebase Auth y Firestore
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

// 1) Pedir permiso de notificaciones nada más cargar el script
if ('Notification' in window) {
  Notification.requestPermission().then(permission => {
    console.log('Permiso de notificaciones:', permission);
  });
}

// Funciones de login/logout
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => alert(err.message));
}

function logout() {
  auth.signOut().then(() => location.reload());
}

// Listener de estado de autenticación
auth.onAuthStateChanged(user => {
  if (!user) {
    // mostrar login, ocultar app
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('appSection').style.display = 'none';
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
  document.getElementById('appSection').style.display = 'block';
  loadComments();
});

// Añade un nuevo comentario
async function addComment() {
  const textEl = document.getElementById("commentText");
  const pageEl = document.getElementById("commentPage");
  const text = textEl.value.trim();
  const page = pageEl.value.trim();
  if (!text) return alert('Escribe algo antes de enviar.');
  await db.collection("comentarios").add({
    user: currentUser.email,
    text,
    page,
    resolved: false,
    timestamp: Date.now()
  });
  textEl.value = '';
  pageEl.value = '';
  loadComments();
}

// Marca un comentario como resuelto
function resolveComment(id) {
  db.collection("comentarios").doc(id).update({ resolved: true });
  loadComments();
}

// Elimina un comentario
function deleteComment(id) {
  db.collection("comentarios").doc(id).delete();
  loadComments();
}

// Carga y renderiza los comentarios, actualiza contadores y dispara notificaciones
async function loadComments() {
  const pendingEl = document.getElementById("pendingComments");
  const resolvedEl = document.getElementById("resolvedComments");
  const pendingCountEl = document.getElementById("pendingCount");
  const resolvedCountEl = document.getElementById("resolvedCount");

  pendingEl.innerHTML = "";
  resolvedEl.innerHTML = "";

  let pendingCount = 0;
  let resolvedCount = 0;

  const snapshot = await db.collection("comentarios")
    .orderBy("timestamp", "desc")
    .get();

  snapshot.forEach(doc => {
    const c = doc.data();
    const html = `
      <div class="comment">
        <strong>${c.user} - ${new Date(c.timestamp).toLocaleString()}</strong><br>
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

      // Dispara notificación para cada comentario nuevo no resuelto
      if (Notification.permission === 'granted') {
        new Notification('Nuevo comentario de ' + c.user, {
          body: c.text.substring(0, 50) + '…',
          tag: doc.id
        });
      }
    }
  });

  // Actualiza los contadores en el DOM
  pendingCountEl.innerText = pendingCount;
  resolvedCountEl.innerText = resolvedCount;
}
