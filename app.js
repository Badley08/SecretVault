angular.module('secretVaultApp', [])
.filter('limitTo', function() {
    return function(input, limit) {
        if (!input) return '';
        return input.length > limit ? input.substring(0, limit) + '...' : input;
    };
})
.controller('MainController', function($scope, $timeout) {
    const ctrl = this;
    
    // Firebase références globales
    let auth, db, storage;
    
    // État de l'application
    ctrl.user = null;
    ctrl.showRegister = false;
    ctrl.showProfileSettings = false;
    ctrl.userFiles = [];
    ctrl.selectedFiles = [];
    ctrl.gridView = true;
    ctrl.sortBy = 'date';
    ctrl.isDragOver = false;
    
    // Données d'authentification
    ctrl.loginData = {};
    ctrl.registerData = {
        storageType: 'cloud'
    };
    ctrl.profilePreview = null;
    
    // Initialisation
    ctrl.init = function() {
        console.log('Initialisation de SecretVault...');
        
        // Attendre que Firebase soit chargé
        const waitForFirebase = setInterval(() => {
            if (typeof firebase !== 'undefined') {
                clearInterval(waitForFirebase);
                ctrl.initializeFirebase();
            }
        }, 100);
        
        // Masquer le loader après l'initialisation
        $timeout(function() {
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        }, 1500);
    };
    
    // Initialiser Firebase
    ctrl.initializeFirebase = function() {
        try {
            auth = firebase.auth();
            db = firebase.firestore();
            storage = firebase.storage();
            
            console.log('Firebase initialisé avec succès');
            
            // Observer l'état d'authentification
            auth.onAuthStateChanged((firebaseUser) => {
                if (firebaseUser) {
                    ctrl.user = {
                        id: firebaseUser.uid,
                        username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                        email: firebaseUser.email,
                        profilePhoto: firebaseUser.photoURL || null,
                        storageType: 'cloud',
                        createdAt: new Date().toISOString()
                    };
                    ctrl.loadUserFiles();
                    $scope.$apply();
                }
            });
        } catch (error) {
            console.error('Erreur initialisation Firebase:', error);
        }
    };
    
    // Gestion de la photo de profil lors de l'inscription
    ctrl.handleProfilePhoto = function(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                ctrl.showNotification('La photo ne doit pas dépasser 10MB', 'error');
                return;
            }
            
            if (!file.type.startsWith('image/')) {
                ctrl.showNotification('Veuillez sélectionner une image valide', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                ctrl.profilePreview = e.target.result;
                ctrl.registerData.profilePhoto = e.target.result;
                $scope.$apply();
                console.log('Photo de profil chargée');
            };
            reader.readAsDataURL(file);
        }
    };
    
    // Connexion
    ctrl.login = function() {
        if (!ctrl.loginData.username || !ctrl.loginData.password) {
            ctrl.showNotification('Veuillez remplir tous les champs', 'warning');
            return;
        }
        
        ctrl.showLoading();
        
        const email = ctrl.loginData.username.includes('@') 
            ? ctrl.loginData.username 
            : ctrl.loginData.username + '@secretvault.local';
        
        auth.signInWithEmailAndPassword(email, ctrl.loginData.password)
            .then((userCredential) => {
                ctrl.user = {
                    id: userCredential.user.uid,
                    username: userCredential.user.displayName || ctrl.loginData.username,
                    email: userCredential.user.email,
                    profilePhoto: userCredential.user.photoURL || null,
                    storageType: 'cloud',
                    createdAt: new Date().toISOString()
                };
                
                ctrl.loadUserFiles();
                ctrl.hideLoading();
                ctrl.showNotification('Connexion réussie!', 'success');
                $scope.$apply();
            })
            .catch((error) => {
                ctrl.hideLoading();
                console.error('Erreur connexion:', error);
                ctrl.showNotification('Identifiants incorrects', 'error');
                $scope.$apply();
            });
    };
    
    // Inscription
    ctrl.register = function() {
        if (!ctrl.registerData.username || !ctrl.registerData.password) {
            ctrl.showNotification('Veuillez remplir tous les champs', 'warning');
            return;
        }
        
        if (ctrl.registerData.password.length < 6) {
            ctrl.showNotification('Le mot de passe doit contenir au moins 6 caractères', 'warning');
            return;
        }
        
        ctrl.showLoading();
        
        const email = ctrl.registerData.username.includes('@') 
            ? ctrl.registerData.username 
            : ctrl.registerData.username + '@secretvault.local';
        
        auth.createUserWithEmailAndPassword(email, ctrl.registerData.password)
            .then((userCredential) => {
                // Mettre à jour le profil
                return userCredential.user.updateProfile({
                    displayName: ctrl.registerData.username,
                    photoURL: ctrl.registerData.profilePhoto || null
                }).then(() => userCredential);
            })
            .then((userCredential) => {
                // Créer le document utilisateur dans Firestore
                return db.collection('users').doc(userCredential.user.uid).set({
                    username: ctrl.registerData.username,
                    email: email,
                    profilePhoto: ctrl.registerData.profilePhoto || null,
                    storageType: ctrl.registerData.storageType || 'cloud',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }).then(() => userCredential);
            })
            .then((userCredential) => {
                ctrl.user = {
                    id: userCredential.user.uid,
                    username: ctrl.registerData.username,
                    profilePhoto: ctrl.registerData.profilePhoto || null,
                    storageType: ctrl.registerData.storageType || 'cloud',
                    createdAt: new Date().toISOString()
                };
                
                ctrl.showRegister = false;
                ctrl.hideLoading();
                ctrl.showNotification('Compte créé avec succès!', 'success');
                $scope.$apply();
            })
            .catch((error) => {
                ctrl.hideLoading();
                console.error('Erreur inscription:', error);
                
                let errorMessage = 'Erreur lors de l\'inscription';
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = 'Ce nom d\'utilisateur est déjà utilisé';
                } else if (error.code === 'auth/weak-password') {
                    errorMessage = 'Mot de passe trop faible';
                }
                
                ctrl.showNotification(errorMessage, 'error');
                $scope.$apply();
            });
    };
    
    // Déconnexion
    ctrl.logout = function() {
        auth.signOut().then(() => {
            ctrl.user = null;
            ctrl.userFiles = [];
            ctrl.selectedFiles = [];
            ctrl.loginData = {};
            ctrl.showNotification('Déconnexion réussie', 'info');
            $scope.$apply();
        });
    };
    
    // Gestion des fichiers - UNIQUEMENT DES IMAGES
    ctrl.handleFileUpload = function(event) {
        const files = event.target.files;
        ctrl.processFiles(Array.from(files));
        event.target.value = '';
    };
    
    ctrl.handleFileDrop = function(files) {
        ctrl.processFiles(Array.from(files));
        ctrl.isDragOver = false;
    };
    
    ctrl.processFiles = function(files) {
        if (!files || files.length === 0) return;
        
        ctrl.showLoading();
        let processedCount = 0;
        let totalFiles = files.length;
        let validFiles = 0;
        
        for (let file of files) {
            // Vérifier que c'est une image
            if (!file.type.startsWith('image/')) {
                ctrl.showNotification(`"${file.name}" n'est pas une image valide`, 'error');
                processedCount++;
                continue;
            }
            
            // Vérifier la taille
            if (file.size > 10 * 1024 * 1024) {
                ctrl.showNotification(`"${file.name}" dépasse 10MB`, 'error');
                processedCount++;
                continue;
            }
            
            validFiles++;
            
            // Upload vers Firebase Storage
            ctrl.uploadToFirebase(file).then(() => {
                processedCount++;
                if (processedCount === totalFiles) {
                    ctrl.hideLoading();
                    if (validFiles > 0) {
                        ctrl.showNotification(`${validFiles} image(s) ajoutée(s)`, 'success');
                    }
                }
            }).catch(error => {
                console.error('Erreur upload:', error);
                processedCount++;
                if (processedCount === totalFiles) {
                    ctrl.hideLoading();
                }
            });
        }
        
        if (validFiles === 0) {
            ctrl.hideLoading();
        }
    };
    
    // Upload vers Firebase
    ctrl.uploadToFirebase = function(file) {
        return new Promise((resolve, reject) => {
            if (!ctrl.user) {
                reject('User not logged in');
                return;
            }
            
            const timestamp = Date.now();
            const fileName = `${timestamp}_${file.name}`;
            const storageRef = storage.ref(`users/${ctrl.user.id}/images/${fileName}`);
            
            // Upload le fichier
            const uploadTask = storageRef.put(file);
            
            uploadTask.on('state_changed',
                (snapshot) => {
                    // Progress
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('Upload progress:', progress + '%');
                },
                (error) => {
                    // Error
                    console.error('Upload error:', error);
                    reject(error);
                },
                () => {
                    // Complete
                    uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                        // Sauvegarder les métadonnées dans Firestore
                        db.collection('users').doc(ctrl.user.id).collection('files').add({
                            name: file.name,
                            size: (file.size / (1024 * 1024)).toFixed(2),
                            type: 'image',
                            preview: downloadURL,
                            storagePath: `users/${ctrl.user.id}/images/${fileName}`,
                            date: firebase.firestore.FieldValue.serverTimestamp()
                        }).then((docRef) => {
                            // Ajouter à la galerie locale
                            const fileObj = {
                                id: docRef.id,
                                name: file.name,
                                size: (file.size / (1024 * 1024)).toFixed(2),
                                type: 'image',
                                preview: downloadURL,
                                date: new Date().toISOString()
                            };
                            
                            ctrl.userFiles.unshift(fileObj);
                            $scope.$apply();
                            resolve();
                        });
                    });
                }
            );
        });
    };
    
    // Charger les fichiers de l'utilisateur
    ctrl.loadUserFiles = function() {
        if (!ctrl.user) return;
        
        ctrl.showLoading();
        
        db.collection('users').doc(ctrl.user.id).collection('files')
            .orderBy('date', 'desc')
            .get()
            .then((querySnapshot) => {
                ctrl.userFiles = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    ctrl.userFiles.push({
                        id: doc.id,
                        name: data.name,
                        size: data.size,
                        type: data.type,
                        preview: data.preview,
                        storagePath: data.storagePath,
                        date: data.date ? data.date.toDate().toISOString() : new Date().toISOString()
                    });
                });
                
                ctrl.hideLoading();
                console.log('Fichiers chargés:', ctrl.userFiles.length);
                $scope.$apply();
            })
            .catch((error) => {
                console.error('Erreur chargement fichiers:', error);
                ctrl.hideLoading();
                $scope.$apply();
            });
    };
    
    // Sélection de fichiers
    ctrl.toggleFileSelection = function(file) {
        const index = ctrl.selectedFiles.findIndex(f => f.id === file.id);
        if (index > -1) {
            ctrl.selectedFiles.splice(index, 1);
        } else {
            ctrl.selectedFiles.push(file);
        }
    };
    
    ctrl.isSelected = function(file) {
        return ctrl.selectedFiles.some(f => f.id === file.id);
    };
    
    ctrl.selectAllFiles = function() {
        if (ctrl.selectedFiles.length === ctrl.userFiles.length) {
            ctrl.selectedFiles = [];
        } else {
            ctrl.selectedFiles = [...ctrl.userFiles];
        }
    };
    
    // Téléchargement
    ctrl.downloadFile = function(file) {
        if (file.preview) {
            const link = document.createElement('a');
            link.href = file.preview;
            link.download = file.name;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            ctrl.showNotification(`"${file.name}" téléchargé`, 'success');
        }
    };
    
    ctrl.downloadSelected = function() {
        if (ctrl.selectedFiles.length === 0) {
            ctrl.showNotification('Aucun fichier sélectionné', 'warning');
            return;
        }
        
        ctrl.selectedFiles.forEach(file => {
            ctrl.downloadFile(file);
        });
        
        ctrl.showNotification(`${ctrl.selectedFiles.length} fichier(s) téléchargé(s)`, 'success');
    };
    
    // Suppression
    ctrl.deleteFile = function(file) {
        if (confirm(`Supprimer "${file.name}" ?`)) {
            ctrl.showLoading();
            
            // Supprimer de Storage
            const storageRef = storage.ref(file.storagePath);
            storageRef.delete()
                .then(() => {
                    // Supprimer de Firestore
                    return db.collection('users').doc(ctrl.user.id).collection('files').doc(file.id).delete();
                })
                .then(() => {
                    // Supprimer de l'interface
                    const index = ctrl.userFiles.findIndex(f => f.id === file.id);
                    if (index > -1) {
                        ctrl.userFiles.splice(index, 1);
                    }
                    ctrl.removeFromSelection(file);
                    ctrl.hideLoading();
                    ctrl.showNotification('Fichier supprimé', 'info');
                    $scope.$apply();
                })
                .catch((error) => {
                    console.error('Erreur suppression:', error);
                    ctrl.hideLoading();
                    ctrl.showNotification('Erreur lors de la suppression', 'error');
                    $scope.$apply();
                });
        }
    };
    
    ctrl.deleteSelected = function() {
        if (ctrl.selectedFiles.length === 0) {
            ctrl.showNotification('Aucun fichier sélectionné', 'warning');
            return;
        }
        
        if (confirm(`Supprimer ${ctrl.selectedFiles.length} fichier(s) sélectionné(s) ?`)) {
            ctrl.showLoading();
            
            const deletePromises = ctrl.selectedFiles.map(file => {
                const storageRef = storage.ref(file.storagePath);
                return storageRef.delete()
                    .then(() => {
                        return db.collection('users').doc(ctrl.user.id).collection('files').doc(file.id).delete();
                    });
            });
            
            Promise.all(deletePromises)
                .then(() => {
                    ctrl.userFiles = ctrl.userFiles.filter(file => 
                        !ctrl.selectedFiles.some(selected => selected.id === file.id)
                    );
                    ctrl.selectedFiles = [];
                    ctrl.hideLoading();
                    ctrl.showNotification('Fichiers supprimés', 'info');
                    $scope.$apply();
                })
                .catch((error) => {
                    console.error('Erreur suppression multiple:', error);
                    ctrl.hideLoading();
                    ctrl.showNotification('Erreur lors de la suppression', 'error');
                    $scope.$apply();
                });
        }
    };
    
    ctrl.deleteAllFiles = function() {
        if (ctrl.userFiles.length === 0) {
            ctrl.showNotification('Aucun fichier à supprimer', 'warning');
            return;
        }
        
        if (confirm('Supprimer tous les fichiers ? Cette action est irréversible.')) {
            ctrl.showLoading();
            
            const deletePromises = ctrl.userFiles.map(file => {
                const storageRef = storage.ref(file.storagePath);
                return storageRef.delete()
                    .then(() => {
                        return db.collection('users').doc(ctrl.user.id).collection('files').doc(file.id).delete();
                    });
            });
            
            Promise.all(deletePromises)
                .then(() => {
                    ctrl.userFiles = [];
                    ctrl.selectedFiles = [];
                    ctrl.hideLoading();
                    ctrl.showNotification('Tous les fichiers ont été supprimés', 'info');
                    $scope.$apply();
                })
                .catch((error) => {
                    console.error('Erreur suppression totale:', error);
                    ctrl.hideLoading();
                    ctrl.showNotification('Erreur lors de la suppression', 'error');
                    $scope.$apply();
                });
        }
    };
    
    ctrl.removeFromSelection = function(file) {
        const index = ctrl.selectedFiles.findIndex(f => f.id === file.id);
        if (index > -1) {
            ctrl.selectedFiles.splice(index, 1);
        }
    };
    
    // Gestion du profil
    ctrl.updateProfilePhoto = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (file.size > 10 * 1024 * 1024) {
            ctrl.showNotification('La photo ne doit pas dépasser 10MB', 'error');
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            ctrl.showNotification('Veuillez sélectionner une image valide', 'error');
            return;
        }
        
        ctrl.showLoading();
        
        const storageRef = storage.ref(`users/${ctrl.user.id}/profile/avatar`);
        storageRef.put(file)
            .then(snapshot => snapshot.ref.getDownloadURL())
            .then(downloadURL => {
                return auth.currentUser.updateProfile({
                    photoURL: downloadURL
                }).then(() => downloadURL);
            })
            .then(downloadURL => {
                return db.collection('users').doc(ctrl.user.id).update({
                    profilePhoto: downloadURL
                }).then(() => downloadURL);
            })
            .then(downloadURL => {
                ctrl.user.profilePhoto = downloadURL;
                ctrl.hideLoading();
                ctrl.showNotification('Photo de profil mise à jour', 'success');
                $scope.$apply();
            })
            .catch(error => {
                console.error('Erreur update photo:', error);
                ctrl.hideLoading();
                ctrl.showNotification('Erreur lors de la mise à jour', 'error');
                $scope.$apply();
            });
    };
    
    ctrl.saveProfileSettings = function() {
        db.collection('users').doc(ctrl.user.id).update({
            storageType: ctrl.user.storageType
        }).then(() => {
            ctrl.showProfileSettings = false;
            ctrl.showNotification('Paramètres sauvegardés', 'success');
            $scope.$apply();
        });
    };
    
    ctrl.deleteAccount = function() {
        if (confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Toutes vos données seront perdues.')) {
            ctrl.showLoading();
            
            // Supprimer tous les fichiers
            ctrl.deleteAllFiles();
            
            // Supprimer le document utilisateur
            db.collection('users').doc(ctrl.user.id).delete()
                .then(() => {
                    // Supprimer l'utilisateur Firebase Auth
                    return auth.currentUser.delete();
                })
                .then(() => {
                    ctrl.hideLoading();
                    ctrl.showNotification('Compte supprimé avec succès', 'info');
                    ctrl.logout();
                })
                .catch(error => {
                    console.error('Erreur suppression compte:', error);
                    ctrl.hideLoading();
                    ctrl.showNotification('Erreur lors de la suppression du compte', 'error');
                    $scope.$apply();
                });
        }
    };
    
    // Utilitaires
    ctrl.getFileCount = function(type) {
        return ctrl.userFiles.filter(file => file.type === type).length;
    };
    
    ctrl.getTotalSize = function() {
        const total = ctrl.userFiles.reduce((sum, file) => sum + parseFloat(file.size || 0), 0);
        return total.toFixed(1);
    };
    
    ctrl.sortFiles = function() {
        switch (ctrl.sortBy) {
            case 'name':
                ctrl.userFiles.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'date':
                ctrl.userFiles.sort((a, b) => new Date(b.date) - new Date(a.date));
                break;
            case 'size':
                ctrl.userFiles.sort((a, b) => parseFloat(b.size) - parseFloat(a.size));
                break;
        }
    };
    
    // Notifications
    ctrl.showNotification = function(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-lg border backdrop-blur-lg transform translate-x-full transition-transform duration-300 ${
            type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
            type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
            type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
            'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`;
        
        toast.innerHTML = `
            <div class="flex items-center space-x-3">
                <i class="fas ${
                    type === 'success' ? 'fa-check-circle' :
                    type === 'error' ? 'fa-exclamation-circle' :
                    type === 'warning' ? 'fa-exclamation-triangle' :
                    'fa-info-circle'
                }"></i>
                <span class="text-sm font-medium">${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        $timeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        $timeout(() => {
            toast.style.transform = 'translateX(100%)';
            $timeout(() => {
                if (toast.parentNode) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    };
    
    ctrl.showLoading = function() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'flex';
        }
    };
    
    ctrl.hideLoading = function() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    };
    
    // Initialisation automatique
    $timeout(function() {
        ctrl.init();
    });
});
