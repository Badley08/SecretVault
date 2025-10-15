// Configuration Firebase
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

// Initialisation Firebase avec vérification
if (typeof firebase !== 'undefined') {
    try {
        // Vérifier si Firebase est déjà initialisé
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase initialisé avec succès');
        } else {
            console.log('✅ Firebase déjà initialisé');
        }
        
        // Vérifier que tous les services sont disponibles
        if (firebase.auth && firebase.firestore && firebase.storage) {
            console.log('✅ Tous les services Firebase sont disponibles');
            console.log('   - Auth:', typeof firebase.auth());
            console.log('   - Firestore:', typeof firebase.firestore());
            console.log('   - Storage:', typeof firebase.storage());
        } else {
            console.error('❌ Certains services Firebase ne sont pas disponibles');
        }
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de Firebase:', error);
    }
} else {
    console.error('❌ Firebase SDK n\'est pas chargé. Vérifiez les scripts CDN.');
}
