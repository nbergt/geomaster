/* GeoMaster — Klimadiagramm (nach Walter/Lieth, wie im Schulbuch).
   Temperatur als rote Linie (linke Achse, °C), Niederschlag als blaue Säulen
   (rechte Achse, mm). Massstab 10 °C = 20 mm: wo die Säulen über der
   Temperaturlinie stehen, ist der Monat humid, wo sie darunter bleiben, arid.
   Gibt ein <svg> zurück; die Werte kommen aus KLIMA_EU (js/klima-eu.js). */

'use strict';

function klimadiagrammBauen(werte, { titel } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const neu = (tag, attrs = {}, text) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };

  const { t, n } = werte;
  // Achsen in 10-°C-Schritten; Niederschlag doppelt so viele mm. Über 100 mm
  // wird der Niederschlag wie im Schulbuch gestaucht (1 Schritt = 100 mm).
  const tMin = Math.min(-10, Math.floor(Math.min(...t) / 10) * 10);
  const tMax = Math.max(30, Math.ceil(Math.max(...t) / 10) * 10);
  const nMax = Math.max(...n);
  const oben = Math.max(tMax, Math.ceil(Math.min(nMax, 100) / 20) * 10,
    nMax > 100 ? 50 + Math.ceil((nMax - 100) / 100) * 10 : 0);

  const B = 300, H = 220, L = 40, R = 44, O = 30, U = 26;
  const breite = B - L - R, hoehe = H - O - U;
  const yT = grad => O + hoehe * (oben - grad) / (oben - tMin);
  const yN = mm => (mm <= 100 ? yT(mm / 2) : yT(50 + (mm - 100) / 10));
  const xM = i => L + breite * (i + 0.5) / 12;
  const spalte = breite / 12;

  const svg = neu('svg', {
    class: 'klimadiagramm', viewBox: `0 0 ${B} ${H}`, role: 'img',
    'aria-label': 'Klimadiagramm: Monatsmittel der Temperatur und Monatssummen des Niederschlags',
  });

  // Gitter und Achsen
  for (let g = tMin; g <= oben; g += 10) {
    svg.append(neu('line', { class: 'kd-gitter', x1: L, x2: B - R, y1: yT(g), y2: yT(g) }));
    if (g <= 50) {
      svg.append(neu('text', { class: 'kd-achse', x: L - 5, y: yT(g) + 3.5, 'text-anchor': 'end' }, String(g).replace('-', '−')));
    }
    const mm = g <= 50 ? g * 2 : 100 + (g - 50) * 10;
    if (g >= 0) svg.append(neu('text', { class: 'kd-achse kd-n', x: B - R + 5, y: yT(g) + 3.5 }, String(mm)));
  }
  svg.append(neu('line', { class: 'kd-null', x1: L, x2: B - R, y1: yT(0), y2: yT(0) }));
  svg.append(neu('text', { class: 'kd-einheit', x: L - 5, y: O - 10, 'text-anchor': 'end' }, '°C'));
  svg.append(neu('text', { class: 'kd-einheit kd-n', x: B - R + 5, y: O - 10 }, 'mm'));

  // Niederschlag als Säulen
  for (let i = 0; i < 12; i++) {
    const y = yN(n[i]);
    svg.append(neu('rect', {
      class: 'kd-saeule', x: xM(i) - spalte * 0.38, width: spalte * 0.76, y, height: Math.max(0, yT(0) - y),
    }));
  }

  // Temperatur als Linie mit Punkten
  svg.append(neu('polyline', {
    class: 'kd-linie', points: t.map((v, i) => `${xM(i)},${yT(v)}`).join(' '),
  }));
  for (let i = 0; i < 12; i++) svg.append(neu('circle', { class: 'kd-punkt', cx: xM(i), cy: yT(t[i]), r: 2 }));

  // Monate
  'JFMAMJJASOND'.split('').forEach((m, i) => {
    svg.append(neu('text', { class: 'kd-achse', x: xM(i), y: H - U + 14, 'text-anchor': 'middle' }, m));
  });

  // Kopf: Jahresmittel und Jahressumme wie im Schulbuch
  const mittel = t.reduce((s, v) => s + v, 0) / 12;
  const summe = n.reduce((s, v) => s + v, 0);
  svg.append(neu('text', { class: 'kd-kopf', x: L, y: 13 },
    `${titel ? titel + ' · ' : ''}${mittel.toFixed(1).replace('.', ',').replace('-', '−')} °C · ${summe} mm`));

  return svg;
}
