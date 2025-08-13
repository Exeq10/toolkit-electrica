// app.js - Lógica de la calculadora para electricistas

// Helpers
const $ = (id) => document.getElementById(id);
const out = (id, txt) => { $(id).textContent = txt; };

// Navegación
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.card').forEach(c => c.classList.remove('visible'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).classList.add('visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

// Limpiar secciones
document.querySelectorAll('button[data-clear]').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = document.getElementById(btn.dataset.clear);
    section.querySelectorAll('input').forEach(i => i.value = '');
    section.querySelectorAll('output').forEach(o => o.textContent = '');
  });
});

// -------- Ley de Ohm --------
$('btnOhm').addEventListener('click', () => {
  const V = parseFloat($('ohmV').value);
  const I = parseFloat($('ohmI').value);
  const R = parseFloat($('ohmR').value);
  let res = [];

  if (!isNaN(V) && !isNaN(I)) res.push(`R = ${(V/I).toFixed(4)} Ω`);
  if (!isNaN(V) && !isNaN(R)) res.push(`I = ${(V/R).toFixed(4)} A`);
  if (!isNaN(I) && !isNaN(R)) res.push(`V = ${(I*R).toFixed(4)} V`);

  if (res.length === 0) res.push('Ingresá dos valores para calcular el tercero.');
  out('outOhm', res.join('\n'));
});

// -------- Potencia --------
// Pmono = V * I * FP
// Ptri = sqrt(3) * Vlinea * I * FP
$('btnPot').addEventListener('click', () => {
  const tipo = $('tipoSistema').value;
  const V = parseFloat($('potV').value);
  const I = parseFloat($('potI').value);
  const FP = parseFloat($('potFP').value || '1');

  if ([V,I,FP].some(isNaN)) return out('outPot', 'Completá V, I y FP.');

  const P = (tipo === 'mono') ? V*I*FP : Math.sqrt(3)*V*I*FP;
  const kW = P/1000;
  out('outPot', `P = ${P.toFixed(2)} W (${kW.toFixed(3)} kW)`);
});

// -------- Caída de Tensión --------
// ΔV_mono = (2 * L * I * ρ) / S
// ΔV_tri  = (sqrt(3) * L * I * ρ) / S  (aprox en redes equilibradas)
function resistividad(material){
  return material === 'Cu' ? 0.0172 : 0.0282; // Ω·mm²/m
}

$('btnCaida').addEventListener('click', () => {
  const tipo = $('caidaTipo').value;
  const L = parseFloat($('caidaL').value);
  const I = parseFloat($('caidaI').value);
  const mat = $('caidaMaterial').value;
  const S = parseFloat($('caidaS').value);
  const Vn = parseFloat($('caidaVn').value || '0');
  const pctAdm = parseFloat($('caidaPct').value || '0');

  if ([L,I,S].some(isNaN)) return out('outCaida','Completá L, I y S.');
  const rho = resistividad(mat);
  const dV = (tipo === 'mono') ? (2*L*I*rho)/S : (Math.sqrt(3)*L*I*rho)/S;
  let msg = `ΔV = ${dV.toFixed(2)} V`;

  if (!isNaN(Vn) && Vn>0){
    const pct = (dV/Vn)*100;
    msg += `\nΔV% = ${pct.toFixed(2)} %`;
    if (!isNaN(pctAdm) && pctAdm>0){
      msg += `\nAdmisible (${pctAdm} %): ${pct <= pctAdm ? '✔ Dentro' : '✖ Excede'}`;
    }
  }
  out('outCaida', msg);
});

// -------- Dimensionamiento de Cable (aprox) --------
// 1) Estimar I a partir de P, V, FP (mono/tri)
// 2) Chequear capacidad por sección (tabla simplificada)
// 3) Verificar caída de tensión y aumentar sección si excede
const tablaCapacidadCu = [
  {s:1.5, I:15}, {s:2.5, I:21}, {s:4, I:28}, {s:6, I:36}, {s:10,I:50},
  {s:16,I:68}, {s:25,I:89}, {s:35,I:110}, {s:50,I:140}, {s:70,I:175},
  {s:95,I:215}, {s:120,I:260}
];
const tablaCapacidadAl = [
  {s:10, I:39}, {s:16, I:52}, {s:25, I:68}, {s:35, I:85}, {s:50, I:105},
  {s:70, I:135}, {s:95, I:165}, {s:120, I:195}, {s:150, I:220}
];

