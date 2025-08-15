// ------------------------------
// Configuración del cliente Supabase
// ------------------------------
const supabaseUrl = 'https://wdadyqtzatlkrbfcltfb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkYWR5cXR6YXRsa3JiZmNsdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNjI5MDksImV4cCI6MjA3MDgzODkwOX0.FqTXsMyLvAVLLTp0v7qHKWca44GdHhmkdERXRRH9nR0';

// Crear cliente global
window.supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);

// ------------------------------
// Funciones de Auth
// ------------------------------

// Registro de usuario
async function signUp(email, password) {
  const { data, error } = await window.supabase.auth.signUp({ email, password });
  if(error) throw error;
  return data;
}

// Login de usuario
async function signIn(email, password) {
  const { data, error } = await window.supabase.auth.signInWithPassword({ email, password });
  if(error) throw error;
  return data;
}

// Logout
async function signOut() {
  const { error } = await window.supabase.auth.signOut();
  if(error) throw error;
}

// Obtener usuario actual
async function getUser() {
  const { data: { user } } = await window.supabase.auth.getUser();
  return user;
}

// Obtener sesión actual
async function getSession() {
  const { data: { session } } = await window.supabase.auth.getSession();
  return session;
}

// Escuchar cambios de auth
window.supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event);
  if(event === 'SIGNED_OUT') window.location.href = 'index.html';
});
