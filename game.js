/* Townxel. Original, dependency-free game. All rules and card data live here. */
'use strict';
// Image paths are editable in config.js. No images are embedded in the code.
const CONFIG=window.TOWNXEL_CONFIG;
const asset=name=>CONFIG.tiles[name];
document.querySelector('.brand img').src=CONFIG.logo;
const SIZE=10, TOTAL=16, KEY='townxel-medieval-v8';
const TYPES=['forest','farm','village','water'];
const LABEL={forest:'Forest',farm:'Farmland',village:'Village',water:'Water',mountain:'Mountain',road:'Road',mine:'Mine'};
// Disconnected and diagonal pieces are intentional. Goals still use edge adjacency.
const SHAPE_POOLS=[
 [[[0,0]],[[0,0],[1,0]],[[0,0],[0,1]],[[0,0]],[[0,0],[1,0]],[[0,0],[0,1]],[[0,0]],[[0,0],[1,0]]],
 [[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[1,1],[2,1]],[[0,0],[0,1],[0,2],[1,2]],[[0,0],[1,1]],[[0,0],[1,1],[2,2]],[[0,0],[1,0],[2,0]],[[0,0],[2,0],[1,1]],[[0,0],[1,0],[2,0],[1,1]]],
 [[[0,0],[1,0],[2,0],[0,1],[0,2]],[[1,0],[0,1],[1,1],[2,1],[1,2]],[[0,0],[1,1],[2,2],[3,3],[4,4]],[[0,0],[2,0],[1,1],[0,2],[2,2],[1,3]],[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],[[0,0],[0,1],[1,1],[2,1],[2,2]],[[0,0],[2,0],[0,2],[2,2],[1,3]],[[0,0],[1,0],[2,1],[3,1],[4,2]]]
];
const TITLES={forest:['The quiet woods','A green beginning','Roots & branches','Beyond the treeline'],farm:['Fields of gold','The early harvest','A farmer’s promise','Furrows in the earth'],village:['A place to call home','The first settlers','Hearth & home','A little gathering'],water:['A silver shoreline','Still waters','The winding blue','A quiet spring']};
const STORIES={mine:'A rare deposit hidden beneath the valley.',forest:'Where the canopy meets the sky, a new woodland takes root.',farm:'Turn a little open ground into a season of plenty.',village:'A few rooftops, a warm hearth and the beginning of a community.',water:'Trace the water’s edge. The rest of the valley will follow.'};
// 96 cards: four terrain types, eight shapes per type, three tiers.
const DECK=[];for(let tier=0;tier<3;tier++)for(const type of TYPES)for(let v=0;v<8;v++)DECK.push({id:`${tier}-${type}-${v}`,tier,type,title:TITLES[type][v%4],shape:SHAPE_POOLS[tier][v],diagonal:tier===1&&[3,4,6].includes(v)});
let state,pending=null,hover=null,orientation=[],soundOn=false,audioCtx,ended=false;
const $=id=>document.getElementById(id);
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let random;
function neighbors(x,y){return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>a>=0&&b>=0&&a<SIZE&&b<SIZE);}
function normalize(shape){const mx=Math.min(...shape.map(c=>c[0])),my=Math.min(...shape.map(c=>c[1]));return shape.map(([x,y])=>[x-mx,y-my]);}
function variants(shape){let s=shape;const all=[];for(let f=0;f<2;f++){for(let r=0;r<4;r++){all.push(normalize(s));s=s.map(([x,y])=>[-y,x]);}s=s.map(([x,y])=>[-x,y]);}return all;}
function cellsAt(x,y,shape=orientation){return shape.map(([a,b])=>[x+a,y+b]);}
// Only geometry and occupied cells block a move. Card conditions never block it.
function legal(cells,card=state.card,board=state.board){return !cells.some(([x,y])=>x<0||y<0||x>=SIZE||y>=SIZE||board[y][x]);}
function rulePenalty(cells,card=state.card,board=state.board){
 if(card.intro||card.special)return 0;
 const adjacent=cells.flatMap(([x,y])=>neighbors(x,y).map(([a,b])=>board[b][a]));
 const edge=cells.some(([x,y])=>x===0||y===0||x===SIZE-1||y===SIZE-1);
 const violated=card.conditions.some(c=>c.kind==='avoid'?adjacent.includes(c.type):c.kind==='road'?!adjacent.includes('road'):!edge);
 // A combined instruction costs the printed penalty once, even if several parts fail.
 return violated?card.penaltyPoints:0;
}
const MODE_RULES={relaxed:{passes:Infinity,passCost:0,rotate:Infinity,flip:Infinity,undo:Infinity},standard:{passes:3,passCost:5,rotate:5,flip:5,undo:6},expert:{passes:1,passCost:8,rotate:3,flip:3,undo:4}};
function modeRules(){return MODE_RULES[state.mode];}
function remaining(action){return modeRules()[action]-state.actions[action];}
function canTransform(action){return state.turnActions[action]||remaining(action)>0;}
const SHAPE_KEYS=new WeakMap();
function shapeKey(shape){if(!SHAPE_KEYS.has(shape))SHAPE_KEYS.set(shape,variants(shape).map(s=>s.map(c=>c.join(',')).sort().join(';')).sort()[0]);return SHAPE_KEYS.get(shape);}
function playableVariants(shape){let forms=[normalize(shape)];if(canTransform('rotate')){let s=shape;for(let i=0;i<3;i++){s=normalize(s.map(([x,y])=>[-y,x]));forms.push(s);}}if(canTransform('flip'))forms.push(...forms.map(s=>normalize(s.map(([x,y])=>[-x,y]))));return forms;}
function canPlace(card){return playableVariants(card.shape).some(s=>{for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(legal(cellsAt(x,y,s),card))return true;return false;});}
function tierAt(t){return t<4?0:t<12?1:2;}
function draw(){state.turnActions={rotate:false,flip:false};const previousShape=state.card?shapeKey(state.card.shape):null;const tier=tierAt(state.turn);const diagonal=tier===1&&state.mediumDiagonalTurns.includes(state.turn);
 // One independent roll per eligible round; drawing consumes this unique card.
 if(state.turn>=9&&state.turn<=15&&!state.mineDrawn&&canPlace({shape:[[0,0]]})&&random()<({relaxed:.03,standard:.02,expert:.01})[state.mode]){
 state.card={id:'special-mine',type:'mine',title:'Mine',tier,special:true,shape:[[0,0]],diagonal:false,intro:false,conditions:[],bonusTypes:[],bonusPoints:({relaxed:12,standard:10,expert:9})[state.mode],penaltyPoints:0};
 state.mineDrawn=true;state.used.push(state.card.id);state.rescue=false;orientation=[[0,0]];pending=null;hover=null;save();return;
 }
 const eligible=c=>c.tier===tier&&(tier===0||shapeKey(c.shape)!==previousShape)&&!state.used.includes(c.id)&&(tier!==0||c.type===state.basicOrder[state.turn])&&(tier!==1||c.diagonal===diagonal);
 let pool=DECK.filter(c=>eligible(c)&&state.turn-(state.last[c.type]??-99)>=(state.mode==='expert'?2:3));
 let valid=pool.filter(canPlace);if(!valid.length)valid=DECK.filter(c=>eligible(c)&&canPlace(c));
 if(!valid.length){const smallShapes=diagonal?[[[0,0],[1,1]],[[0,0],[1,1],[2,2]],[[0,0],[2,0],[1,1]]]:[[[0,0]],[[0,0],[1,0]],[[0,0],[0,1]],[[0,0],[1,0],[0,1]]];
 const shape=smallShapes.find(shape=>(tier===0||shapeKey(shape)!==previousShape)&&canPlace({shape}));
 if(!shape){state.finished=true;ended=true;pending=null;hover=null;save();return;}
 state.card={id:'rescue-'+state.turn,tier,type:tier===0?state.basicOrder[state.turn]:TYPES[state.turn%4],title:'A small opportunity',shape,diagonal,rule:'none'};state.rescue=true;
 }else{state.card=JSON.parse(JSON.stringify(valid[Math.floor(random()*valid.length)]));state.rescue=false;}
 setCardPoints(state.card);state.used.push(state.card.id);state.last[state.card.type]=state.turn;orientation=state.card.shape.map(c=>[...c]);pending=null;hover=null;save();}
