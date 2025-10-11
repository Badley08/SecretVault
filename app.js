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
        console.log('Initialisation de SecretVault...');
        
        // Vérifier si l'utilisateur est déjà connecté
        const savedUser = localStorage.getItem('secretVaultUser');
        if (savedUser) {
            try {
                ctrl.user = JSON.parse(savedUser);
                console.log('Utilisateur trouvé:', ctrl.user);
                ctrl.loadUserFiles();
            } catch (e) {
                console.error('Erreur parsing user:', e);
                localStorage.removeItem('secretVaultUser');
            }
        }
        
        // Masquer le loader après l'initialisation
        $timeout(function() {
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        }, 1000);
    };
    
    // Gestion de la photo de profil
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
        
        // Simulation d'authentification
        $timeout(function() {
            const user = {
                id: 'user_' + Date.now(),
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
            console.log('Utilisateur connecté:', user);
        }, 1000);
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
                id: 'user_' + Date.now(),
                username: ctrl.registerData.username,
                profilePhoto: ctrl.registerData.profilePhoto || null,
                storageType: ctrl.registerData.storageType || 'cloud',
                createdAt: new Date().toISOString()
            };
            
            localStorage.setItem('secretVaultUser', JSON.stringify(user));
            ctrl.user = user;
            ctrl.showRegister = false;
            ctrl.hideLoading();
            ctrl.showNotification('Compte créé avec succès!', 'success');
            console.log('Nouvel utilisateur:', user);
        }, 1500);
    };
    
    // Déconnexion
    ctrl.logout = function() {
        ctrl.user = null;
        ctrl.userFiles = [];
        ctrl.selectedFiles = [];
        ctrl.loginData = {};
        localStorage.removeItem('secretVaultUser');
        ctrl.showNotification('Déconnexion réussie', 'info');
        console.log('Utilisateur déconnecté');
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
        
        let validFiles = 0;
        let newFiles = [];
        
        for (let file of files) {
            // Vérifier que c'est une image
            if (!file.type.startsWith('image/')) {
                ctrl.showNotification(`"${file.name}" n'est pas une image valide`, 'error');
                continue;
            }
            
            // Vérifier la taille
            if (file.size > 10 * 1024 * 1024) {
                ctrl.showNotification(`"${file.name}" dépasse 10MB`, 'error');
                continue;
            }
            
            validFiles++;
            
            const fileObj = {
                id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: file.name,
                size: (file.size / (1024 * 1024)).toFixed(2),
                type: 'image',
                date: new Date().toISOString(),
                file: file
            };
            
            // Générer un aperçu
            const reader = new FileReader();
            reader.onload = function(e) {
                fileObj.preview = e.target.result;
                newFiles.push(fileObj);
                
                // Quand tous les fichiers sont traités
                if (newFiles.length === validFiles) {
                    ctrl.userFiles = [...newFiles, ...ctrl.userFiles];
                    ctrl.saveUserFiles();
                    $scope.$apply();
                    console.log('Fichiers ajoutés:', newFiles.length);
                }
            };
            reader.readAsDataURL(file);
        }
        
        if (validFiles > 0) {
            ctrl.showNotification(`${validFiles} image(s) ajoutée(s)`, 'success');
        }
    };
    
    // Sauvegarde des fichiers
    ctrl.saveUserFiles = function() {
        if (ctrl.user) {
            // Ne sauvegarder que les données nécessaires (sans l'objet File)
            const filesToSave = ctrl.userFiles.map(file => ({
                id: file.id,
                name: file.name,
                size: file.size,
                type: file.type,
                date: file.date,
                preview: file.preview
            }));
            
            localStorage.setItem('secretVaultFiles_' + ctrl.user.id, JSON.stringify(filesToSave));
            console.log('Fichiers sauvegardés:', filesToSave.length);
        }
    };
    
    ctrl.loadUserFiles = function() {
        if (ctrl.user) {
            const savedFiles = localStorage.getItem('secretVaultFiles_' + ctrl.user.id);
            if (savedFiles) {
                try {
                    ctrl.userFiles = JSON.parse(savedFiles);
                    console.log('Fichiers chargés:', ctrl.userFiles.length);
                } catch (e) {
                    console.error('Erreur parsing files:', e);
                    ctrl.userFiles = [];
                }
            } else {
                ctrl.userFiles = [];
                console.log('Aucun fichier sauvegardé trouvé');
            }
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
        console.log('Fichiers sélectionnés:', ctrl.selectedFiles.length);
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
        console.log('Tous les fichiers sélectionnés:', ctrl.selectedFiles.length);
    };
    
    // Téléchargement
    ctrl.downloadFile = function(file) {
        if (file.preview) {
            const link = document.createElement('a');
            link.href = file.preview;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            ctrl.showNotification(`"${file.name}" téléchargé`, 'success');
        } else {
            ctrl.showNotification('Impossible de télécharger ce fichier', 'error');
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
            const index = ctrl.userFiles.findIndex(f => f.id === file.id);
            if (index > -1) {
                ctrl.userFiles.splice(index, 1);
                ctrl.removeFromSelection(file);
                ctrl.saveUserFiles();
                ctrl.showNotification('Fichier supprimé', 'info');
                console.log('Fichier supprimé:', file.name);
            }
        }
    };
    
    ctrl.deleteSelected = function() {
        if (ctrl.selectedFiles.length === 0) {
            ctrl.showNotification('Aucun fichier sélectionné', 'warning');
            return;
        }
        
        if (confirm(`Supprimer ${ctrl.selectedFiles.length} fichier(s) sélectionné(s) ?`)) {
            ctrl.userFiles = ctrl.userFiles.filter(file => 
                !ctrl.selectedFiles.some(selected => selected.id === file.id)
            );
            ctrl.selectedFiles = [];
            ctrl.saveUserFiles();
            ctrl.showNotification('Fichiers supprimés', 'info');
            console.log('Fichiers sélectionnés supprimés');
        }
    };
    
    ctrl.deleteAllFiles = function() {
        if (ctrl.userFiles.length === 0) {
            ctrl.showNotification('Aucun fichier à supprimer', 'warning');
            return;
        }
        
        if (confirm('Supprimer tous les fichiers ? Cette action est irréversible.')) {
            ctrl.userFiles = [];
            ctrl.selectedFiles = [];
            ctrl.saveUserFiles();
            ctrl.showNotification('Tous les fichiers ont été supprimés', 'info');
            console.log('Tous les fichiers supprimés');
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
                ctrl.user.profilePhoto = e.target.result;
                localStorage.setItem('secretVaultUser', JSON.stringify(ctrl.user));
                $scope.$apply();
                ctrl.showNotification('Photo de profil mise à jour', 'success');
                console.log('Photo de profil mise à jour');
            };
            reader.readAsDataURL(file);
        }
    };
    
    ctrl.saveProfileSettings = function() {
        localStorage.setItem('secretVaultUser', JSON.stringify(ctrl.user));
        ctrl.showProfileSettings = false;
        ctrl.showNotification('Paramètres sauvegardés', 'success');
        console.log('Paramètres sauvegardés');
    };
    
    ctrl.deleteAccount = function() {
        if (confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Toutes vos données seront perdues.')) {
            if (ctrl.user) {
                localStorage.removeItem('secretVaultUser');
                localStorage.removeItem('secretVaultFiles_' + ctrl.user.id);
            }
            ctrl.logout();
            ctrl.showNotification('Compte supprimé avec succès', 'info');
            console.log('Compte utilisateur supprimé');
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
            case 'type':
                ctrl.userFiles.sort((a, b) => a.type.localeCompare(b.type));
                break;
        }
        console.log('Fichiers triés par:', ctrl.sortBy);
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
        
        // Animation d'entrée
        $timeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        // Suppression automatique
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
