// Plan B: data lives only under /d/{DATA_PATH}/. Open once as {URL}#d={DATA_PATH}; kept in localStorage.
(function(){
  const m=location.hash.match(/[#&]d=([A-Za-z0-9]{32,})/);
  if(m){localStorage.setItem('desk_d',m[1]); history.replaceState(null,'',location.pathname);}
  const D=localStorage.getItem('desk_d'), st=document.getElementById('status');
  if(!D){st.textContent='Open the private link once to connect this phone.';return;}
  const base='d/'+D+'/'; let last=null, wait=15;
  async function tick(){
    try{
      const r=await fetch(base+'state.json?t='+Date.now(),{cache:'no-store'}); if(!r.ok) throw r.status;
      const s=await r.json(); last=s; wait=15;
      document.getElementById('balance').textContent='$'+Number(s.balance).toFixed(2);
      document.getElementById('today').textContent=(s.today_pct>=0?'+':'')+s.today_pct+'% today';
      document.getElementById('mode').textContent=s.mode;
      st.textContent='Updated '+new Date(s.ts*1000).toLocaleTimeString();
      try{const c=await (await fetch(base+'chart.json?t='+Date.now(),{cache:'no-store'})).json(); drawLine(document.getElementById('chart'),c.points);}catch(e){}
    }catch(e){
      wait=Math.min(wait*2,120);
      st.textContent='Desk offline · retrying in '+wait+'s · last update '+(last?new Date(last.ts*1000).toLocaleTimeString():'—');
    }
    setTimeout(tick,wait*1000);
  }
  tick();
})();
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