// Plans are rolled once per expedition. Every limit applies separately to each tier.
function makePlans(mode){
 const bonus=Array.from({length:3},(_,tier)=>{const used={2:0,3:0};return Array.from({length:[4,8,4][tier]},(_,i)=>{if(tier===0&&i===0)return 0;const r=random();const n=r<.10&&used[3]<2?3:r<.38&&used[2]<4?2:1;if(n>1)used[n]++;return n;});});
 const medium=Array(8).fill(1);for(const i of shuffle([0,1,2,3,4,5,6,7]))if(medium.filter(n=>n===2).length<2&&random()<.12)medium[i]=2;
 const hard=Array(4).fill(1),slots=shuffle([0,1,2,3]);
 const doubles=mode==='expert'?(random()<.15?2:1):(random()<.12?1:0);
 for(let i=0;i<doubles;i++)hard[slots.pop()]=2;
 if(mode!=='relaxed'){const cap=mode==='expert'?2:1;let triples=0;for(const i of slots)if(triples<cap&&random()<.07){hard[i]=3;triples++;}}
 return {bonus,penalty:[Array(4).fill(1),medium,hard]};
}
function setCardPoints(card){
 const tier=card.tier??0,index=state.turn-[0,4,12][tier];card.intro=state.turn===0;
 if(card.intro){card.bonusPoints=0;card.penaltyPoints=0;card.bonusTypes=[];card.conditions=[];return;}
 card.bonusPoints=tier===0?5:tier===1?3+Math.floor(random()*3):4+Math.floor(random()*3);
 card.penaltyPoints=tier===0?2+Math.floor(random()*3):tier===1?4+Math.floor(random()*3):8+Math.floor(random()*3);
 const count=state.plans.penalty[tier][index];
 const options=shuffle([...Object.keys(LABEL).filter(type=>type!=='mine').map(type=>({kind:'avoid',type})),{kind:'road'},{kind:'edge'}]);
 card.conditions=[];for(const c of options){if(card.conditions.length===count)break;if((c.kind==='road'&&card.conditions.some(x=>x.kind==='avoid'&&x.type==='road'))||(c.kind==='avoid'&&c.type==='road'&&card.conditions.some(x=>x.kind==='road')))continue;card.conditions.push(c);}
 const forbidden=card.conditions.filter(c=>c.kind==='avoid').map(c=>c.type);
 card.bonusTypes=shuffle(Object.keys(LABEL).filter(t=>t!=='mine'&&!forbidden.includes(t))).slice(0,state.plans.bonus[tier][index]);
}
function englishList(items,joiner='or'){return items.length<2?items[0]:items.length===2?items.join(` ${joiner} `):items.slice(0,-1).join(', ')+` ${joiner} `+items[items.length-1];}
const NEIGHBOR_LABEL={forest:'forest',farm:'farmland',village:'villages',water:'water',mountain:'mountains',road:'the road'};
function placementText(card){return card.special?'Place anywhere on an empty square. No penalty.':card.intro?'Just place.':card.conditions.map(c=>c.kind==='avoid'?`Avoid ${NEIGHBOR_LABEL[c.type]}`:c.kind==='road'?'Reach the road':'Reach the map edge').join('; ')+`. Any violation: −${card.penaltyPoints}.`;}
function bonusText(card){return card.special?`+${card.bonusPoints} points for placing this mine.`:card.intro?'':`+${card.bonusPoints} per square touching ${englishList(card.bonusTypes.map(t=>NEIGHBOR_LABEL[t]))}.`;}
// Every reference to a terrain/theme must be different across the three selected duties.
const GOAL_POOL=[
 {id:'water-homes',name:'Waterside homes',description:'Village squares beside water.',subject:'village',near:'water',themes:['village','water']},
 {id:'water-fields',name:'Irrigated fields',description:'Farmland squares beside water.',subject:'farm',near:'water',themes:['farm','water']},
 {id:'water-woods',name:'Riverside woods',description:'Forest squares beside water.',subject:'forest',near:'water',themes:['forest','water']},
 {id:'forest-group',name:'A living woodland',description:'Squares in your largest connected forest.',subject:'forest',kind:'largest',themes:['forest']},
 {id:'forest-homes',name:'Woodland homes',description:'Village squares beside forest.',subject:'village',near:'forest',themes:['village','forest']},
 {id:'forest-fields',name:'Sheltered fields',description:'Farmland squares beside forest.',subject:'farm',near:'forest',themes:['farm','forest']},
 {id:'mountain-woods',name:'Mountain woods',description:'Forest squares beside mountains.',subject:'forest',near:'mountain',themes:['forest','mountain']},
 {id:'mountain-homes',name:'Highland homes',description:'Village squares beside mountains.',subject:'village',near:'mountain',themes:['village','mountain']},
 {id:'mountain-water',name:'Mountain springs',description:'Water squares beside mountains.',subject:'water',near:'mountain',themes:['water','mountain']},
 {id:'road-homes',name:'On the road',description:'Village squares beside the fixed road.',subject:'village',near:'road',themes:['village','road']},
 {id:'road-fields',name:'Roadside fields',description:'Farmland squares beside the fixed road.',subject:'farm',near:'road',themes:['farm','road']},
 {id:'road-woods',name:'Roadside woods',description:'Forest squares beside the fixed road.',subject:'forest',near:'road',themes:['forest','road']},
 {id:'edge-homes',name:'Frontier homes',description:'Village squares on the map edge.',subject:'village',kind:'edge',themes:['village','edge']},
 {id:'edge-fields',name:'Frontier fields',description:'Farmland squares on the map edge.',subject:'farm',kind:'edge',themes:['farm','edge']},
 {id:'edge-water',name:'Boundary waters',description:'Water squares on the map edge.',subject:'water',kind:'edge',themes:['water','edge']}
];
function pickGoals(mode){
 const triples=[];for(let a=0;a<GOAL_POOL.length;a++)for(let b=a+1;b<GOAL_POOL.length;b++)for(let c=b+1;c<GOAL_POOL.length;c++){
 const selected=[GOAL_POOL[a],GOAL_POOL[b],GOAL_POOL[c]],themes=selected.flatMap(g=>g.themes);
 if(new Set(themes).size===themes.length)triples.push(selected);
 }
 const [low,high]=mode==='expert'?[4,6]:mode==='standard'?[3,4]:[2,3];
 return shuffle([...triples[Math.floor(random()*triples.length)]]).map(g=>({id:g.id,target:low+Math.floor(random()*(high-low+1))}));
}
function goalValue(goal,board=state.board){
 if(goal.kind==='largest')return largest(goal.subject,board);
 let total=0;board.forEach((row,y)=>row.forEach((type,x)=>{if(type!==goal.subject)return;if(goal.kind==='edge'?(x===0||y===0||x===SIZE-1||y===SIZE-1):neighbors(x,y).some(([a,b])=>board[b][a]===goal.near))total++;}));return total;
}
function shuffle(list){for(let i=list.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;}
function init(seed=4821,mode='standard'){random=rng(seed);const board=Array.from({length:SIZE},()=>Array(SIZE).fill(null));
 // A traversable east–west road, with mountains kept away from it.
 const roadY=3+Math.floor(random()*4);for(let x=0;x<SIZE;x++)board[roadY][x]='road';
 const mountainCount=mode==='expert'?12:mode==='relaxed'?5:8;let placed=0,tries=0;while(placed<mountainCount&&tries++<1000){let x=Math.floor(random()*SIZE),y=Math.floor(random()*SIZE);if(!board[y][x]&&Math.abs(y-roadY)>1){board[y][x]='mountain';placed++;}}
 const basicOrder=shuffle([...TYPES]);const mediumDiagonalTurns=shuffle([4,5,6,7,8,9,10,11]).slice(0,3);
 state={seed,mode,board,basicOrder,mediumDiagonalTurns,plans:makePlans(mode),goals:pickGoals(mode),terrainPoints:0,scoredPlacements:0,mineDrawn:false,turn:0,used:[],last:{},bonus:0,penalty:0,history:[],actions:{passes:0,rotate:0,flip:0,undo:0},turnActions:{rotate:false,flip:false},card:null,finished:false};pending=null;ended=false;draw();render();message('Just place.');}
function save(){state.orientation=orientation;try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){/* Storage may be disabled in private browsers. */}}
function largest(type,board=state.board){let seen=new Set(),max=0;for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const key=x+','+y;if(board[y][x]!==type||seen.has(key))continue;let todo=[[x,y]],n=0;seen.add(key);while(todo.length){const [a,b]=todo.pop();n++;for(const [c,d] of neighbors(a,b)){const k=c+','+d;if(board[d][c]===type&&!seen.has(k)){seen.add(k);todo.push([c,d]);}}}max=Math.max(max,n);}return max;}
function metrics(){
 const tiles=state.board.flat().filter(t=>(TYPES.includes(t)||t==='mine')).length;
 const goals=state.goals.map(g=>goalValue(GOAL_POOL.find(def=>def.id===g.id))),targets=state.goals.map(g=>g.target);
 const rewards=targets.map(t=>({2:8,3:9,4:12,5:15,6:18})[t]);
 // The opening placement contributes to the world but can never award points by itself.
 const goalScore=state.scoredPlacements?goals.reduce((n,v,i)=>n+(v>=targets[i]?rewards[i]:0),0):0;
 const completionBonus=state.scoredPlacements&&goals.every((v,i)=>v>=targets[i])?20:0;
 return {tiles,terrainPoints:state.terrainPoints,goals,targets,rewards,goalScore,completionBonus,total:state.terrainPoints+state.bonus+goalScore+completionBonus-state.penalty};
}
function bonusFor(cells){if(state.card.intro)return 0;if(state.card.special)return state.card.bonusPoints;return cells.reduce((sum,[x,y])=>sum+(neighbors(x,y).some(([a,b])=>state.card.bonusTypes.includes(state.board[b][a]))?state.card.bonusPoints:0),0);}
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function tone(freq=440){if(!soundOn)return;try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=freq;o.connect(g);g.connect(audioCtx.destination);g.gain.setValueAtTime(.05,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.16);o.start();o.stop(audioCtx.currentTime+.16);}catch(e){}}
function place(x,y){if(ended||state.finished)return;const cells=cellsAt(x,y);if(!legal(cells)){message('Use empty squares inside the map. Your current placement can still be moved.',true);tone(160);return;}
 pending={anchor:[x,y],cells,bonus:bonusFor(cells),penalty:rulePenalty(cells)};hover=null;renderBoard();updateButtons();
 const terrain=state.card.intro||state.card.special||pending.penalty>0?0:cells.length;const net=terrain+pending.bonus-pending.penalty;
 message(state.card.intro?'Just place.':state.mode==='relaxed'?`Ready: +${terrain} terrain, +${pending.bonus} bonus, −${pending.penalty} penalty = ${net>=0?'+':''}${net}. Click another square to move, or confirm.`:'Placement ready. Click another square to move, or confirm.',state.mode==='relaxed'&&pending.penalty>0);tone(state.mode==='expert'?520:pending.penalty?300:520);}
