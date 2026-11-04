// Hand-drawn canvas charts. No library. devicePixelRatio aware.
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function setup(cv){
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w*dpr) || cv.height !== Math.round(h*dpr)) { cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,w,h); return {g,w,h};
}
const Line = {
  prev: new WeakMap(),
  // pts: [[ts,value],...]; start: dashed start value; marks: [{ts,text,color}]
  draw(cv, pts, start, marks){
    const old = this.prev.get(cv); this.prev.set(cv, {pts, start, marks});
    const sameShape = old && old.pts.length === pts.length - 1;
    if (!RM() && sameShape) {          // new point slides in over 250ms, marks fade over 200ms
      const t0 = performance.now(), a = old.pts[old.pts.length-1], b = pts[pts.length-1];
      const step = t => { const k = Math.min(1,(t-t0)/250), e = 1-Math.pow(1-k,3);
        const p = pts.slice(0,-1).concat([[a[0]+(b[0]-a[0])*e, a[1]+(b[1]-a[1])*e]]);
        this.paint(cv, p, start, marks, Math.min(1,(t-t0)/200)); if (k<1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    } else if (!RM() && !old) {
      const t0 = performance.now(); const step = t => { const k=Math.min(1,(t-t0)/200); this.paint(cv, pts, start, marks, k); if (k<1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    } else this.paint(cv, pts, start, marks, 1);
  },
  paint(cv, pts, start, marks, alpha){
    const {g,w,h} = setup(cv), top = 56, bot = 10;
    if (!pts || pts.length < 1) return;
    const xs = pts.map(p=>p[0]), ys = pts.map(p=>p[1]).concat(start!=null?[start]:[]);
    let lo = Math.min(...ys), hi = Math.max(...ys); if (hi-lo < 1e-9) { lo -= 1; hi += 1; }
    const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0+1;
    const X = t => 16 + (x1===x0 ? 0 : (t-x0)/(x1-x0)) * (w-32), Y = v => top + (1-(v-lo)/(hi-lo)) * (h-top-bot);
    if (start != null) { g.save(); g.setLineDash([4,5]); g.strokeStyle='rgba(235,235,245,.3)'; g.lineWidth=1; g.beginPath(); g.moveTo(0,Y(start)); g.lineTo(w,Y(start)); g.stroke(); g.restore(); }
    if (pts.length < 2) return;
    const col = '#00d35a';
    g.beginPath(); pts.forEach((p,i)=> i ? g.lineTo(X(p[0]),Y(p[1])) : g.moveTo(X(p[0]),Y(p[1])));
    const line = new Path2D(); pts.forEach((p,i)=> i ? line.lineTo(X(p[0]),Y(p[1])) : line.moveTo(X(p[0]),Y(p[1])));
    g.lineTo(X(pts[pts.length-1][0]), h); g.lineTo(X(pts[0][0]), h); g.closePath();
    const gr = g.createLinearGradient(0,top,0,h); gr.addColorStop(0,'rgba(0,211,90,.28)'); gr.addColorStop(1,'rgba(0,211,90,0)');
    g.fillStyle = gr; g.fill(); g.strokeStyle = col; g.lineWidth = 2; g.lineJoin='round'; g.stroke(line);
    // marks above the line; never overlap: a later mark moves up a row
    g.globalAlpha = alpha; g.font = '600 12px -apple-system,system-ui'; const rows = [];
    (marks||[]).filter(m=>m.ts>=x0 && m.ts<=x1).forEach(m=>{
      const tw = g.measureText(m.text).width + 14, cx = Math.max(tw/2+2, Math.min(w-tw/2-2, X(m.ts)));
      let r = 0; while ((rows[r]||[]).some(s => Math.abs(s - cx) < tw)) r++; (rows[r] = rows[r] || []).push(cx);
      const yLine = Y(valAt(pts, m.ts)), y = Math.max(4, yLine - 30 - r*24);
      g.fillStyle = m.color; g.beginPath(); g.roundRect ? g.roundRect(cx-tw/2, y, tw, 20, 10) : g.rect(cx-tw/2,y,tw,20); g.fill();
      g.fillStyle = m.color === '#0a84ff' || m.color === '#ff453a' ? '#fff' : '#000'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(m.text, cx, y+10);
      g.fillStyle = m.color; g.beginPath(); g.arc(X(m.ts), yLine, 3, 0, 7); g.fill();
    });
    g.globalAlpha = 1;
  }
};
function valAt(pts, t){ let v = pts[0][1]; for (const p of pts) { if (p[0] <= t) v = p[1]; } return v; }
const Candles = {
  // candles [{t,o,h,l,c,v}], lines [{price,label,color,dash}]
  draw(cv, cs, lines){
    const {g,w,h} = setup(cv); if (!cs.length) { g.fillStyle='rgba(235,235,245,.3)'; g.font='14px -apple-system'; g.textAlign='center'; g.fillText('No price yet', w/2, h/2); return; }
    const vh = 40, ph = h - vh - 8, n = Math.max(cs.length, 30), cw = (w-32)/n;
    const ps = cs.flatMap(c=>[c.h,c.l]).concat((lines||[]).map(l=>l.price)); let lo=Math.min(...ps), hi=Math.max(...ps); if (hi-lo<1e-12){hi*=1.01;lo*=.99;}
    const pad=(hi-lo)*.08; lo-=pad; hi+=pad; const Y=v=>8+(1-(v-lo)/(hi-lo))*(ph-16), vmax=Math.max(1e-9,...cs.map(c=>c.v||0));
    cs.forEach((c,i)=>{ const x = 16 + (n-cs.length+i)*cw + cw/2, up = c.c >= c.o, col = up ? '#00d35a' : '#ff453a';
      g.strokeStyle=col; g.fillStyle=col; g.lineWidth=1; g.beginPath(); g.moveTo(x,Y(c.h)); g.lineTo(x,Y(c.l)); g.stroke();
      const y1=Y(Math.max(c.o,c.c)), y2=Y(Math.min(c.o,c.c)); g.fillRect(x-cw*.35, y1, cw*.7, Math.max(1,y2-y1));
      const vb=(c.v||0)/vmax*vh; g.globalAlpha=.45; g.fillRect(x-cw*.35, h-vb, cw*.7, vb); g.globalAlpha=1; });
    (lines||[]).forEach(l=>{ const y=Y(l.price); g.save(); if(l.dash) g.setLineDash([6,5]); g.strokeStyle=l.color; g.lineWidth=1.5; g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); g.restore();
      g.fillStyle=l.color; g.font='600 11px -apple-system'; g.textAlign='left'; g.fillText(l.label, 18, y-5); });
  }
};
window.DeskChart = {Line, Candles};
