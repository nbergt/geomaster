// Spielt in jedem Thema auf jeder Stufe ein paar Fragen und protokolliert,
// was die App anzeigt. Kartenklicks an festen Stellen, Texteingaben fest.
export default async function (js, sleep) {
  const protokoll = [];
  const anzahl = await js(`document.querySelectorAll('#themenliste .thema').length`);
  for (let t = 0; t < anzahl; t++) {
    for (let s = 1; s <= 4; s++) {
      await js(`document.querySelector('#nach-hause').click()`);
      await js(`document.querySelectorAll('#themenliste .thema')[${t}].querySelectorAll('.stufe-knopf')[${s - 1}].click()`);
      for (let q = 0; q < 4; q++) {
        const zug = await js(`(() => {
          const karte = document.querySelector('#karte');
          const r = karte.getBoundingClientRect();
          const frage = document.querySelector('#frage').textContent;
          const beigabe = document.querySelector('#frage-beigabe').innerHTML.slice(0, 80);
          const klasse = karte.getAttribute('class');
          const marken = [...karte.querySelectorAll('.marke')].map(m => m.textContent + '@' + m.getAttribute('x') + ',' + m.getAttribute('y')).join('|');
          const zielEl = [...karte.querySelectorAll('.ziel-el')].map(e => e.dataset.key).join(',');
          const auf = karte.querySelector('.aufloesung').innerHTML;
          const wahl = [...document.querySelectorAll('#antwortfeld .wahl')];
          const input = document.querySelector('#antwortfeld input');
          let aktion;
          if (wahl.length) { wahl[${q} % wahl.length].click(); aktion = 'wahl'; }
          else if (input) { input.value = ${JSON.stringify(['Bern', 'Zürich', 'Genf', 'Lausane'])}[${q}]; document.querySelector('#antwortfeld .knopf').click(); aktion = 'tipp'; }
          else {
            const x = r.left + r.width * (0.2 + 0.17 * ${q}), y = r.top + r.height * (0.3 + 0.12 * ${q});
            karte.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, button: 0, isPrimary: true, pointerType: 'mouse' }));
            karte.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true, button: 0, isPrimary: true, pointerType: 'mouse' }));
            aktion = 'klick';
          }
          const rueck = document.querySelector('#rueckmeldung').hidden ? null : document.querySelector('#rueck-text').textContent;
          const nachher = karte.querySelector('.aufloesung').innerHTML;
          const w = document.querySelector('#weiter'); if (!document.querySelector('#rueckmeldung').hidden) w.click();
          return { frage, beigabe, klasse, marken, zielEl, auf, aktion, rueck, nachher };
        })()`);
        protokoll.push(`${t}/${s}/${q}`, zug);
      }
    }
  }
  return protokoll;
}
