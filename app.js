// --- Inicialización ---
const auth = firebase.auth();
const db   = firebase.firestore();
let currentUser   = null;
let currentDocUrl = "";

// --- Usuarios válidos ---
const allowedEmails = [
  'cindyclaralid@gmail.com',
  'a.taveras@unphu.edu.do',
  'aaguilar@unphu.edu.do',
  'cguzman@unphu.edu.do'
];
const adminEmail = 'cindyclaralid@gmail.com';
let categoriesMap = {};

// Autenticación
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => alert(err.message));
}

function logout() {
  auth.signOut().then(() => location.reload());
}

auth.onAuthStateChanged(async user => {
  if (!user) return;
  if (!allowedEmails.includes(user.email)) {
    alert('Acceso no autorizado');
    auth.signOut();
    return;
  }
  currentUser = user;
  document.getElementById('username').innerText = user.displayName;
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('mainApp').style.display    = 'block';
  document.getElementById('adminSection').style.display =
    (user.email === adminEmail ? 'block' : 'none');
  await loadDocumentURL();
  await loadCategories();
  await loadComments();
});

// Documento
async function setDocURL() {
  const url = document.getElementById('docUrl').value.trim();
  if (!url) return alert('Pega la URL primero');
  await db.collection('config').doc('docLink').set({ url });
  loadDocumentURL();
}

async function loadDocumentURL() {
  const doc = await db.collection('config').doc('docLink').get();
  if (!doc.exists) return;
  currentDocUrl = doc.data().url;
  const idMatch = currentDocUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const embed   = idMatch
    ? `https://docs.google.com/document/d/${idMatch[1]}/preview`
    : '';
  document.getElementById('viewer').innerHTML = embed
    ? `<iframe src="${embed}" class="w-full h-[600px]"></iframe>`
    : 'No hay documento configurado.';
}

// Categorías
async function loadCategories() {
  const list   = document.getElementById('categoryList');
  const select = document.getElementById('commentArticle');
  list.innerHTML   = '';
  select.innerHTML = '<option value="">Selecciona artículo...</option>';
  const snap = await db.collection('categoriasArticulo').orderBy('nombre').get();
  snap.forEach(d => {
    categoriesMap[d.id] = d.data().nombre;
    list.insertAdjacentHTML('beforeend',
      `<li class="flex justify-between items-center">
         <span>${d.data().nombre}</span>
         <button onclick="deleteCategory('${d.id}')" class="text-red-600 hover:underline text-sm">
           Eliminar
         </button>
       </li>`
    );
    select.insertAdjacentHTML('beforeend',
      `<option value="${d.id}">${d.data().nombre}</option>`
    );
  });
}

async function addCategory() {
  const name = document.getElementById('newCategory').value.trim();
  if (!name) return alert('Escribe un nombre');
  await db.collection('categoriasArticulo').add({ nombre: name });
  document.getElementById('newCategory').value = '';
  loadCategories();
}

async function deleteCategory(id) {
  if (!confirm('¿Eliminar categoría?')) return;
  await db.collection('categoriasArticulo').doc(id).delete();
  loadCategories();
}

