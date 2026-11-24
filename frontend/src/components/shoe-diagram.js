// Top view for the three fields a fitter records before routing a return.
export function paintShoe(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.strokeStyle = '#f1bb98';
  ctx.fillStyle = '#f1bb98';
  ctx.lineWidth = 1.4;
  const sole = new Path2D('M157 334 C121 329 105 294 113 250 C121 206 108 177 102 151 C87 86 116 37 169 32 C227 25 267 70 254 126 C247 160 216 199 219 242 C221 287 212 330 180 337 Z');
  ctx.stroke(sole);
  ctx.save();
  ctx.clip(sole);
  ctx.globalAlpha = .27;
  for (let i = -65; i < 210; i += 9) {
    ctx.beginPath();
    ctx.moveTo(99, i);
    ctx.lineTo(258, i + 132);
    ctx.stroke();
  }
  ctx.restore();
  ctx.setLineDash([4, 5]);
  ctx.stroke(new Path2D('M157 323 C128 316 121 288 126 250 C132 204 122 161 115 135 C105 89 128 47 171 45 C217 41 250 80 241 123 C234 156 203 197 205 244 C208 290 204 323 178 326 Z'));
  ctx.stroke(new Path2D('M96 150 H265 M110 239 H221 M177 21 V348'));
  ctx.setLineDash([]);
  ctx.lineWidth = 2.5;
  ctx.stroke(new Path2D('M250 141 C244 165 227 184 222 208'));
  ctx.lineWidth = 1;
  ctx.stroke(new Path2D('M170 91 L81 82 H27 M241 173 H323 M156 277 L83 294 H27'));
  for (const [x, y] of [[170,91], [241,173], [156,277]]) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = '12px sans-serif';
  ctx.fillText('磨损率 %', 27, 73);
  ctx.fillText('开胶 mm', 272, 161);
  ctx.fillText('鞋底状态', 27, 312);
}
