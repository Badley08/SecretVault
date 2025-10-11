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

// Initialisation Firebase
try {
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();
    
    console.log('Firebase initialisé avec succès');
    
    // Configuration CORS pour Firebase
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    
} catch (error) {
    console.error('Erreur Firebase:', error);
}