function getRelativeTime(ts) {
  const now = Date.now(), then = new Date(ts).getTime();
  const diffM = Math.floor((now - then) / 60000);
  if (diffM < 1) return 'hace unos segundos';
  if (diffM < 60) return `hace ${diffM} minuto${diffM !== 1 ? 's' : ''}`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `hace ${diffH} hora${diffH !== 1 ? 's' : ''}`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD} día${diffD !== 1 ? 's' : ''}`;
}

async function addComment() {
  const text  = document.getElementById('commentText').value.trim();
  const artId = document.getElementById('commentArticle').value;
  const page  = document.getElementById('commentPage').value.trim();
  if (!text) return alert('Comentario vacío');
  await db.collection('comentarios').add({
    text, articleId: artId, page,
    user: currentUser.displayName,
    email: currentUser.email,
    timestamp: new Date().toISOString(),
    resolved: false
  });
  document.getElementById('commentText').value = '';
  document.getElementById('commentPage').value = '';
  loadComments();
}

async function resolveComment(id) {
  await db.collection('comentarios').doc(id).update({ resolved: true });
  loadComments();
}

async function unresolveComment(id) {
  await db.collection('comentarios').doc(id).update({ resolved: false });
  loadComments();
}

function editComment(id, currentText) {
  const newText = prompt('Editar comentario:', currentText);
  if (newText !== null && newText.trim() !== '') {
    db.collection('comentarios').doc(id).update({ text: newText.trim() }).then(loadComments);
  }
}

async function deleteComment(id) {
  if (!confirm('¿Eliminar comentario?')) return;
  await db.collection('comentarios').doc(id).delete();
  loadComments();
}

async function loadComments() {
  const pending  = document.getElementById('pendingComments');
  const resolved = document.getElementById('resolvedComments');
  pending.innerHTML  = '';
  resolved.innerHTML = '';
  const snap = await db.collection('comentarios').orderBy('timestamp','desc').get();
  for (const doc of snap.docs) {
    const c       = doc.data();
    const when    = getRelativeTime(c.timestamp);
    const art     = categoriesMap[c.articleId] || 'No indicado';
    const target  = c.resolved ? resolved : pending;
    const isOwner = currentUser.email === c.email;
    const safeText = c.text.replace(/'/g, "\\'").replace(/\"/g, '&quot;');

    const card = `
      <div class="rounded-lg p-4 space-y-3 shadow" style="background-color: #F2F2F2;">
        <div class="flex items-center justify-between">
          <strong>${c.user}</strong>
          <span class="text-sm text-gray-500">${when}</span>
        </div>
        <ul class="text-sm text-gray-600 list-none">
          <li><i class="fas fa-file-alt text-primary"></i> <strong>Artículo:</strong> ${art}</li>
          <li><i class="fas fa-book-open text-primary"></i> <strong>Página:</strong> ${c.page || '—'}</li>
        </ul>
        <p class="text-gray-800 mt-2">${c.text}</p>
        <div class="flex flex-wrap gap-2 items-center">
          ${!c.resolved && isOwner ? `
            <button onclick="editComment('${doc.id}', '${safeText}')" class="text-blue-600 hover:text-blue-800">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="deleteComment('${doc.id}')" class="text-red-600 hover:text-red-800">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
          <button onclick="${c.resolved ? `unresolveComment('${doc.id}')` : `resolveComment('${doc.id}')`}" class="text-green-700 hover:underline text-sm">
            ${c.resolved ? 'Desmarcar resuelto' : 'Marcar resuelto'}
          </button>
          ${!c.resolved ? `<button onclick="showReplyForm('${doc.id}')" class="text-indigo-600 hover:underline text-sm">Responder</button>` : ''}
        </div>
        ${!c.resolved ? `<div id="replyForm-${doc.id}" class="mt-2" style="display:none;">
          <textarea id="replyText-${doc.id}" class="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Escribe tu respuesta..."></textarea>
          <button class="mt-1 text-green-600 hover:underline text-sm" onclick="addReply('${doc.id}')">Enviar respuesta</button>
        </div>` : ''}
        <div id="replies-${doc.id}" class="mt-2 space-y-2"></div>
      </div>
    `;
    target.insertAdjacentHTML('beforeend', card);

    const repliesSnap = await db.collection('comentarios')
                                .doc(doc.id)
                                .collection('replies')
                                .orderBy('timestamp','asc')
                                .get();
    const repliesContainer = document.getElementById(`replies-${doc.id}`);
    repliesSnap.forEach(rDoc => {
      const r    = rDoc.data();
      const whenR = getRelativeTime(r.timestamp);
      repliesContainer.insertAdjacentHTML('beforeend', `
        <div class="pl-4 border-l-2 border-green-600">
          <div class="text-sm text-gray-500"><strong>${r.user}</strong> • ${whenR}</div>
          <div class="text-gray-800">${r.text}</div>
        </div>
      `);
    });
  }
}

function showReplyForm(commentId) {
  const form = document.getElementById(`replyForm-${commentId}`);
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function addReply(commentId) {
  const txt = document.getElementById(`replyText-${commentId}`).value.trim();
  if (!txt) return alert('Respuesta vacía');
  await db.collection('comentarios')
         .doc(commentId)
         .collection('replies')
         .add({
           text: txt,
           user: currentUser.displayName,
           timestamp: new Date().toISOString()
         });
  loadComments();
}

async function clearResolvedComments() {
  if (!confirm('¿Eliminar todos los resueltos?')) return;
  const snap = await db.collection('comentarios').where('resolved','==',true).get();
  const batch = db.batch();
  snap.forEach(d => batch.delete(d.ref));
  await batch.commit();
  loadComments();
}

document.getElementById('clearResolved').addEventListener('click', clearResolvedComments);