function confirm(){if(!pending||state.finished)return;for(const [x,y] of pending.cells)state.board[y][x]=state.card.type;if(!state.card.intro){state.terrainPoints+=state.card.special||pending.penalty>0?0:pending.cells.length;state.scoredPlacements++;}state.bonus+=pending.bonus;state.penalty+=pending.penalty;state.history.push({turn:state.turn,card:state.card.id,type:state.card.type,cells:pending.cells,bonus:pending.bonus,penalty:pending.penalty,terrain:state.card.intro||state.card.special||pending.penalty>0?0:pending.cells.length});pending=null;tone(700);advance();}
function advance(){state.turn++;if(state.turn>=TOTAL){state.finished=true;ended=true;save();render();results();return;}draw();render();if(state.finished){results();return;}message(state.rescue?'Space is tight: a smaller card keeps your expedition moving.':'New discovery. Find its place in the valley.');}
function undo(){if(!pending||state.finished||remaining('undo')<=0)return;state.actions.undo++;pending=null;save();renderBoard();updateButtons();message('Placement undone. Try another square.');}
function transform(flip=false){const action=flip?'flip':'rotate';if(state.finished||!canTransform(action))return;const old=orientation;orientation=normalize(orientation.map(([x,y])=>flip?[-x,y]:[-y,x]));
 if(pending){const [x,y]=pending.anchor;if(!legal(cellsAt(x,y))){orientation=old;message('That rotation overlaps occupied land or leaves the map. Move the piece first.',true);return;}place(x,y);}
 if(!state.turnActions[action]){state.actions[action]++;state.turnActions[action]=true;}save();renderShape();renderBoard();updateButtons();tone(350);}
