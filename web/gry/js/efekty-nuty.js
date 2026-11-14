// RibbitBeat: style taśm nut zależne od stopnia klawiszy (10-05). Pierwszy i na razie jedyny: „Upiorna noc” (stopień
// klawiszy id "upiorna", efekty-klawisze.js). Jak platformy w Icy Tower, które co setkę pięter zmieniają materiał,
// taśmy nut zmieniają materiał wraz z postępem piosenki: pięć „pięter” (cmentarz, kości, dynie, pajęczyna, ektoplazma),
// granica zawsze na kresce taktowej, a na granicy stoi tabliczka z nazwą nowego piętra. Kształt taśmy, główki, pasek
// partii i wypełnienie celnością zostają z gry (czytelność śpiewu), styl zmienia tylko ciało taśmy i dodatki wokół niej.
//
// Kontrakt (czyta zabi-chor.js przez `typeof EfektyNuty`): EfektyNuty.dla(idKlawiszy) → styl albo null.
//   styl.granice(koniec, metrum) → beaty granic pięter (rosnąco, bez zera),
//   styl.epoka(t, granice) → numer piętra nuty zaczynającej się w beacie t,
//   styl.cialo(c, w, nh, o)  ciało taśmy: ścieżka taśmy jest już przycięciem (clip), środek w (0,0); o = {ep, ziarno, minela}
//   styl.poza(c, w, nh, o)   dodatki poza obrysem (bez przycięcia: krople, pająk, pnącze, kostne guzki), może być pominięte
//   styl.brzeg(ep) → kolor obrysu taśmy,  styl.zapas(nh) → ile px dodatki wystają pod/nad taśmą (bitmapy nut),
//   styl.znak(c, x, y, f, ep) tabliczka piętra przy kresce taktowej (x, y = środek górnej krawędzi, f = skala R.f).
// Bez filter/shadowBlur, wszystko deterministyczne z `ziarno` (numer nuty), więc bitmapa nuty jest stała.
const EfektyNuty=(function(){
  "use strict";
  const TUSZ="#211f1d",PAPIER="#faf6ee";
  const EPOKI=[
    {id:"cmentarz",nazwa:"Cmentarz",cialo:"#8f8b84",brzeg:"#5e5a54"},
    {id:"kosci",nazwa:"Kości",cialo:"#efe6d2",brzeg:"#a99a78"},
    {id:"dynie",nazwa:"Dynie",cialo:"#f07a1e",brzeg:"#9c4510"},
    {id:"pajeczyna",nazwa:"Pajęczyna",cialo:"#3d2a5e",brzeg:TUSZ},
    {id:"ektoplazma",nazwa:"Ektoplazma",cialo:"#9ed65a",brzeg:"#4f8a22"}];
  const los=(z,k)=>{const x=Math.sin(z*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};   // 0..1, stałe dla nuty

  // Granice pięter: równe części piosenki, zaokrąglone do pełnego taktu (tabliczka stoi na kresce taktowej).
  function granice(koniec,metrum){
    const m=Math.max(1,+metrum||4),k=Math.max(m,+koniec||0),out=[];
    for(let i=1;i<EPOKI.length;i++){const b=Math.round(k*i/EPOKI.length/m)*m;if(b>0&&(!out.length||b>out[out.length-1]))out.push(b);}
    return out;
  }
  function epoka(t,gr){let e=0;for(const b of gr||[])if(t>=b-1e-6)e++;return Math.min(EPOKI.length-1,e);}

  function cialo(c,w,nh,o){
    const ep=EPOKI[o.ep]||EPOKI[0],z=o.ziarno|0,x0=-w/2,x1=w/2,y0=-nh/2;
    c.fillStyle=ep.cialo;c.fillRect(x0-2,y0-2,w+4,nh+4);
    if(ep.id==="cmentarz"){   // kamień: plamki, rysa zygzakiem, mech nad paskiem partii, krzyżyk wyryty na długiej nucie
      c.fillStyle="rgba(60,56,50,.28)";
      for(let k=0;k<Math.max(3,w/14);k++)c.fillRect(x0+los(z,k)*w,y0+los(z,k+40)*nh*.7,1.6,1.6);
      c.strokeStyle="#5e5a54";c.lineWidth=1;c.beginPath();
      let x=x0+w*(.35+.4*los(z,1)),y=y0;c.moveTo(x,y);
      for(let k=0;k<4;k++){x+=(los(z,k+5)-.5)*nh*.5;y+=nh*.17;c.lineTo(x,y);}
      c.stroke();
      c.fillStyle="rgba(108,143,58,.55)";c.beginPath();c.moveTo(x0,nh*.2);
      for(let xx=x0;xx<=x1;xx+=nh*.35)c.lineTo(xx,nh*.2-nh*.12*los(z,xx|0));
      c.lineTo(x1,nh/2);c.lineTo(x0,nh/2);c.closePath();c.fill();
      if(w>nh*4){const cx=x0+nh*1.4,cy=-nh*.06,s=nh*.24;c.strokeStyle="rgba(60,56,50,.7)";c.lineWidth=1.5;
        c.beginPath();c.moveTo(cx,cy-s);c.lineTo(cx,cy+s);c.moveTo(cx-s*.6,cy-s*.35);c.lineTo(cx+s*.6,cy-s*.35);c.stroke();}
    }else if(ep.id==="kosci"){   // kość: cień od dołu, połysk u góry, włoskowate pęknięcia
      const g=c.createLinearGradient(0,y0,0,nh/2);g.addColorStop(0,"#fbf6ea");g.addColorStop(.6,ep.cialo);g.addColorStop(1,"#cdbf9f");
      c.fillStyle=g;c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.strokeStyle="rgba(150,130,95,.55)";c.lineWidth=.8;c.beginPath();
      for(let k=0;k<Math.max(1,w/60);k++){const xa=x0+w*los(z,k+9);c.moveTo(xa,y0+nh*.15);c.lineTo(xa+nh*.25,y0+nh*.4);c.lineTo(xa+nh*.1,y0+nh*.6);}
      c.stroke();
    }else if(ep.id==="dynie"){   // skórka dyni: żebra łukami co ok. jedną wysokość taśmy, jaśniejszy szczyt
      c.fillStyle="#ffb067";c.globalAlpha=.55;c.fillRect(x0,y0,w,nh*.22);c.globalAlpha=1;
      c.strokeStyle="rgba(156,69,16,.75)";c.lineWidth=1.3;c.beginPath();
      const krok=Math.max(8,nh*.9);
      for(let xx=x0+krok*.7;xx<x1-2;xx+=krok){c.moveTo(xx,y0);c.quadraticCurveTo(xx+krok*.22,0,xx,nh/2);}
      c.stroke();
    }else if(ep.id==="pajeczyna"){   // pajęczyna w prawym górnym rogu: promienie i trzy nitki poprzeczne
      const cx=x1-2,cy=y0+1,R=Math.min(w*.8,nh*2.6),n=5;
      c.strokeStyle="rgba(250,246,238,.6)";c.lineWidth=.8;c.beginPath();
      const kat=k=>Math.PI*(.5+.5*k/(n-1));
      for(let k=0;k<n;k++){c.moveTo(cx,cy);c.lineTo(cx+Math.cos(kat(k))*R,cy+Math.sin(kat(k))*R);}
      for(const f of [.3,.58,.86]){c.moveTo(cx+Math.cos(kat(0))*R*f,cy+Math.sin(kat(0))*R*f);
        for(let k=1;k<n;k++)c.quadraticCurveTo(cx+Math.cos((kat(k)+kat(k-1))/2)*R*f*.88,cy+Math.sin((kat(k)+kat(k-1))/2)*R*f*.88,cx+Math.cos(kat(k))*R*f,cy+Math.sin(kat(k))*R*f);}
      c.stroke();
      if(w>nh*3){c.strokeStyle="rgba(250,246,238,.35)";c.beginPath();c.moveTo(x0+nh,y0);c.lineTo(x0+nh*2.2,nh*.1);c.stroke();}
    }else{   // ektoplazma: przelewa się od jasnej góry do gęstego dołu, pęcherzyki
      const g=c.createLinearGradient(0,y0,0,nh/2);g.addColorStop(0,"#d6f7a8");g.addColorStop(1,"#6fae32");
      c.fillStyle=g;c.fillRect(x0-2,y0-2,w+4,nh+4);
      c.strokeStyle="rgba(250,246,238,.75)";c.lineWidth=1;
      for(let k=0;k<Math.max(2,w/22);k++){const r=nh*(.08+.1*los(z,k+3));c.beginPath();c.arc(x0+w*los(z,k+20),y0+nh*(.25+.4*los(z,k+30)),r,0,Math.PI*2);c.stroke();}
    }
  }
  function poza(c,w,nh,o){
    const ep=EPOKI[o.ep]||EPOKI[0],z=o.ziarno|0,x0=-w/2,x1=w/2;
    if(ep.id==="kosci"){   // guzki stawowe przy obu końcach: z taśmy robi się kość
      c.fillStyle=ep.cialo;c.strokeStyle=ep.brzeg;c.lineWidth=1.2;
      for(const x of [x0+nh*.4,x1-nh*.4])for(const s of [-1,1]){c.beginPath();c.arc(x,s*nh*.46,nh*.36,0,Math.PI*2);c.fill();c.stroke();}
    }else if(ep.id==="dynie"&&w>nh*2){   // pnącze z listkiem nad lewym końcem
      const x=x0+nh*1.1,y=-nh/2;
      c.strokeStyle="#3f7a2a";c.lineWidth=2;c.lineCap="round";c.beginPath();c.moveTo(x,y);
      c.bezierCurveTo(x+nh*.2,y-nh*.5,x+nh*.9,y-nh*.45,x+nh*.7,y-nh*.15);c.stroke();
      c.fillStyle="#6cb33f";c.strokeStyle=TUSZ;c.lineWidth=1;c.beginPath();
      c.ellipse(x-nh*.3,y-nh*.2,nh*.3,nh*.14,-.5,0,Math.PI*2);c.fill();c.stroke();
    }else if(ep.id==="pajeczyna"&&w>nh*4){   // pająk na nitce pod środkiem długiej nuty
      const x=x0+w*(.4+.3*los(z,2)),y=nh/2,dl=nh*(.6+.4*los(z,4)),r=Math.max(2.5,nh*.17);
      c.strokeStyle="rgba(250,246,238,.8)";c.lineWidth=.8;c.beginPath();c.moveTo(x,y);c.lineTo(x,y+dl);c.stroke();
      c.strokeStyle=TUSZ;c.lineWidth=1;c.beginPath();
      for(const s of [-1,1])for(let k=0;k<4;k++){const a=(k-1.5)*.45;c.moveTo(x,y+dl+r);c.quadraticCurveTo(x+s*r*1.6,y+dl+r+a*r*2-r,x+s*r*2.2,y+dl+r+a*r*2.6);}
      c.stroke();c.fillStyle=TUSZ;c.beginPath();c.arc(x,y+dl+r,r,0,Math.PI*2);c.fill();
      c.fillStyle="#ec1a83";c.fillRect(x-r*.45,y+dl+r*.6,r*.3,r*.3);c.fillRect(x+r*.15,y+dl+r*.6,r*.3,r*.3);
    }else if(ep.id==="ektoplazma"){   // krople zwisające spod taśmy
      c.fillStyle="#7fbf3a";
      for(let k=0;k<Math.max(1,Math.min(4,Math.floor(w/40)));k++){
        const x=x0+w*(.15+.7*los(z,k+50)),h=nh*(.3+.45*los(z,k+60)),r=Math.max(1.6,nh*.11);
        c.beginPath();c.moveTo(x-r*1.4,nh/2-1);c.quadraticCurveTo(x-r,nh/2+h*.6,x,nh/2+h);c.quadraticCurveTo(x+r,nh/2+h*.6,x+r*1.4,nh/2-1);c.closePath();c.fill();
        c.beginPath();c.arc(x,nh/2+h-r*.2,r,0,Math.PI*2);c.fill();
      }
    }
  }
  const brzeg=ep=>(EPOKI[ep]||EPOKI[0]).brzeg;
  const zapas=nh=>Math.ceil(nh*1.9);
  // Tabliczka piętra: deska na dwóch sznurkach przy kresce taktowej, z nazwą piętra kremem na brązie.
  function znak(c,x,y,f,ep){
    const e=EPOKI[ep]||EPOKI[0],fs=Math.round(11*(f||1));
    c.save();c.font="400 "+fs+"px 'Titan One','Baloo 2',sans-serif";
    const tw=c.measureText(e.nazwa).width,bw=tw+fs*1.4,bh=fs*1.7,by=y+fs*.9;
    c.strokeStyle=TUSZ;c.lineWidth=1.2;c.beginPath();c.moveTo(x-bw*.3,y);c.lineTo(x-bw*.3,by);c.moveTo(x+bw*.3,y);c.lineTo(x+bw*.3,by);c.stroke();
    c.fillStyle="rgba(120,90,40,.3)";c.beginPath();c.roundRect(x-bw/2+2,by+3,bw,bh,4);c.fill();
    c.fillStyle="#6b4a2e";c.beginPath();c.roundRect(x-bw/2,by,bw,bh,4);c.fill();c.lineWidth=1.6;c.stroke();
    c.fillStyle=e.id==="ektoplazma"?"#a6d861":e.id==="dynie"?"#ff9a3c":PAPIER;c.textAlign="center";c.textBaseline="middle";
    c.fillText(e.nazwa,x,by+bh/2+1);
    c.restore();
  }
  const UPIORNA={id:"upiorna",EPOKI,granice,epoka,cialo,poza,brzeg,zapas,znak};
  return {EPOKI,dla:id=>id==="upiorna"?UPIORNA:null};
})();