function corrienteDesdePotencia(kW, V, FP, tipo){
  const P = kW*1000;
  if (tipo === 'mono') return P/(V*(FP||1));
  return P/(Math.sqrt(3)*V*(FP||1));
}

function sugerirSeccion(I, L, V, pct, mat, tipo){
  const tabla = mat==='Cu' ? tablaCapacidadCu : tablaCapacidadAl;
  // seleccionar la primera sección cuya I admisible >= I
  for (let i=0; i<tabla.length; i++){
    const s = tabla[i].s;
    const Iadm = tabla[i].I;
    if (Iadm >= I){
      // verificar caída de tensión
      const rho = resistividad(mat);
      const dV = (tipo==='mono') ? (2*L*I*rho)/s : (Math.sqrt(3)*L*I*rho)/s;
      const pctReal = (dV/V)*100;
      if (pctReal <= pct) return {s, Iadm, dV, pctReal};
      // si no cumple, seguir probando secciones mayores
    }
  }
  const last = tabla[tabla.length-1];
  return {s:last.s, Iadm:last.I, dV:NaN, pctReal:NaN};
}

$('btnCable').addEventListener('click', () => {
  const kW = parseFloat($('cabKw').value);
  const V = parseFloat($('cabV').value);
  const tipo = $('cabTipo').value;
  const FP = parseFloat($('cabFP').value || '1');
  const L = parseFloat($('cabL').value || '0');
  const mat = $('cabMat').value;
  const pct = parseFloat($('cabPct').value || '3');

  if ([kW,V].some(isNaN)) return out('outCable','Completá kW y V.');

  const I = corrienteDesdePotencia(kW, V, FP, tipo);
  const sug = sugerirSeccion(I, L, V, pct, mat, tipo);
  let txt = `I estimada = ${I.toFixed(2)} A\n` +
            `Sección sugerida = ${sug.s} mm² (${mat}), I admisible aprox ${sug.Iadm} A`;
  if (!isNaN(sug.pctReal)){
    txt += `\nΔV% estimada = ${sug.pctReal.toFixed(2)} % (L=${L} m)`;
  } else {
    txt += `\nAdvertencia: fuera de tabla, revisar con fabricante/norma.`;
  }
  out('outCable', txt);
});

// -------- Protecciones --------
function proximoTermico(I){
  const estandar = [6,10,13,16,20,25,32,40,50,63,80,100,125,160,200,250];
  for (let a of estandar) if (a >= I) return a;
  return estandar[estandar.length-1];
}

$('btnProt').addEventListener('click', () => {
  const I = parseFloat($('protI').value);
  const curva = $('protCurva').value;
  const ddr = $('protDDR').value;
  if (isNaN(I)) return out('outProt','Ingresá corriente de diseño.');
  const termico = proximoTermico(I*1.25); // margen del 25% aprox.
  out('outProt', `Sugerencia: Interruptor ${termico} A, curva ${curva}.\nDDR: ${ddr} mA.`);
});

// -------- Balance de cargas (partición greedy) --------
$('btnBalance').addEventListener('click', () => {
  const list = $('balCargas').value.split(',').map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n));
  const fases = Math.min(3, Math.max(2, parseInt($('balFases').value)||3));
  if (list.length===0) return out('outBalance','Ingresá al menos una carga.');

  list.sort((a,b)=>b-a);
  const bins = Array.from({length:fases}, ()=>({suma:0, cargas:[]}));
  for (let kw of list){
    bins.sort((a,b)=>a.suma-b.suma);
    bins[0].suma += kw;
    bins[0].cargas.push(kw);
  }
  const totales = bins.map(b=>b.suma);
  const max = Math.max(...totales), min = Math.min(...totales);
  const desb = max - min;

  let txt = '';
  bins.forEach((b,i)=>{
    txt += `Fase ${i+1}: ${b.suma.toFixed(2)} kW -> [${b.cargas.join(', ')}]\n`;
  });
  txt += `Desbalance estimado: ±${(desb/2).toFixed(2)} kW`;
  out('outBalance', txt);
});

