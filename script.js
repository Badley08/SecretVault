// Firebase Configuration - MODULAR SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  updateProfile 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getBytes, 
  deleteObject 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBVeTFmzq0KGDnGDVw-9aad6VXyWSSUDOA",
  authDomain: "secretvault-3039b.firebaseapp.com",
  databaseURL: "https://secretvault-3039b-default-rtdb.firebaseio.com",
  projectId: "secretvault-3039b",
  storageBucket: "secretvault-3039b.firebasestorage.app",
  messagingSenderId: "243494550983",
  appId: "1:243494550983:web:e073cc060511c013abede2",
  measurementId: "G-WTZ5NMZPRW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ========== DOM ELEMENTS ==========
const authModal = document.getElementById('authModal');
const authForm = document.getElementById('authForm');
const authLoader = document.getElementById('authLoader');
const btnAuthSubmit = document.getElementById('btnAuthSubmit');
const btnLocalMode = document.getElementById('btnLocalMode');
const btnCloudMode = document.getElementById('btnCloudMode');
const choiceBtns = document.querySelectorAll('.choice-btn');
const gallerySection = document.getElementById('gallerySection');
const btnAddPhotos = document.getElementById('btnAddPhotos');
const inputPhotos = document.getElementById('inputPhotos');
const gallery = document.getElementById('gallery');
const btnClearAll = document.getElementById('btnClearAll');
const btnLogout = document.getElementById('btnLogout');
const welcomeMessage = document.getElementById('welcomeMessage');
const emptyGalleryMsg = document.getElementById('emptyGalleryMsg');
const profilePicture = document.getElementById('profilePicture');
const inputProfilePic = document.getElementById('inputProfilePic');
const menuToggle = document.getElementById('menuToggle');
const menuLinks = document.getElementById('menuLinks');
const storageBadge = document.getElementById('storageBadge');
const photoCounter = document.getElementById('photoCounter');

// ========== GLOBAL STATE ==========
let storageChoice = 'local';
let user = null;
let photosData = []; // Stockage des métadonnées des photos

// ========== UTILITY FUNCTIONS ==========

function showLoader(on) {
  authLoader.style.display = on ? 'block' : 'none';
  btnAuthSubmit.disabled = on;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setWelcomeMessage(msg, isCloud = false) {
  welcomeMessage.textContent = msg;
  welcomeMessage.style.display = 'block';
  welcomeMessage.style.color = isCloud ? '#4facfe' : '#f0e68c';

  if (isCloud) {
    storageBadge.className = 'storage-badge cloud';
    storageBadge.textContent = '☁️ Cloud';
  } else {
    storageBadge.className = 'storage-badge local';
    storageBadge.textContent = '📱 Local';
  }
}

function clearWelcomeMessage() {
  welcomeMessage.textContent = '';
  welcomeMessage.style.display = 'none';
}

function updatePhotoCounter() {
  const count = gallery.children.length;
  if (count > 0) {
    photoCounter.textContent = `${count} photo${count > 1 ? 's' : ''} stockée${count > 1 ? 's' : ''}`;
  } else {
    photoCounter.textContent = '';
  }
}

function checkEmptyGallery() {
  emptyGalleryMsg.style.display = gallery.children.length === 0 ? 'block' : 'none';
  updatePhotoCounter();
}

function downloadImage(src, name) {
  const link = document.createElement('a');
  link.href = src;
  link.download = name || 'photo.jpg';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ========== MENU TOGGLE ==========
menuToggle.addEventListener('click', () => {
  menuLinks.classList.toggle('open');
});

// Close menu when link is clicked
menuLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    menuLinks.classList.remove('open');
  });
});

// ========== STORAGE CHOICE HANDLERS ==========
choiceBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    choiceBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    storageChoice = btn.getAttribute('data-storage');
    
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    usernameInput.style.display = (storageChoice === 'cloud' ? 'block' : 'none');
    emailInput.required = (storageChoice === 'cloud');
    passwordInput.required = (storageChoice === 'cloud');

    if (storageChoice === 'local') {
      setWelcomeMessage("🚀 Mode local activé. Vos photos sont stockées uniquement sur cet appareil.", false);
    } else {
      clearWelcomeMessage();
    }
  });
});

// Initialiser au mode local par défaut
btnLocalMode.click();

