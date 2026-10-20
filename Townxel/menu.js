/* Menus use the original 1920 × 1080 artwork with aligned, accessible hotspots. */
'use strict';
(()=>{
const $=id=>document.getElementById(id),config=window.TOWNXEL_CONFIG;
function show(screen){
 if($('dialog').open)$('dialog').close();document.body.classList.remove('giveup-open');
 document.body.dataset.screen=screen;$('gameScreen').hidden=screen!=='game';$('menuScreen').hidden=screen==='game';$('reportBug').hidden=screen==='game';
 // Both screens share the landscape; buttons supply all menu differences.
 $('menuBackdrop').src=config.mainMenu;
 $('menuStart').hidden=screen!=='home';$('menuHelp').hidden=screen!=='home';$('modeButtons').hidden=screen!=='start';
 $('menuScreen').setAttribute('aria-label',screen==='start'?'Choose difficulty':'Main menu');window.scrollTo(0,0);window.TownxelI18n?.apply();
}
function start(mode){const newMap=1+Math.floor(Math.random()*2147483646);window.Townxel.init(newMap,mode);show('game');}
$('menuHome').onclick=()=>show('home');$('menuStart').onclick=()=>show('start');$('menuHelp').onclick=()=>window.Townxel.help();
document.querySelectorAll('.mode-choice').forEach(button=>{button.onclick=()=>start(button.dataset.mode);});
$('new').onclick=e=>{e.preventDefault();show('start');};
$('reportBug').querySelector('img').src=config.bugIcon;
// Use the uploaded, unmodified sprite sheets as separate button artwork.
function setSprite(button,file,rect){const [x,y,w,h]=rect;button.style.backgroundImage=`url("${file}")`;button.style.backgroundSize=`${1920/w*100}% ${1080/h*100}%`;button.style.backgroundPosition=`${x/(1920-w)*100}% ${y/(1080-h)*100}%`;button.style.backgroundRepeat='no-repeat';}
function refreshButtons(){const tr=window.TownxelI18n?.language==='tr',en=config.menuSprites.en,local=config.menuSprites.tr;
 setSprite($('menuHome'),en,[540,156,852,168]);setSprite($('menuStart'),local,tr?[840,144,660,168]:[60,228,660,168]);setSprite($('menuHelp'),local,tr?[840,384,660,168]:[60,432,660,168]);
 const rects=tr?[[60,24,660,168],[60,660,660,168],[60,888,660,168]]:[[636,384,660,168],[636,612,660,168],[636,840,660,168]];
 document.querySelectorAll('.mode-choice').forEach((button,i)=>setSprite(button,tr?local:en,rects[i]));}
document.addEventListener('townxel-language-change',refreshButtons);
$('reportBug').onclick=()=>{
 window.Townxel.modal(`<p class="eyebrow">REPORT A BUG</p><h2>Send a bug report</h2><form id="bugMailForm"><label class="bug-label">Subject<input id="bugTitle" required maxlength="120" placeholder="e.g. Piece does not rotate"></label><label class="bug-label">Description<textarea id="bugDetails" required rows="5" maxlength="5000" placeholder="What did you do, and what happened?"></textarea></label><p class="mail-recipient">To: <span>${config.bugReportEmail}</span></p><p>Your email app will open with this report. Review it there and send it.</p><button id="sendBugReport" class="primary" type="submit">Send</button></form>`);
 $('bugMailForm').onsubmit=e=>{e.preventDefault();const tr=window.TownxelI18n?.language==='tr';const subject='Townxel — '+$('bugTitle').value.trim();const description=$('bugDetails').value.trim();const screen={home:tr?'Ana sayfa':'Home',start:tr?'Zorluk menüsü':'Difficulty menu',game:tr?'Oyun':'Game'}[document.body.dataset.screen];const body=`${tr?'Açıklama':'Description'}:\r\n${description}\r\n\r\n${tr?'Ekran':'Screen'}: ${screen}`;
 const url='mailto:'+config.bugReportEmail+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);window.location.href=url;
 // Keep the report on screen: opening a mail app is not proof of delivery.
 };
};
window.TownxelMenus={show,start};refreshButtons();show('home');
})();
