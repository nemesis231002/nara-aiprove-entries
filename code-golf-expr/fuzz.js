// Fuzz: random expressions vs JS eval (eval used ONLY here, in the test harness).
const {evalExpr}=require('./solution.js');
const R=Math.random, pick=a=>a[Math.floor(R()*a.length)];
const num=()=>pick(['0','1','2','3','7','10','2.5','.5','5.','0.1','100','3.5']);
function expr(d){ if(d<=0) return Math.random()<0.2?'-'+num():num();
  const k=Math.floor(R()*5);
  if(k===0) return '('+expr(d-1)+')';
  if(k===1) return '-'+expr(d-1);
  if(k===2) return '('+expr(d-1)+')';
  const a=expr(d-1), b=expr(d-1), op=pick(['+','-','*','/']);
  const ws=()=>Math.random()<0.3?' ':''; 
  return ws()+a+ws()+op+ws()+b+ws(); }
let bad=0; const N=20000;
for(let i=0;i<N;i++){ const s=expr(4);
  let want; try{ want=eval(s); }catch(e){ continue; }
  if(typeof want!=='number'||!isFinite(want)&&want!==Infinity&&want!==-Infinity) { /* NaN ok too */ }
  const got=evalExpr(s);
  const ok=(Number.isNaN(want)&&Number.isNaN(got))||got===want;
  if(!ok){ bad++; if(bad<=5) console.log('MISMATCH',JSON.stringify(s),'got',got,'want',want); } }
console.log(bad===0?`FUZZ PASS (${N} random exprs)`:`FUZZ ${bad} MISMATCHES`);
process.exit(bad?1:0);