// ========== AUTHENTICATION HANDLERS ==========
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (storageChoice === 'local') {
    // Mode Local - pas d'authentification Firebase
    user = { 
      uid: 'local_user', 
      email: 'local@device.com', 
      displayName: 'Utilisateur Local' 
    };
    handleLoginSuccess(user);
    return;
  }

  // Mode Cloud (Firebase)
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const displayName = document.getElementById('username').value;
  
  showLoader(true);
  try {
    let authResult;
    
    try {
      // Tentative de connexion
      authResult = await signInWithEmailAndPassword(auth, email, password);
      console.log("Connexion réussie");
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        // Inscription
        authResult = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(authResult.user, { 
          displayName: displayName || email.split('@')[0] 
        });
        
        // Créer le document utilisateur dans Firestore
        await setDoc(doc(db, 'users', authResult.user.uid), {
          username: displayName,
          email: email,
          profilePicUrl: null,
          createdAt: new Date()
        });
        console.log("Inscription réussie");
      } else {
        throw error;
      }
    }
    
    user = authResult.user;
    handleLoginSuccess(user);

  } catch (err) {
    alert("Erreur d'authentification : " + (err.message || "Veuillez vérifier vos identifiants."));
  } finally {
    showLoader(false);
  }
});

function handleLoginSuccess(userObj) {
  user = userObj;
  authModal.style.display = 'none';
  gallerySection.classList.remove('hidden');
  btnLogout.style.display = 'block';

  if (storageChoice === 'local') {
    setWelcomeMessage(`👋 Bienvenue, Utilisateur Local.`, false);
  } else {
    const username = user.displayName || user.email.split('@')[0];
    setWelcomeMessage(`👋 Bienvenue, ${username} ! Mode Cloud activé.`, true);
    loadUserProfile(user.uid);
  }

  loadGallery();
  checkEmptyGallery();
}

// ========== LOGOUT HANDLER ==========
btnLogout.addEventListener('click', async () => {
  if (storageChoice === 'cloud') {
    await signOut(auth);
  }
  
  // Réinitialisation
  user = null;
  storageChoice = 'local';
  photosData = [];
  
  authModal.style.display = 'flex';
  gallerySection.classList.add('hidden');
  btnLogout.style.display = 'none';
  gallery.innerHTML = '';
  
  clearWelcomeMessage();
  profilePicture.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%230066ff%22/%3E%3Ctext x=%2250%22 y=%2255%22 font-size=%2260%22 font-weight=%22bold%22 fill=%22white%22 text-anchor=%22middle%22%3EU%3C/text%3E%3C/svg%3E';
  
  alert("Vous êtes déconnecté. À bientôt !");
  btnLocalMode.click();
});

// ========== AUTH STATE OBSERVER ==========
onAuthStateChanged(auth, (firebaseUser) => {
  if (firebaseUser) {
    document.getElementById('email').value = firebaseUser.email || '';
    document.getElementById('password').value = '';
    btnCloudMode.click();
    handleLoginSuccess(firebaseUser);
  } else {
    if (!user) {
      authModal.style.display = 'flex';
      gallerySection.classList.add('hidden');
      btnLogout.style.display = 'none';
      btnLocalMode.click();
    }
  }
});

// ========== PHOTO MANAGEMENT ==========

// Ajouter des photos
btnAddPhotos.addEventListener('click', () => {
  inputPhotos.click();
});

inputPhotos.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  
  for (let f of files) {
    if (f.size > 10 * 1024 * 1024) {
      alert(`Fichier ${f.name} trop gros (>10MB). Ignoré.`);
      continue;
    }

    try {
      if (storageChoice === 'local') {
        const imgURL = await fileToBase64(f);
        addToGallery(imgURL, f.name, 'local');
        saveToLocal(f.name, imgURL);
      } else if (storageChoice === 'cloud' && user) {
        await uploadToCloud(f);
      }
    } catch (err) {
      console.error("Erreur d'ajout de photo:", err);
      alert("Erreur lors de l'ajout de la photo.");
    }
  }
  
  inputPhotos.value = '';
  checkEmptyGallery();
});

// ========== LOCAL STORAGE MANAGEMENT ==========

function saveToLocal(name, dataUrl) {
  let arr = JSON.parse(localStorage.getItem('sv_photos') || '[]');
  arr.push({ 
    name, 
    dataUrl,
    timestamp: Date.now()
  });
  localStorage.setItem('sv_photos', JSON.stringify(arr));
}

function deleteFromLocal(index) {
  let arr = JSON.parse(localStorage.getItem('sv_photos') || '[]');
  arr.splice(index, 1);
  localStorage.setItem('sv_photos', JSON.stringify(arr));
}

// ========== CLOUD STORAGE MANAGEMENT ==========

async function uploadToCloud(file) {
  const photoRef = ref(storage, `users/${user.uid}/photos/${Date.now()}_${file.name}`);
  
  try {
    // Upload vers Storage
    const snapshot = await uploadBytes(photoRef, file);
    const downloadURL = await getBytes(snapshot.ref).then(() => {
      return `https://firebasestorage.googleapis.com/v0/b/${storage.bucket}/o/users%2F${user.uid}%2Fphotos%2F${Date.now()}_${encodeURIComponent(file.name)}?alt=media`;
    });

    // Enregistrement des métadonnées dans Firestore
    const docRef = await addDoc(collection(db, 'users', user.uid, 'gallery'), {
      name: file.name,
      storagePath: snapshot.ref.fullPath,
      url: downloadURL,
      timestamp: new Date()
    });

    // Affichage
    addToGallery(downloadURL, file.name, 'cloud', docRef.id);
  } catch (error) {
    console.error("Erreur upload cloud:", error);
    throw error;
  }
}