// -------- Consumo y costos --------
$('btnConsumo').addEventListener('click', () => {
  const kW = parseFloat($('consKw').value);
  const h = parseFloat($('consHoras').value||'0');
  const d = parseFloat($('consDias').value||'0');
  const tarifa = parseFloat($('consTarifa').value||'0');
  if (isNaN(kW)) return out('outConsumo','Ingresá kW.');
  const kWhMes = kW*h*d;
  const costo = kWhMes*tarifa;
  out('outConsumo', `Consumo mensual ≈ ${kWhMes.toFixed(2)} kWh\nCosto estimado ≈ ${costo.toFixed(2)}`);
});

// -------- Convertidor --------
// mm2 ↔ AWG (tabla básica)
const awgTable = [
  {awg:0, mm2:53.5}, {awg:1, mm2:42.4}, {awg:2, mm2:33.6}, {awg:3, mm2:26.7}, {awg:4, mm2:21.2},
  {awg:5, mm2:16.8}, {awg:6, mm2:13.3}, {awg:8, mm2:8.37}, {awg:10, mm2:5.26},
  {awg:12, mm2:3.31}, {awg:14, mm2:2.08}, {awg:16, mm2:1.31}, {awg:18, mm2:0.823}
];

function mm2toAWG(mm2){
  // elegir el AWG cuyo mm2 sea más cercano
  let best = awgTable[0];
  let diff = Math.abs(mm2 - best.mm2);
  for (const row of awgTable){
    const d = Math.abs(mm2 - row.mm2);
    if (d < diff){ diff = d; best = row; }
  }
  return best.awg;
}
function awgTomm2(awg){
  let best = awgTable[0];
  let diff = Math.abs(awg - best.awg);
  for (const row of awgTable){
    const d = Math.abs(awg - row.awg);
    if (d < diff){ diff = d; best = row; }
  }
  return best.mm2;
}

$('btnConv').addEventListener('click', () => {
  const mm2 = parseFloat($('mm2').value);
  const awg = parseFloat($('awg').value);
  const wkw = parseFloat($('wkw').value);

  let txt = [];
  if (!isNaN(mm2)) txt.push(`${mm2} mm² ≈ AWG ${mm2toAWG(mm2)}`);
  if (!isNaN(awg)) txt.push(`AWG ${awg} ≈ ${awgTomm2(awg).toFixed(2)} mm²`);
  if (!isNaN(wkw)){
    if (wkw > 10) txt.push(`${wkw} W = ${(wkw/1000).toFixed(3)} kW`);
    else txt.push(`${wkw} kW = ${(wkw*1000).toFixed(0)} W`);
  }
  if (txt.length===0) txt.push('Ingresá algún valor.');
  out('outConv', txt.join('\n'));
});

// -------- Resistencias --------
$('btnRes').addEventListener('click', () => {
  const serie = $('serie').value.split(',').map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n));
  const paralelo = $('paralelo').value.split(',').map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n));

  let txt = [];
  if (serie.length){
    const Rs = serie.reduce((a,b)=>a+b,0);
    txt.push(`Serie: ${Rs.toFixed(3)} Ω`);
  }
  if (paralelo.length){
    const inv = paralelo.reduce((a,b)=> a + (1/b), 0);
    const Rp = 1/inv;
    txt.push(`Paralelo: ${Rp.toFixed(3)} Ω`);
  }
  if (!txt.length) txt.push('Ingresá valores en serie/paralelo.');
  out('outRes', txt.join('\n'));
});

// -------- Proyecto (localStorage) --------
const KEY = 'pro_toolkit_electricistas_v1';

$('btnSave').addEventListener('click', () => {
  const data = {};
  document.querySelectorAll('section.card input, section.card select').forEach(el => {
    data[el.id] = el.value;
  });
  localStorage.setItem(KEY, JSON.stringify(data));
  out('outProyecto', 'Proyecto guardado localmente ✔');
});

$('btnLoad').addEventListener('click', () => {
  const raw = localStorage.getItem(KEY);
  if (!raw){ out('outProyecto','No hay proyecto guardado.'); return; }
  const data = JSON.parse(raw);
  Object.entries(data).forEach(([id,val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  out('outProyecto', 'Proyecto cargado ✔');
});

$('btnClearProject').addEventListener('click', () => {
  localStorage.removeItem(KEY);
  out('outProyecto', 'Proyecto eliminado.');
});
