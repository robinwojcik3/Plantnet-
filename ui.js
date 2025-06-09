(function(){
  const style = document.createElement('style');
  style.textContent = `
#notification-container{position:fixed;top:1rem;right:1rem;z-index:2000;display:flex;flex-direction:column;align-items:flex-end;}
.notification{padding:10px 15px;margin-top:.5rem;border-radius:4px;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.3);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
.notification.success{background:#4caf50;}
.notification.error{background:#e53935;}
#modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;z-index:3000;padding:1rem;}
#modal-overlay.show{display:flex;}
#modal-overlay .modal-content{background:var(--card,#fff);color:var(--text,#000);padding:1rem 1.5rem;border-radius:6px;max-width:500px;width:100%;}
#modal-overlay .modal-close{float:right;cursor:pointer;background:none;border:none;font-size:1.5rem;}
#spinner-overlay{position:fixed;top:0;left:0;width:100%;height:100%;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.4);z-index:3500;}
#spinner-overlay.show{display:flex;}
#spinner-overlay .spinner{width:48px;height:48px;border:4px solid var(--border,#e0e0e0);border-top-color:var(--primary,#388e3c);border-radius:50%;animation:spin 1s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
`;
  document.head.appendChild(style);
  document.addEventListener('DOMContentLoaded',()=>{
    const n=document.createElement('div');
    n.id='notification-container';
    document.body.appendChild(n);
    const m=document.createElement('div');
    m.id='modal-overlay';
    m.innerHTML='<div class="modal-content"><button class="modal-close" aria-label="Fermer">&times;</button><div class="modal-body"></div></div>';
    document.body.appendChild(m);
    m.querySelector('.modal-close').addEventListener('click',()=>m.classList.remove('show'));
    const s=document.createElement('div');
    s.id='spinner-overlay';
    s.innerHTML='<div class="spinner"></div>';
    document.body.appendChild(s);
  });
  window.showNotification=function(message,type='info'){
    const c=document.getElementById('notification-container');
    if(!c)return;const d=document.createElement('div');
    d.className='notification '+(type==='error'?'error':'success');
    d.textContent=message;c.appendChild(d);setTimeout(()=>d.remove(),4000);
  };
  window.showModal=function(message){
    const o=document.getElementById('modal-overlay');
    if(!o)return;o.querySelector('.modal-body').textContent=message;o.classList.add('show');
  };
  window.toggleSpinner=function(show){
    const s=document.getElementById('spinner-overlay');
    if(!s)return; s.classList.toggle('show', !!show);
  };
})();