function renderBoard(){const board=$('board');board.innerHTML='';let preview=hover&&!pending&&!state.finished?cellsAt(...hover):[];const valid=preview.length&&legal(preview);for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const cell=document.createElement('button');cell.type='button';cell.className='cell';cell.setAttribute('role','gridcell');cell.dataset.x=x;cell.dataset.y=y;let t=state.board[y][x];const p=pending?.cells.some(([a,b])=>a===x&&b===y);if(p){t=state.card.type;cell.classList.add(state.mode==='expert'?'expert-placement':'pending');if(pending.penalty&&state.mode!=='expert')cell.classList.add('costly');}if(preview.some(([a,b])=>a===x&&b===y)){cell.classList.add(state.mode==='expert'?'expert-placement':'preview');if(!valid)cell.classList.add('invalid');else if(state.mode!=='expert'&&rulePenalty(preview))cell.classList.add('costly');if(!t)t=state.card.type;}
 cell.setAttribute('aria-label',`${String.fromCharCode(65+x)}${y+1}: ${t?LABEL[t]:'empty'}`);if(t){const img=document.createElement('img');img.src=asset(t);img.alt='';cell.append(img);}board.append(cell);}}
function renderShape(){const w=Math.max(...orientation.map(c=>c[0]))+1,h=Math.max(...orientation.map(c=>c[1]))+1;$('shape').style.gridTemplateColumns=`repeat(${w},17px)`;$('shape').innerHTML='';for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=document.createElement('i');if(orientation.some(([a,b])=>a===x&&b===y)){i.className='filled';i.innerHTML=`<img src="${asset(state.card.type)}" alt="">`;}$('shape').append(i);}}
function updateButtons(){
 $('confirm').disabled=!pending||state.finished;$('undo').disabled=!pending||state.finished||remaining('undo')<=0;
 for(const [action,label,key] of [['rotate','↻ Rotate','R'],['flip','⇄ Flip','F'],['undo','↶ Undo','S']]){
 const left=remaining(action);const allowance=left===Infinity?'Unlimited':action==='undo'?`${left} uses left`:`${left} rounds left${state.turnActions[action]?' · Active this round':''}`;
 $(action).innerHTML=`${label} <kbd>${key}</kbd><small class="action-allowance">${allowance}</small>`;
 if(action!=='undo')$(action).disabled=state.finished||!canTransform(action);
 }
 const left=remaining('passes');$('skip').disabled=state.card.intro||!!pending||state.finished||left<=0;
 $('skip').innerHTML=state.card.intro?'Place the first card':`Pass this card <span>${left===Infinity?'Free · Unlimited':`−${modeRules().passCost} points · ${left} passes left`}</span>`;
 $('giveUp').disabled=state.finished;
}
function render(){const t=Math.min(state.turn,TOTAL-1),tier=tierAt(t),m=metrics();$('round').textContent=String(state.finished?state.turn:t+1).padStart(2,'0');$('phaseLabel').textContent=['I · SETTLE','II · GROW','III · THRIVE'][tier];$('phaseText').textContent=state.mode==='relaxed'?'RELAX':state.mode.toUpperCase();$('difficulty').textContent=state.card.special?'SPECIAL':['BASIC','MEDIUM','HARD'][tier];document.querySelector('.discovery').dataset.tier=['basic','medium','hard'][tier];document.querySelector('.discovery').dataset.special=state.card.special?'mine':'';$('progress').innerHTML=Array.from({length:TOTAL},(_,i)=>`<i class="${i<state.turn?'done':i===state.turn?'current':''}"></i>`).join('');$('cardArt').innerHTML=`<img src="${state.card.special?CONFIG.specialCard:CONFIG.cards[["basic","medium","hard"][tier]][state.card.type]}" alt="Pixel art ${LABEL[state.card.type].toLowerCase()} landscape">`;$('cardType').textContent=LABEL[state.card.type].toUpperCase();$('cardTitle').textContent=state.card.title;$('cardStory').textContent=STORIES[state.card.type];$('placement').textContent=placementText(state.card);document.querySelector('.bonus').hidden=state.card.intro;$('pieceCount').textContent=`${orientation.length} SQUARES · PLACE AS ONE PIECE`;$('bonus').textContent=bonusText(state.card);$('score').textContent=m.total;$('allDutiesBonus').classList.toggle('complete',m.completionBonus===20);$('allDutiesStatus').textContent=m.completionBonus===20?'All duties completed':'In progress';
 const selected=state.goals.map(g=>GOAL_POOL.find(def=>def.id===g.id));const names=selected.map(g=>g.name),desc=selected.map(g=>g.description);$('goals').innerHTML=m.goals.map((v,i)=>`<div class="goal ${v>=m.targets[i]?'complete':''}"><div class="goalheader"><b>${names[i]}</b><span>${Math.min(v,m.targets[i])}/${m.targets[i]}</span></div><p>${desc[i]} <b>+${m.rewards[i]}</b></p><div class="goaltrack"><i style="width:${Math.min(100,v/m.targets[i]*100)}%"></i></div></div>`).join('');renderShape();renderBoard();updateButtons();}
