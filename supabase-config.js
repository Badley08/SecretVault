// Configuration Supabase - SecretVault
const SUPABASE_URL = 'https://iigkrlszbtoudfhvtuuc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpZ2tybHN6YnRvdWRmaHZ0dXVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTEzMjQsImV4cCI6MjA3NjEyNzMyNH0.6ufhAIWlkypszFlX5RKWPmYZZ6PioGfKqJ4KRMhm-G4';

// Initialiser Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase initialisé avec succès');
console.log('🔗 URL:', SUPABASE_URL);

// Export pour utilisation dans l'app
window.supabaseClient = supabase;
