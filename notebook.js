const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAuth(){
  const { data: { session } } = await sb.auth.getSession();
  if(session){
    document.getElementById('auth-section').style.display='none';
    document.getElementById('notebook-section').style.display='block';
    loadEntries();
  }else{
    document.getElementById('auth-section').style.display='block';
    document.getElementById('notebook-section').style.display='none';
  }
}

async function login(e){
  e.preventDefault();
  const email=document.getElementById('email').value;
  const password=document.getElementById('password').value;
  if(SUPABASE_URL.startsWith('YOUR') || SUPABASE_KEY.startsWith('YOUR')){
    showNotification('Configuration Supabase manquante', 'error');
    return;
  }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if(error) return showNotification(error.message,'error');
  checkAuth();
}

async function signup(e){
  e.preventDefault();
  const email=document.getElementById('email').value;
  const password=document.getElementById('password').value;
  if(SUPABASE_URL.startsWith('YOUR') || SUPABASE_KEY.startsWith('YOUR')){
    showNotification('Configuration Supabase manquante', 'error');
    return;
  }
  const { error } = await sb.auth.signUp({ email, password });
  if(error) return showNotification(error.message,'error');
  showNotification('Vérifiez vos mails pour confirmer votre compte.');
}

async function logout(){
  await sb.auth.signOut();
  checkAuth();
}

async function loadEntries(){
  const { data, error } = await sb.from('observations').select('*').order('created_at',{ascending:false});
  if(error){ showNotification('Erreur chargement carnet','error'); return; }
  const list=document.getElementById('entries');
  list.innerHTML=data.map(d=>`<li><strong>${d.species}</strong>${d.note?'<br>'+d.note:''}${d.favorite?' ⭐':''}</li>`).join('');
}

async function saveObservation(species,note='',favorite=false){
  const { data: { session } } = await sb.auth.getSession();
  if(!session){ showNotification('Connectez-vous depuis le Carnet.', 'error'); return; }
  const { error } = await sb.from('observations').insert({species,note,favorite});
  if(error) showNotification('Erreur sauvegarde','error');
}

window.saveObservationPrompt=async function(species){
  const note=prompt(`Note pour ${species} (optionnel):`,'');
  if(note===null) return;
  await saveObservation(species,note,true);
  showNotification('Observation enregistrée');
}

document.addEventListener('DOMContentLoaded',()=>{
  const f=document.getElementById('login-form');
  if(f){
    f.addEventListener('submit',login);
    document.getElementById('signup-btn').addEventListener('click',signup);
    document.getElementById('logout-btn').addEventListener('click',logout);
    checkAuth();
  }
});
