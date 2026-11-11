/* A guided practice round on the actual game screen. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const game=window.Townxel;
 const steps=[
  ['.mapframe','The map','Build on the empty squares of this 10 × 10 grid. Roads and mountains stay in place.','Harita','10 × 10 ızgaradaki boş karelere arazi yerleştir. Yol ve dağlar sabittir.'],
  ['.piece-tray','Your piece','This preview shows the shape you will place as one piece.','Arazi parçan','Önizlemedeki karelerin tamamını tek parça olarak yerleştirirsin.'],
  ['.mapframe','Try placing it','Tap or click the outlined B2 square. The move stays provisional until you confirm.','Yerleştirmeyi dene','Çerçeveli B2 karesine dokun veya tıkla. Onaylayana kadar hamlen kesinleşmez.','place'],
  ['#rotate','Rotate','Press Rotate or R to turn the piece 90°.','Döndür','Döndür düğmesine veya R tuşuna bas. Parça 90° döner.','rotate'],
  ['#flip','Flip','Press Flip or F to mirror the piece.','Aynala','Aynala düğmesine veya F tuşuna bas. Parça yatayda aynalanır.','flip'],
  ['#undo','Undo','Press Undo or S to remove the unconfirmed placement.','Geri al','Onaylanmamış yerleşimi kaldırmak için Geri al düğmesine veya S tuşuna bas.','undo'],
  ['.mapframe','Place it again','Tap B2 again so you have a piece to confirm.','Tekrar yerleştir','Onaylamak üzere parçayı tekrar B2 karesine yerleştir.','place'],
  ['#confirm','Confirm','Confirm locks the piece in place and draws the next card. Try it.','Onayla','Onayla düğmesi parçayı sabitler ve yeni kart çeker. Şimdi dene.','confirm'],
  ['.discovery','Placement cards','Read the card before placing. It shows which neighbors earn a bonus and which conditions cost points.','Yerleştirme kartları','Hamleden önce kartı oku. Hangi komşuların bonus, hangi koşulların ceza getirdiği burada yazar.'],
  ['.objectives','Town duties','Build toward the three goals. Completing all three adds 20 points.','Kasaba görevleri','Üç hedefi tamamlamaya çalış. Üçü de tamamlanırsa 20 ek puan kazanırsın.'],
  ['.town-score','Town score','Track terrain points, bonuses and penalties here. The first card scores nothing.','Kasaba puanı','Arazi puanlarını, bonusları ve cezaları burada takip et. İlk kart puan vermez.'],
  ['.expedition','Rounds','You have 16 rounds: 1–4 basic, 5–12 medium and 13–16 hard.','Turlar','16 turun var: 1–4 temel, 5–12 orta, 13–16 zor.'],
  ['#skip','Pass a card','Skip a card you cannot use. The cost and number of passes depend on the mode.','Kartı pas geç','Kullanamadığın kartı pas geçebilirsin. Hak sayısı ve puan kesintisi moda göre değişir.'],
  ['#giveUp','Give up','Ends the game after confirmation. Your final score becomes 0.','Pes et','Onaylarsan oyun sona erer ve son puanın 0 olur.']
 ];
 let current=-1,origin,returnFocus,returnY,frame,ignoreClick=false;
 const panel=$('tutorialPanel'),shade=$('tutorialShade'),outline=$('tutorialOutline');
 const next=$('tutorialNext'),exit=$('tutorialExit'),title=$('tutorialTitle'),languageButton=$('language');
 function step(){return steps[current];}
 function locate(){return document.querySelector(step()[0]);}
 function sync(){
  if(current<0)return;
  const r=locate().getBoundingClientRect();
  const left=Math.max(0,Math.min(innerWidth,r.left)),right=Math.max(left,Math.min(innerWidth,r.right));
  const top=Math.max(0,Math.min(innerHeight,r.top)),bottom=Math.max(top,Math.min(innerHeight,r.bottom));
  const hole=[[left,top],[left,bottom],[right,bottom],[right,top],[left,top]].map(([x,y])=>x+'px '+y+'px').join(',');
  shade.style.clipPath='polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0,'+hole+',0 0)';
  Object.assign(outline.style,{left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(sync);}
 const practiceCell=()=>$('board').querySelector('[data-x="1"][data-y="1"]');
 function language(){
  if(current<0)return;
  const tr=window.TownxelI18n?.language==='tr';
  $('tutorialCount').textContent=(tr?'Alıştırma':'Practice')+' · '+(current+1)+' / '+steps.length;
  title.textContent=step()[tr?3:1];$('tutorialText').textContent=step()[tr?4:2];
  exit.textContent=tr?'Rehberden çık':'Exit guide';
  next.textContent=current===steps.length-1?(tr?'Bitir':'Finish'):step()[5]?(tr?'Adımı geç →':'Skip step →'):(tr?'İleri →':'Next →');
 }
 function show(index){
  if(index>=steps.length){stop();return;}
  current=index;
  // Skipping a practice step still leaves a valid board for the next action.
  if((step()[5]==='undo'||step()[5]==='confirm')&&!game.pending)game.place(1,1);
  if(!step()[5]&&game.state.turn===0){if(!game.pending)game.place(1,1);game.confirm();}
  language();
  const marked=step()[5]==='place'?practiceCell():null;
  $('board').classList.toggle('tutorial-place',!!marked);
  const target=locate();
  document.body.style.setProperty('--tutorial-panel-height',(panel.offsetHeight+22)+'px');
  const r=target.getBoundingClientRect(),p=panel.getBoundingClientRect();
  if(r.top<8||r.bottom>p.top-8){
   const top=r.height>p.top-16?r.top-8:(r.top+r.bottom)/2-p.top/2;
   window.scrollBy(0,top);
  }
  if(marked&&marked.getBoundingClientRect().bottom>panel.getBoundingClientRect().top-8){
   window.scrollBy(0,marked.getBoundingClientRect().bottom-panel.getBoundingClientRect().top+8);
  }
  (marked||((step()[5]&&step()[5]!=='place')?target:next)).focus({preventScroll:true});
  sync();
 }
 function start(){
  if(current>=0)return;
  origin=document.body.dataset.screen||'home';
  returnFocus=document.activeElement;returnY=window.scrollY;
  game.startPractice();window.TownxelMenus.show('game');
  document.body.classList.add('tutorial-active');panel.hidden=shade.hidden=outline.hidden=false;
  show(0);
 }
 function stop(){
  if(current<0)return;
  current=-1;$('board').classList.remove('tutorial-place');ignoreClick=false;
  panel.hidden=shade.hidden=outline.hidden=true;
  document.body.classList.remove('tutorial-active');document.body.style.removeProperty('--tutorial-panel-height');
  game.stopPractice();window.TownxelMenus.show(origin);window.scrollTo(0,returnY);
  returnFocus?.focus({preventScroll:true});
 }
 next.onclick=()=>show(current+1);
 exit.onclick=stop;
 shade.onclick=()=>{if(current>=0&&!step()[5])show(current+1);};
 document.addEventListener('click',event=>{
  if(current<0||panel.contains(event.target)||languageButton.contains(event.target)||event.target===shade)return;
  const action=step()[5],target=action==='place'?practiceCell():action?locate():null;
  if(!target||!target.contains(event.target)||ignoreClick){event.preventDefault();event.stopImmediatePropagation();return;}
  const index=current;ignoreClick=true;
  setTimeout(()=>{
   ignoreClick=false;
   if(index!==current)return;
   if(action==='place'&&!game.pending||action==='confirm'&&game.state.turn===0||action==='undo'&&game.pending)return;
   show(index+1);
  });
 },true);
 document.addEventListener('keydown',event=>{
  if(current<0)return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();stop();return;}
  if(event.key==='Tab'){
   const action=step()[5],target=action==='place'?practiceCell():action?locate():null;
   const stops=[target,languageButton,exit,next].filter(Boolean),i=stops.indexOf(document.activeElement);
   event.preventDefault();stops[(i<0?(event.shiftKey?stops.length-1:0):(i+(event.shiftKey?-1:1)+stops.length)%stops.length)].focus({preventScroll:true});return;
  }
  const key=event.key.toLowerCase(),action={r:'rotate',f:'flip',s:'undo'}[key];
  if(action||key==='enter'&&event.target===document.body){
   event.preventDefault();event.stopImmediatePropagation();
   if(action===step()[5])locate().click();
  }
 },true);
 window.addEventListener('scroll',schedule,{passive:true});
 window.addEventListener('resize',schedule);
 document.addEventListener('townxel-language-change',()=>{
  if(current<0)return;
  language();
  document.body.style.setProperty('--tutorial-panel-height',(panel.offsetHeight+22)+'px');
  schedule();
 });
 window.TownxelTutorial={start};
})();
