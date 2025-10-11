angular.module('secretVaultApp', [])
.filter('limitTo', function() {
    return function(input, limit) {
        if (!input) return '';
        return input.length > limit ? input.substring(0, limit) + '...' : input;
    };
})
.controller('MainController', function($scope, $timeout) {
    const ctrl = this;
    
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
        // Vérifier si l'utilisateur est déjà connecté
        const savedUser = localStorage.getItem('secretVaultUser');
        if (savedUser) {
            ctrl.user = JSON.parse(savedUser);
            ctrl.loadUserFiles();
        }
        
        // Initialiser IndexDB
        ctrl.initIndexDB();
    };
    
    // Gestion IndexDB
    ctrl.initIndexDB = function() {
        if (!window.indexedDB) {
            console.warn("IndexDB n'est pas supporté");
            return;
        }
        
        const request = indexedDB.open('SecretVaultDB', 1);
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('files')) {
                const store = db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
                store.createIndex('name', 'name', { unique: false });
                store.createIndex('type', 'type', { unique: false });
                store.createIndex('date', 'date', { unique: false });
            }
        };
        
        request.onsuccess = function(event) {
            ctrl.db = event.target.result;
            console.log('IndexDB initialisé');
        };
        
        request.onerror = function(event) {
            console.error('Erreur IndexDB:', event.target.error);
        };
    };
    
    // Gestion de la photo de profil
    ctrl.handleProfilePhoto = function(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                ctrl.showNotification('La photo ne doit pas dépasser 10MB', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                ctrl.profilePreview = e.target.result;
                ctrl.registerData.profilePhoto = e.target.result;
                $scope.$apply();
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
        
        // Simulation d'authentification
        $timeout(function() {
            const user = {
                id: Date.now().toString(),
                username: ctrl.loginData.username,
                profilePhoto: null,
                storageType: 'cloud',
                createdAt: new Date().toISOString()
            };
            
            localStorage.setItem('secretVaultUser', JSON.stringify(user));
            ctrl.user = user;
            ctrl.loadUserFiles();
            ctrl.hideLoading();
            ctrl.showNotification('Connexion réussie!', 'success');
        }, 1500);
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
        
        // Simulation d'inscription
        $timeout(function() {
            const user = {
                id: Date.now().toString(),
                username: ctrl.registerData.username,
                profilePhoto: ctrl.registerData.profilePhoto,
                storageType: ctrl.registerData.storageType,
                createdAt: new Date().toISOString()
            };
            
            localStorage.setItem('secretVaultUser', JSON.stringify(user));
            ctrl.user = user;
            ctrl.showRegister = false;
            ctrl.hideLoading();
            ctrl.showNotification('Compte créé avec succès!', 'success');
        }, 2000);
    };
    
    // Déconnexion
    ctrl.logout = function() {
        ctrl.user = null;
        ctrl.userFiles = [];
        ctrl.selectedFiles = [];
        ctrl.loginData = {};
        localStorage.removeItem('secretVaultUser');
        ctrl.showNotification('Déconnexion réussie', 'info');
    };
    
    // Gestion des fichiers
    ctrl.handleFileUpload = function(event) {
        const files = event.target.files;
        ctrl.processFiles(files);
        event.target.value = '';
    };
    
    ctrl.handleFileDrop = function(files) {
        ctrl.processFiles(files);
        ctrl.isDragOver = false;
    };
    
    ctrl.processFiles = function(files) {
        let validFiles = 0;
        
        for (let file of files) {
            if (file.size > 10 * 1024 * 1024) {
                ctrl.showNotification(`Le fichier "${file.name}" dépasse 10MB`, 'error');
                continue;
            }
            
            validFiles++;
            const fileObj = {
                id: Date.now() + Math.random(),
                name: file.name,
                size: (file.size / (1024 * 1024)).toFixed(2),
                type: file.type.startsWith('image') ? 'image' : 'video',
                date: new Date().toISOString(),
                file: file
            };
            
            // Générer un aperçu pour les images
            if (file.type.startsWith('image')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    fileObj.preview = e.target.result;
                    $scope.$apply();
                };
                reader.readAsDataURL(file);
            }
            
            ctrl.userFiles.unshift(fileObj);
            
            // Sauvegarder selon le type de stockage
            if (ctrl.user.storageType === 'local') {
                ctrl.saveFileToIndexDB(fileObj);
            } else {
                ctrl.saveFileToCloud(fileObj);
            }
        }
        
        if (validFiles > 0) {
            ctrl.showNotification(`${validFiles} fichier(s) ajouté(s)`, 'success');
            ctrl.saveUserFiles();
        }
    };
    
    // Sauvegarde des fichiers
    ctrl.saveFileToIndexDB = function(fileObj) {
        if (!ctrl.db) return;
        
        const transaction = ctrl.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        
        // Créer une copie sans l'objet File (non sérialisable)
        const fileData = {
            id: fileObj.id,
            name: fileObj.name,
            size: fileObj.size,
            type: fileObj.type,
            date: fileObj.date,
            preview: fileObj.preview
        };
        
        store.add(fileData);
    };
    
    ctrl.saveFileToCloud = function(fileObj) {
        // Simulation de sauvegarde cloud
        console.log('Sauvegarde cloud:', fileObj.name);
    };
    
    ctrl.saveUserFiles = function() {
        localStorage.setItem('secretVaultFiles_' + ctrl.user.id, JSON.stringify(ctrl.userFiles));
    };
    
    ctrl.loadUserFiles = function() {
        const savedFiles = localStorage.getItem('secretVaultFiles_' + ctrl.user.id);
        if (savedFiles) {
            ctrl.userFiles = JSON.parse(savedFiles);
        }
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
            link.click();
            ctrl.showNotification(`Téléchargement de "${file.name}"`, 'success');
        } else {
            ctrl.showNotification('Impossible de télécharger ce fichier', 'error');
        }
    };
    
    ctrl.downloadSelected = function() {
        ctrl.selectedFiles.forEach(file => {
            ctrl.downloadFile(file);
        });
        ctrl.showNotification(`${ctrl.selectedFiles.length} fichier(s) téléchargé(s)`, 'success');
    };
    
    // Suppression
    ctrl.deleteFile = function(file) {
        if (confirm(`Supprimer "${file.name}" ?`)) {
            const index = ctrl.userFiles.findIndex(f => f.id === file.id);
            if (index > -1) {
                ctrl.userFiles.splice(index, 1);
                ctrl.removeFromSelection(file);
                ctrl.saveUserFiles();
                ctrl.showNotification('Fichier supprimé', 'info');
            }
        }
    };
    
    ctrl.deleteSelected = function() {
        if (ctrl.selectedFiles.length === 0) return;
        
        if (confirm(`Supprimer ${ctrl.selectedFiles.length} fichier(s) sélectionné(s) ?`)) {
            ctrl.userFiles = ctrl.userFiles.filter(file => 
                !ctrl.selectedFiles.some(selected => selected.id === file.id)
            );
            ctrl.selectedFiles = [];
            ctrl.saveUserFiles();
            ctrl.showNotification('Fichiers supprimés', 'info');
        }
    };
    
    ctrl.deleteAllFiles = function() {
        if (ctrl.userFiles.length === 0) return;
        
        if (confirm('Supprimer tous les fichiers ? Cette action est irréversible.')) {
            ctrl.userFiles = [];
            ctrl.selectedFiles = [];
            ctrl.saveUserFiles();
            ctrl.showNotification('Tous les fichiers ont été supprimés', 'info');
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
        if (file && file.size <= 10 * 1024 * 1024) {
            const reader = new FileReader();
            reader.onload = function(e) {
                ctrl.user.profilePhoto = e.target.result;
                localStorage.setItem('secretVaultUser', JSON.stringify(ctrl.user));
                $scope.$apply();
                ctrl.showNotification('Photo de profil mise à jour', 'success');
            };
            reader.readAsDataURL(file);
        } else if (file) {
            ctrl.showNotification('La photo ne doit pas dépasser 10MB', 'error');
        }
    };
    
    ctrl.saveProfileSettings = function() {
        localStorage.setItem('secretVaultUser', JSON.stringify(ctrl.user));
        ctrl.showProfileSettings = false;
        ctrl.showNotification('Paramètres sauvegardés', 'success');
    };
    
    ctrl.deleteAccount = function() {
        if (confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Toutes vos données seront perdues.')) {
            localStorage.removeItem('secretVaultUser');
            localStorage.removeItem('secretVaultFiles_' + ctrl.user.id);
            ctrl.logout();
            ctrl.showNotification('Compte supprimé avec succès', 'info');
        }
    };
    
    // Utilitaires
    ctrl.getFileCount = function(type) {
        return ctrl.userFiles.filter(file => file.type === type).length;
    };
    
    ctrl.getTotalSize = function() {
        const total = ctrl.userFiles.reduce((sum, file) => sum + parseFloat(file.size), 0);
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
            case 'type':
                ctrl.userFiles.sort((a, b) => a.type.localeCompare(b.type));
                break;
        }
    };
    
    // Notifications
    ctrl.showNotification = function(message, type = 'info') {
        // Créer une notification toast
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
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Animation d'entrée
        $timeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        // Suppression automatique
        $timeout(() => {
            toast.style.transform = 'translateX(100%)';
            $timeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    };
    
    ctrl.showLoading = function() {
        document.getElementById('loading').style.display = 'flex';
    };
    
    ctrl.hideLoading = function() {
        document.getElementById('loading').style.display = 'none';
    };
    
    // Initialisation
    ctrl.init();
});