// ========== GALLERY MANAGEMENT ==========

function addToGallery(dataUrl, name, source, docId = null) {
  const item = document.createElement('div');
  item.className = 'gallery-item';
  
  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = name;
  img.loading = 'lazy';
  
  const actions = document.createElement('div');
  actions.className = 'gallery-actions';
  
  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'gallery-btn gallery-btn-download';
  downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
  downloadBtn.title = 'Télécharger';
  downloadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadImage(dataUrl, name);
  });
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'gallery-btn gallery-btn-delete';
  deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
  deleteBtn.title = 'Supprimer';
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm("Êtes-vous sûr de vouloir supprimer cette photo ?")) {
      try {
        if (source === 'local') {
          const arr = JSON.parse(localStorage.getItem('sv_photos') || '[]');
          const index = arr.findIndex(p => p.name === name);
          if (index > -1) {
            deleteFromLocal(index);
          }
        } else if (source === 'cloud' && user && docId) {
          await deleteDoc(doc(db, 'users', user.uid, 'gallery', docId));
        }
        item.remove();
        checkEmptyGallery();
        alert("Photo supprimée avec succès !");
      } catch (error) {
        console.error("Erreur suppression:", error);
        alert("Erreur lors de la suppression.");
      }
    }
  });
  
  actions.appendChild(downloadBtn);
  actions.appendChild(deleteBtn);
  
  item.appendChild(img);
  item.appendChild(actions);
  gallery.appendChild(item);
}

async function loadGallery() {
  gallery.innerHTML = '';
  photosData = [];
  
  if (storageChoice === 'local') {
    const arr = JSON.parse(localStorage.getItem('sv_photos') || '[]');
    arr.forEach((obj, index) => {
      addToGallery(obj.dataUrl, obj.name, 'local', index);
    });
  } else if (storageChoice === 'cloud' && user) {
    try {
      const q = query(
        collection(db, 'users', user.uid, 'gallery'),
        orderBy('timestamp', 'asc')
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        addToGallery(data.url, data.name, 'cloud', docSnapshot.id);
      });
    } catch (error) {
      console.error("Erreur chargement galerie cloud:", error);
    }
  }
}

// ========== CLEAR ALL PHOTOS ==========
btnClearAll.addEventListener('click', async () => {
  if (!confirm("Confirmer la suppression de TOUTES les photos ? Cette action est irréversible.")) return;
  
  showLoader(true);

  try {
    if (storageChoice === 'local') {
      localStorage.removeItem('sv_photos');
      gallery.innerHTML = '';
    } else if (storageChoice === 'cloud' && user) {
      const galleryRef = collection(db, 'users', user.uid, 'gallery');
      const snapshot = await getDocs(galleryRef);
      
      for (let docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        try {
          await deleteObject(ref(storage, data.storagePath));
        } catch (storageError) {
          console.warn("Fichier storage non trouvé:", data.storagePath);
        }
        await deleteDoc(docSnapshot.ref);
      }
      gallery.innerHTML = '';
    }
    alert("Toutes les photos ont été supprimées !");
  } catch (error) {
    console.error("Erreur suppression:", error);
    alert("Une erreur est survenue lors de la suppression.");
  } finally {
    showLoader(false);
    checkEmptyGallery();
  }
});

// ========== PROFILE PICTURE ==========

async function loadUserProfile(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const data = userDoc.data();
    if (data && data.profilePicUrl) {
      profilePicture.src = data.profilePicUrl;
    }
  } catch (err) {
    console.error("Erreur chargement profil:", err);
  }
}

inputProfilePic.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || storageChoice !== 'cloud' || !user) return;
  
  if (file.size > 5 * 1024 * 1024) {
    alert("La photo de profil est trop grosse (>5MB).");
    return;
  }

  try {
    showLoader(true);
    const profileRef = ref(storage, `users/${user.uid}/profile/picture.jpg`);
    await uploadBytes(profileRef, file);
    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${storage.bucket}/o/users%2F${user.uid}%2Fprofile%2Fpicture.jpg?alt=media`;

    await setDoc(doc(db, 'users', user.uid), {
      profilePicUrl: downloadURL
    }, { merge: true });
    
    profilePicture.src = downloadURL;
    alert("Photo de profil mise à jour avec succès !");
  } catch (error) {
    console.error("Erreur upload profil:", error);
    alert("Erreur lors du changement de la photo de profil.");
  } finally {
    showLoader(false);
    inputProfilePic.value = '';
  }
});

// ========== SERVICE WORKER REGISTRATION (PWA) ==========
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => {
    console.log('Service Worker non enregistré:', err);
  });
}

// ========== INITIAL CHECK ==========
checkEmptyGallery();