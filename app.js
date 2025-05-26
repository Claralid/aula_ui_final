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

// Pedir permiso de notificaciones
if ('Notification' in window) {
  Notification.requestPermission().then(permission => {
    console.log('Permiso de notificaciones:', permission);
  });
}

// Login/logout
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => alert(err.message));
}
function logout() {
  auth.signOut().then(() => location.reload());
}

// Manejo de estado de autenticación
auth.onAuthStateChanged(user => {
  if (!user) {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
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
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('username').innerText = user.email;
  loadComments();
});

// Guardar enlace de Google Docs (solo admin)
async function setDocURL() {
  if (currentUser.email !== adminEmail) return;
  const url = document.getElementById('docUrl').value.trim();
  if (!url) return alert('Pega un enlace válido.');
  await db.collection('config').doc('doc').set({ url });
  loadViewer(url);
}

// Cargar viewer
async function loadViewer(manualUrl) {
  const url = manualUrl || (await db.collection('config').doc('doc').get()).data().url;
  document.getElementById('viewer').innerHTML = `<iframe src="${url}" frameborder="0"></iframe>`;
}

// Agregar comentario
async function addComment() {
  const textEl = document.getElementById('commentText');
  const pageEl = document.getElementById('commentPage');
  const text = textEl.value.trim();
  const page = pageEl.value.trim();
  if (!text) return alert('Escribe algo antes de enviar.');
  await db.collection('comentarios').add({
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

// Marcar como resuelto
function resolveComment(id) {
  db.collection('comentarios').doc(id).update({ resolved: true });
  loadComments();
}

// Eliminar comentario
function deleteComment(id) {
  db.collection('comentarios').doc(id).delete();
  loadComments();
}

// Cargar y renderizar comentarios + notificaciones
async function loadComments() {
  const pendingEl = document.getElementById('pendingComments');
  const resolvedEl = document.getElementById('resolvedComments');
  const pendingCountEl = document.getElementById('pendingCount');
  const resolvedCountEl = document.getElementById('resolvedCount');

  pendingEl.innerHTML = '';
  resolvedEl.innerHTML = '';

  let pendingCount = 0;
  let resolvedCount = 0;

  const snapshot = await db.collection('comentarios')
    .orderBy('timestamp', 'desc')
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
      resolvedEl.insertAdjacentHTML('beforeend', html);
      resolvedCount++;
    } else {
      pendingEl.insertAdjacentHTML('beforeend', html);
      pendingCount++;
      // Web Push Notification
      if (Notification.permission === 'granted') {
        new Notification(`Nuevo comentario de ${c.user}`, {
          body: c.text.substring(0, 50) + '…',
          tag: doc.id
        });
      }
    }
  });

  pendingCountEl.innerText = pendingCount;
  resolvedCountEl.innerText = resolvedCount;
}
