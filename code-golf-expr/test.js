const {evalExpr}=require('./solution.js');
const pub=JSON.parse(require('fs').readFileSync('/home/hatch/workspace/aiprove-agent/aiprove/challenges/code-golf-expr/cases.json','utf8'));
const hidden=[
 [" 1 + 2 * 3 ",7],["-3+5",2],["2*-3",-6],["(-2)",-2],["-(2+3)",-5],["--5",5],["+5",5],
 ["10/2/5",1],["20-5-3",12],["100/10/2",5],["2-3-4",-5],
 ["((((1+2))))",3],["2*(3+(4-1))",12],["((2+3)*(4-1))/5",3],
 [".5+.5",1],["5.",5],[".5*2",1],["0.1+0.2",0.30000000000000004],
 ["100",100],["0",0],["  42  ",42],["3.5+1.5",5],["10/4",2.5],
 ["1/0",Infinity],["-1/0",-Infinity],["0/0",NaN],
 ["1+2+3+4+5",15],["2*3/4",1.5],["(1)",1],["-(-(-2))",-2],["2--3",5],["2+-3",-1],
 ["123456789*0",0],["1.5*2",3],["10-2*3",4],["(10-2)*3",24],["  ( 1 + 2 ) * 3  ",9],
 ["2*(3+4*(5-2))",30],["1+2*3-4/2",5],["9/3*2",6],["9/(3*2)",1.5],
];
let fail=0;
const check=(arr,label)=>{for(const [inp,exp] of arr){let got;try{got=evalExpr(inp)}catch(e){got='THREW:'+e.message}
 const ok=(Number.isNaN(exp)&&Number.isNaN(got))||got===exp;
 if(!ok){fail++;console.log(`FAIL [${label}] ${JSON.stringify(inp)} => got ${got}, want ${exp}`)}}};
check(pub.map(c=>[c.in,c.out]),'public');
check(hidden,'hidden-style');
console.log(fail===0?`ALL PASS (${pub.length} public + ${hidden.length} hidden-style)`:`${fail} FAILURES`);
process.exit(fail?1:0);