function modal(html){$('dialog').dataset.kind='';$('dialogContent').innerHTML=html;if(!$('dialog').open)$('dialog').showModal();}
function giveUp(){if(state.finished)return;document.body.classList.add('giveup-open');modal(`<p class="eyebrow">GIVE UP</p><h2>Are you sure?</h2><p>Giving up ends this game. Only confirmed placements count toward your score.</p><div class="giveup-actions"><button class="primary danger" id="confirmGiveUp">Yes, give up</button><button class="primary cancel" id="cancelGiveUp">No, cancel</button></div>`);$('confirmGiveUp').onclick=()=>{pending=null;hover=null;state.finished=true;state.gaveUp=true;ended=true;document.body.classList.remove('giveup-open');save();render();results();};$('cancelGiveUp').onclick=()=>{$('dialog').close();document.body.classList.remove('giveup-open');};}
$('giveUp').onclick=giveUp;
function help(){modal(`<h2>How to play</h2><p>Build your town on a 10 × 10 grid over 16 rounds. Each round brings a random terrain card whose difficulty and scoring conditions change as the game progresses. Every new game gives you a different starting map.</p><p>There are four main terrain types: village, farmland, forest and water. The map also contains fixed mountains and a road that cannot be moved. Their positions change between games; the number of mountains depends on the selected mode. Fit your terrain pieces into the empty squares and aim for the highest score.</p><h3>Cards</h3><p>Rounds 1–4 bring basic cards, with one card of each terrain type and small pieces. The first card only asks you to place: it gives no points or penalties. The other basic cards offer a fixed +5 bonus per qualifying square and a random penalty of −2, −3 or −4.</p><p>Rounds 5–12 bring medium cards. More varied shapes fill the map as you develop your strategy. Their bonus is +3–5 per qualifying square and their placement penalty is −4–6. The final 4 rounds bring hard cards, with larger or more complex pieces, a +4–6 bonus per qualifying square and a −8–10 penalty. Placement conditions can also become more demanding. Use these final moves to complete your strategy and your town.</p><p>After the first card, each square in a normal terrain piece earns 1 point only if the placement breaks no card condition. If a condition is broken, the piece earns no points for its square count and the printed penalty is deducted once. Any separately earned field bonus still applies. Each qualifying new square earns its bonus once, even if it touches several suitable neighbors. Read both the placement conditions and the bonus conditions on each card.</p><h3>Town duties</h3><p>Each game selects three duties with different themes from a pool of 15. Each duty asks you to reach a target number of qualifying squares. Higher difficulties bring larger targets and higher rewards. Completing all three duties earns an extra 20 points.</p><h3>Controls</h3><p>Preview your terrain piece before confirming it. Rotate it with R or mirror it with F to fit the empty spaces on the map. On a phone, tap a square to see the placement and use the on-screen buttons. Before confirming, you can click another square to move the piece or use Undo (S) to clear the pending placement. When you are satisfied, confirm to finish the round and draw the next card. Confirmed placements cannot be moved or undone.</p><p>Breaking a card condition costs points but never blocks placement. Occupied squares and positions outside the map cannot be used. In Expert mode, green shows that a piece fits and red shows that it cannot be placed. Penalties do not change the preview to orange.</p><p>You can pass an unwanted card. The number of passes and their point cost depend on the mode. If you want to end the game, use Give up and confirm your choice. Your final score includes only confirmed placements.</p><h3>Mode rules</h3><p>Relax: passes are free and unlimited. Rotation, flip and undo are unlimited.</p><p>Standard: 3 passes, each costing 5 points. Rotation and flip can each be used on 5 rounds. Undo can be used 6 times in total.</p><p>Expert: 1 pass costing 8 points. Rotation and flip can each be used on 3 rounds. Undo can be used 4 times in total.</p><p>Rotation and flip allowances count rounds, not clicks. Once you use an action in a round, you can repeat that action freely for the rest of that round. In Standard and Expert, every undo uses one allowance. Undo does not restore rotation or flip allowances. The counters beside the controls show your remaining allowances.</p><p>Only squares that share an edge count as neighbors. Diagonal contact gives no adjacency bonus and does not connect terrain groups.</p><p>There are eastereggs in the game.</p><button class="primary" onclick="document.getElementById('dialog').close()">Let’s make a map →</button>`);}
function settings(){if($('dialog').open)$('dialog').close();window.TownxelMenus?.show('start');}
function results(){const m=metrics(),count=m.goals.filter((v,i)=>v>=m.targets[i]).length;modal(`<p class="eyebrow">${state.gaveUp?"EXPEDITION ENDED":"EXPEDITION COMPLETE"} · ${state.mode.toUpperCase()}</p><h2>${count===3?'A valley in harmony.':count?'A world taking shape.':'Every map is a beginning.'}</h2><p>${state.gaveUp?`You ended your expedition after ${state.turn} confirmed rounds.`:"Sixteen discoveries. One little world that is entirely yours."}</p><div class="resultnum">${m.total}<small style="font:14px Arial"> points</small></div><div class="resultgrid"><div>Terrain points<b>${m.terrainPoints}</b></div><div>Field bonuses<b>+${state.bonus}</b></div><div>Completed goals<b>${count}/3 (+${m.goalScore})</b></div><div>All duties bonus<b>+${m.completionBonus}</b></div><div>Penalties (cards + passes)<b>−${state.penalty}</b></div></div><button class="primary" id="resultNew">Explore another valley →</button>`);$('dialog').dataset.kind='results';$('resultNew').onclick=settings;}
$('board').addEventListener('pointermove',e=>{if(e.pointerType==='touch'||pending||state.finished)return;const c=e.target.closest('.cell');if(!c)return;const x=+c.dataset.x,y=+c.dataset.y;if(hover&&hover[0]===x&&hover[1]===y)return;hover=[x,y];renderBoard();});
$('board').addEventListener('pointerleave',()=>{hover=null;renderBoard();});
$('board').addEventListener('click',e=>{const c=e.target.closest('.cell');if(c)place(+c.dataset.x,+c.dataset.y);});
$('rotate').onclick=()=>transform();$('flip').onclick=()=>transform(true);$('confirm').onclick=confirm;$('undo').onclick=undo;$('help').onclick=help;$('new').onclick=e=>{e.preventDefault();settings();};
$('skip').onclick=()=>{if(state.card.intro||pending||state.finished)return;if(remaining('passes')<=0)return;state.actions.passes++;state.penalty+=modeRules().passCost;state.history.push({turn:state.turn,card:state.card.id,skipped:true});advance();};

