(function(){
 let saved;try{saved=localStorage.getItem('obra-mockup-appearance');}catch{}
 const requested=new URLSearchParams(location.search).get('mode');
 const mode=['light','dark'].includes(requested)?requested:saved==='light'?'light':'dark';
 document.documentElement.dataset.mode=mode;
})();
