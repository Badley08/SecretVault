angular.module('secretVaultApp', [])
.filter('limitTo', function() {
    return function(input, limit) {
        if (!input) return '';
        return input.length > limit ? input.substring(0, limit) + '...' : input;
    };
})
.controller('MainController', function($scope, $timeout) {
    const ctrl = this;
    
    // Supabase client
    let supabase;
    
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
        console.log('🚀 Initialisation de SecretVault avec Supabase...');
        
        // Attendre que Supabase soit chargé
        const waitForSupabase = setInterval(() => {
            if (window.supabaseClient) {
                clearInterval(waitForSupabase);
                supabase = window.supabaseClient;
                ctrl.checkSession();
            }
        }, 100);
        
        // Masquer le loader
        $timeout(function() {
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        }, 1500);
    };
    
    // Vérifier la session existante
    ctrl.checkSession = async function() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            console.log('✅ Session trouvée:', session.user.email);
            ctrl.handleAuthSuccess(session.user);
        }
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
            };
            reader.readAsDataURL(file);
        }
    };
    
    // Connexion
    ctrl.login = async function() {
        if (!ctrl.loginData.username || !ctrl.loginData.password) {
            ctrl.showNotification('Veuillez remplir tous les champs', 'warning');
            return;
        }
        
        ctrl.showLoading();
        
        const email = ctrl.loginData.username.includes('@') 
            ? ctrl.loginData.username 
            : ctrl.loginData.username + '@secretvault.app';
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: ctrl.loginData.password
        });
        
        if (error) {
            console.error('❌ Erreur connexion:', error);
            ctrl.hideLoading();
            ctrl.showNotification('Identifiants incorrects', 'error');
            $scope.$apply();
        } else {
            console.log('✅ Connexion réussie');
            ctrl.handleAuthSuccess(data.user);
            ctrl.hideLoading();
            ctrl.showNotification('Connexion réussie!', 'success');
        }
    };
    
    // Inscription
    ctrl.register = async function() {
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
            : ctrl.registerData.username + '@secretvault.app';
        
        // Créer le compte
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: ctrl.registerData.password
        });
        
        if (authError) {
            console.error('❌ Erreur inscription:', authError);
            ctrl.hideLoading();
            ctrl.showNotification('Erreur: ' + authError.message, 'error');
            $scope.$apply();
            return;
        }
        
        // Créer le profil utilisateur
        const { error: profileError } = await supabase
            .from('users')
            .insert([{
                id: authData.user.id,
                username: ctrl.registerData.username,
                email: email,
                profile_photo: ctrl.registerData.profilePhoto || null,
                storage_type: ctrl.registerData.storageType || 'cloud'
            }]);
        
        if (profileError) {
            console.error('❌ Erreur profil:', profileError);
        }
        
        ctrl.handleAuthSuccess(authData.user);
        ctrl.showRegister = false;
        ctrl.hideLoading();
        ctrl.showNotification('Compte créé avec succès!', 'success');
    };
    
    // Gérer le succès d'authentification
    ctrl.handleAuthSuccess = async function(user) {
        // Récupérer les infos du profil
        const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
        
        ctrl.user = {
            id: user.id,
            username: profile?.username || user.email.split('@')[0],
            email: user.email,
            profilePhoto: profile?.profile_photo || null,
            storageType: profile?.storage_type || 'cloud'
        };
        
        ctrl.loadUserFiles();
        $scope.$apply();
    };
    
    // Déconnexion
    ctrl.logout = async function() {
        await supabase.auth.signOut();
        ctrl.user = null;
        ctrl.userFiles = [];
        ctrl.selectedFiles = [];
        ctrl.loginData = {};
        ctrl.showNotification('Déconnexion réussie', 'info');
        $scope.$apply();
    };
    
    // Gestion des fichiers
    ctrl.handleFileUpload = function(event) {
        const files = event.target.files;
        ctrl.processFiles(Array.from(files));
        event.target.value = '';
    };
    
    ctrl.handleFileDrop = function(files) {
        ctrl.processFiles(Array.from(files));
        ctrl.isDragOver = false;
    };
    
    ctrl.processFiles = async function(files) {
        if (!files || files.length === 0) return;
        
        ctrl.showLoading();
        
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
            
            await ctrl.uploadToSupabase(file);
        }
        
        ctrl.hideLoading();
    };
    
    // Upload vers Supabase Storage
    ctrl.uploadToSupabase = async function(file) {
        if (!ctrl.user) return;
        
        console.log('📤 Upload:', file.name);
        
        const timestamp = Date.now();
        const fileName = `${ctrl.user.id}/${timestamp}_${file.name}`;
        
        // Upload vers Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('user-images')
            .upload(fileName, file);
        
        if (uploadError) {
            console.error('❌ Erreur upload:', uploadError);
            ctrl.showNotification('Erreur upload: ' + uploadError.message, 'error');
            return;
        }
        
        console.log('✅ Fichier uploadé:', uploadData.path);
        
        // Obtenir l'URL publique
        const { data: urlData } = supabase.storage
            .from('user-images')
            .getPublicUrl(fileName);
        
        console.log('🔗 URL:', urlData.publicUrl);
        
        // Sauvegarder dans la base de données
        const { data: dbData, error: dbError } = await supabase
            .from('files')
            .insert([{
                user_id: ctrl.user.id,
                name: file.name,
                size: (file.size / (1024 * 1024)).toFixed(2),
                type: 'image',
                preview_url: urlData.publicUrl,
                storage_path: fileName
            }])
            .select()
            .single();
        
        if (dbError) {
            console.error('❌ Erreur DB:', dbError);
            ctrl.showNotification('Erreur sauvegarde: ' + dbError.message, 'error');
            return;
        }
        
        console.log('💾 Sauvegardé en DB:', dbData.id);
        
        // Ajouter à la galerie
        ctrl.userFiles.unshift({
            id: dbData.id,
            name: dbData.name,
            size: dbData.size,
            type: dbData.type,
            preview: dbData.preview_url,
            storagePath: dbData.storage_path,
            date: dbData.created_at
        });
        
        ctrl.showNotification('Image ajoutée avec succès!', 'success');
        $scope.$apply();
    };
    
    // Charger les fichiers
    ctrl.loadUserFiles = async function() {
        if (!ctrl.user) return;
        
        console.log('📥 Chargement des fichiers...');
        ctrl.showLoading();
        
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('user_id', ctrl.user.id)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Erreur chargement:', error);
            ctrl.hideLoading();
            $scope.$apply();
            return;
        }
        
        ctrl.userFiles = data.map(file => ({
            id: file.id,
            name: file.name,
            size: file.size,
            type: file.type,
            preview: file.preview_url,
            storagePath: file.storage_path,
            date: file.created_at
        }));
        
        console.log('✅ Fichiers chargés:', ctrl.userFiles.length);
        ctrl.hideLoading();
        $scope.$apply();
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
        const link = document.createElement('a');
        link.href = file.preview;
        link.download = file.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        ctrl.showNotification(`"${file.name}" téléchargé`, 'success');
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
    ctrl.deleteFile = async function(file) {
        if (!confirm(`Supprimer "${file.name}" ?`)) return;
        
        ctrl.showLoading();
        
        // Supprimer de Storage
        const { error: storageError } = await supabase.storage
            .from('user-images')
            .remove([file.storagePath]);
        
        if (storageError) {
            console.error('❌ Erreur suppression storage:', storageError);
        }
        
        // Supprimer de la DB
        const { error: dbError } = await supabase
            .from('files')
            .delete()
            .eq('id', file.id);
        
        if (dbError) {
            console.error('❌ Erreur suppression DB:', dbError);
            ctrl.hideLoading();
            ctrl.showNotification('Erreur suppression', 'error');
            $scope.$apply();
            return;
        }
        
        // Supprimer de l'interface
        const index = ctrl.userFiles.findIndex(f => f.id === file.id);
        if (index > -1) {
            ctrl.userFiles.splice(index, 1);
        }
        ctrl.removeFromSelection(file);
        
        ctrl.hideLoading();
        ctrl.showNotification('Fichier supprimé', 'info');
        $scope.$apply();
    };
    
    ctrl.deleteSelected = async function() {
        if (ctrl.selectedFiles.length === 0) {
            ctrl.showNotification('Aucun fichier sélectionné', 'warning');
            return;
        }
        
        if (!confirm(`Supprimer ${ctrl.selectedFiles.length} fichier(s) ?`)) return;
        
        ctrl.showLoading();
        
        for (let file of ctrl.selectedFiles) {
            await supabase.storage.from('user-images').remove([file.storagePath]);
            await supabase.from('files').delete().eq('id', file.id);
        }
        
        ctrl.userFiles = ctrl.userFiles.filter(file => 
            !ctrl.selectedFiles.some(selected => selected.id === file.id)
        );
        ctrl.selectedFiles = [];
        
        ctrl.hideLoading();
        ctrl.showNotification('Fichiers supprimés', 'info');
        $scope.$apply();
    };
    
    ctrl.deleteAllFiles = async function() {
        if (ctrl.userFiles.length === 0) {
            ctrl.showNotification('Aucun fichier à supprimer', 'warning');
            return;
        }
        
        if (!confirm('Supprimer tous les fichiers ? Cette action est irréversible.')) return;
        
        ctrl.showLoading();
        
        for (let file of ctrl.userFiles) {
            await supabase.storage.from('user-images').remove([file.storagePath]);
            await supabase.from('files').delete().eq('id', file.id);
        }
        
        ctrl.userFiles = [];
        ctrl.selectedFiles = [];
        
        ctrl.hideLoading();
        ctrl.showNotification('Tous les fichiers ont été supprimés', 'info');
        $scope.$apply();
    };
    
    ctrl.removeFromSelection = function(file) {
        const index = ctrl.selectedFiles.findIndex(f => f.id === file.id);
        if (index > -1) {
            ctrl.selectedFiles.splice(index, 1);
        }
    };
    
    // Gestion du profil
    ctrl.updateProfilePhoto = async function(event) {
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
        
        const fileName = `${ctrl.user.id}/profile_${Date.now()}.jpg`;
        
        const { data, error } = await supabase.storage
            .from('user-images')
            .upload(fileName, file);
        
        if (error) {
            console.error('❌ Erreur upload profil:', error);
            ctrl.hideLoading();
            ctrl.showNotification('Erreur upload', 'error');
            $scope.$apply();
            return;
        }
        
        const { data: urlData } = supabase.storage
            .from('user-images')
            .getPublicUrl(fileName);
        
        await supabase
            .from('users')
            .update({ profile_photo: urlData.publicUrl })
            .eq('id', ctrl.user.id);
        
        ctrl.user.profilePhoto = urlData.publicUrl;
        ctrl.hideLoading();
        ctrl.showNotification('Photo de profil mise à jour', 'success');
        $scope.$apply();
    };
    
    ctrl.saveProfileSettings = async function() {
        await supabase
            .from('users')
            .update({ storage_type: ctrl.user.storageType })
            .eq('id', ctrl.user.id);
        
        ctrl.showProfileSettings = false;
        ctrl.showNotification('Paramètres sauvegardés', 'success');
        $scope.$apply();
    };
    
    ctrl.deleteAccount = async function() {
        if (!confirm('Êtes-vous sûr de vouloir supprimer votre compte ?')) return;
        
        ctrl.showLoading();
        
        // Supprimer tous les fichiers
        await ctrl.deleteAllFiles();
        
        // Supprimer le profil
        await supabase.from('users').delete().eq('id', ctrl.user.id);
        
        // Supprimer le compte Auth
        await supabase.auth.admin.deleteUser(ctrl.user.id);
        
        ctrl.hideLoading();
        ctrl.showNotification('Compte supprimé', 'info');
        ctrl.logout();
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
