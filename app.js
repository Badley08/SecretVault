angular.module('secretVaultApp', [])
.controller('MainController', function($scope, $timeout) {
    const ctrl = this;
    
    // Données initiales
    ctrl.user = null;
    ctrl.showRegister = false;
    ctrl.showProfileSettings = false;
    ctrl.userFiles = [];
    ctrl.loginData = {};
    ctrl.registerData = {
        storageType: 'cloud'
    };
    ctrl.profilePreview = null;
    
    // Gestion de la photo de profil
    ctrl.handleProfilePhoto = function(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                alert('La photo ne doit pas dépasser 10MB');
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
        showLoading();
        // Simulation de connexion - à remplacer par Firebase Auth
        $timeout(function() {
            ctrl.user = {
                username: ctrl.loginData.username,
                profilePhoto: null,
                storageType: 'cloud'
            };
            hideLoading();
        }, 1000);
    };
    
    // Inscription
    ctrl.register = function() {
        if (!ctrl.registerData.username || !ctrl.registerData.password) {
            alert('Veuillez remplir tous les champs');
            return;
        }
        
        showLoading();
        // Simulation d'inscription - à remplacer par Firebase Auth
        $timeout(function() {
            ctrl.user = {
                username: ctrl.registerData.username,
                profilePhoto: ctrl.registerData.profilePhoto,
                storageType: ctrl.registerData.storageType
            };
            ctrl.showRegister = false;
            hideLoading();
        }, 1500);
    };
    
    // Déconnexion
    ctrl.logout = function() {
        ctrl.user = null;
        ctrl.userFiles = [];
        ctrl.loginData = {};
    };
    
    // Gestion des fichiers uploadés
    ctrl.handleFileUpload = function(event) {
        const files = event.target.files;
        for (let file of files) {
            if (file.size > 10 * 1024 * 1024) {
                alert(`Le fichier ${file.name} dépasse 10MB et ne peut pas être uploadé`);
                continue;
            }
            
            const fileObj = {
                name: file.name,
                size: (file.size / (1024 * 1024)).toFixed(2),
                type: file.type.startsWith('image') ? 'image' : 'video',
                data: file
            };
            
            ctrl.userFiles.push(fileObj);
        }
        $scope.$apply();
        event.target.value = '';
    };
    
    // Téléchargement de fichier
    ctrl.downloadFile = function(file) {
        // Implémentation du téléchargement
        alert(`Téléchargement de ${file.name}`);
    };
    
    // Suppression de fichier
    ctrl.deleteFile = function(file) {
        if (confirm(`Supprimer ${file.name}?`)) {
            const index = ctrl.userFiles.indexOf(file);
            ctrl.userFiles.splice(index, 1);
        }
    };
    
    // Mise à jour photo de profil
    ctrl.updateProfilePhoto = function(event) {
        const file = event.target.files[0];
        if (file && file.size <= 10 * 1024 * 1024) {
            const reader = new FileReader();
            reader.onload = function(e) {
                ctrl.user.profilePhoto = e.target.result;
                $scope.$apply();
            };
            reader.readAsDataURL(file);
        }
    };
    
    // Sauvegarde des paramètres
    ctrl.saveProfileSettings = function() {
        ctrl.showProfileSettings = false;
        alert('Paramètres sauvegardés!');
    };
    
    // Suppression du compte
    ctrl.deleteAccount = function() {
        if (confirm('Êtes-vous sûr de vouloir supprimer votre compte? Cette action est irréversible.')) {
            ctrl.logout();
            alert('Compte supprimé avec succès');
        }
    };
    
    function showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }
    
    function hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }
});