$('closeDialog').onclick=()=>$('dialog').close();$('dialog').addEventListener('close',()=>document.body.classList.remove('giveup-open'));$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const b=$('dialog').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom){const isResults=$('dialog').dataset.kind==='results';$('dialog').close();if(isResults)window.TownxelMenus?.show('home');}}});
document.addEventListener('keydown',e=>{if(document.body.dataset?.screen&&document.body.dataset.screen!=='game')return;if(e.ctrlKey||e.metaKey||e.altKey||$('dialog').open||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key.toLowerCase()==='r')transform();if(e.key.toLowerCase()==='f')transform(true);if(e.key.toLowerCase()==='s'||e.key==='Escape'){e.preventDefault();undo();}if(e.key==='Enter'&&e.target===document.body)confirm();});
$('columns').innerHTML=Array.from({length:SIZE},(_,i)=>`<span>${String.fromCharCode(65+i)}</span>`).join('');$('rows').innerHTML=Array.from({length:SIZE},(_,i)=>`<span>${i+1}</span>`).join('');$('legend').innerHTML=Object.entries(LABEL).filter(([type])=>type!=='mine').map(([t,n])=>`<span><img src="${asset(t)}" alt="">${n}</span>`).join('');
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&saved.board?.length===SIZE&&saved.card&&Number.isInteger(saved.turn)&&saved.turn<=TOTAL){state=saved;random=rng(state.seed+state.turn*7919);orientation=(state.orientation||state.card.shape).map(c=>[...c]);ended=state.finished;render();message(state.finished?'Your expedition has ended. Click the logo to choose a new difficulty.':state.card.intro?'Just place.':'Welcome back. Your last confirmed round has been restored.');}else init();}catch(e){init();}
// Small read-only-friendly test surface; no external dependencies.
window.Townxel={init,legal,variants,metrics,largest,canPlace,place,confirm,advance,undo,draw,bonusFor,rulePenalty,SHAPE_POOLS,DECK,GOAL_POOL,goalValue,placementText,bonusText,playableVariants,giveUp,help,modal,get state(){return state;},get pending(){return pending;},get orientation(){return orientation;}};

/*
15 GÖREVLİK HAVUZ
1. Su kenarında evler — Suya komşu köy kareleri.
2. Sulanan tarlalar — Suya komşu tarla kareleri.
3. Su kenarında orman — Suya komşu orman kareleri.
4. Yaşayan bir orman — En büyük kenardan bağlı ormandaki kareler.
5. Orman evleri — Ormana komşu köy kareleri.
6. Korunaklı tarlalar — Ormana komşu tarla kareleri.
7. Dağ ormanı — Dağa komşu orman kareleri.
8. Dağ evleri — Dağa komşu köy kareleri.
9. Dağ suları — Dağa komşu su kareleri.
10. Yol kenarında köyler — Sabit yola komşu köy kareleri.
11. Yol kenarında tarlalar — Sabit yola komşu tarla kareleri.
12. Yol kenarında orman — Sabit yola komşu orman kareleri.
13. Sınır köyleri — Harita kenarındaki köy kareleri.
14. Sınır tarlaları — Harita kenarındaki tarla kareleri.
15. Sınır suları — Harita kenarındaki su kareleri.
*/
