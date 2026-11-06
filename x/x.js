(function(){
  var st={get:function(k,d){try{return localStorage.getItem(k)||d}catch(e){return d}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
  var CAP=.55, rot=Math.min(CAP,parseFloat(st.get('rot4',0))||0);
  rot=Math.min(CAP,rot+0.004); st.set('rot4',rot);
  var c=parseInt(st.get('cnt',0))||6660; st.set('cnt',c+1);
  function dead(x,y,n){for(var i=0;i<n;i++){var d=document.createElement('i');d.className='dead'+(Math.random()<.4?' k':'');var s=1+Math.floor(Math.random()*3);d.style.cssText='left:'+((x+(Math.random()-.5)*60)|0)+'px;top:'+((y+(Math.random()-.5)*60)|0)+'px;width:'+s+'px;height:'+s+'px';document.body.appendChild(d);}}
  // rot: black blocks over the page, proportional
  var nb=Math.floor(rot*rot*120);
  for(var i=0;i<nb;i++){var b=document.createElement('i');b.className='blk';b.style.cssText='left:'+(Math.random()*100)+'vw;top:'+(Math.random()*100)+'vh;width:'+(2+Math.random()*12*rot*4)+'vw;height:'+(1+Math.random()*4)+'vh';document.body.appendChild(b);}
  for(var j=0;j<Math.floor(rot*80);j++) dead(Math.random()*innerWidth,Math.random()*innerHeight,1);
  var fl=document.getElementById('fl');
  addEventListener('pointerdown',function(e){dead(e.clientX,e.clientY,3);fl.style.opacity=.5;setTimeout(function(){fl.style.opacity=0},60);rot=Math.min(CAP,rot+0.002);st.set('rot4',rot);},{passive:true});
  setInterval(function(){if(Math.random()<rot)dead(Math.random()*innerWidth,Math.random()*innerHeight,1);},500);
  // random flash
  setInterval(function(){if(Math.random()<.15){fl.style.opacity=.12;setTimeout(function(){fl.style.opacity=0},50);}},900);
  document.addEventListener('keydown',function(e){if(e.key==='Backspace')e.preventDefault();});
  window.__rot=rot;
})();