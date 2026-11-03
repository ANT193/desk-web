// Hand-drawn canvas line chart, DPR aware. No chart library (STEP 3).
function drawLine(cv, pts){
  const dpr=window.devicePixelRatio||1, w=cv.clientWidth, h=cv.clientHeight||220;
  cv.width=w*dpr; cv.height=h*dpr; const g=cv.getContext('2d'); g.scale(dpr,dpr); g.clearRect(0,0,w,h);
  if(!pts||pts.length<2) return;
  const ys=pts.map(p=>p[1]), lo=Math.min(...ys), hi=Math.max(...ys)||1, r=(hi-lo)||1;
  g.strokeStyle=ys[ys.length-1]>=ys[0]?'#00d35a':'#ff453a'; g.lineWidth=2; g.beginPath();
  pts.forEach((p,i)=>{const x=i/(pts.length-1)*w, y=h-8-(p[1]-lo)/r*(h-16); i?g.lineTo(x,y):g.moveTo(x,y)}); g.stroke();
}
