export default async function (js, sleep) {
  return js(`(() => {
    const aus = [];
    document.querySelector('#stoff-oeffnen').click();
    const ta = document.querySelector('#stoff-text');
    aus.push(ta.value.length);
    const s = JSON.parse(ta.value); s.orte = s.orte.slice(0, 3); delete s.paesse;
    ta.value = JSON.stringify(s);
    document.querySelector('#stoff-speichern').click();
    aus.push(document.querySelector('#stoff-meldung').textContent);
    s.paesse = []; ta.value = JSON.stringify(s);
    document.querySelector('#stoff-speichern').click();
    aus.push(document.querySelector('#stoff').open, document.querySelector('#themenliste').textContent);
    aus.push(localStorage.getItem('geomaster.stoff.v1').length);
    document.querySelector('#stoff-oeffnen').click();
    document.querySelector('#stoff-reset').click();
    aus.push(document.querySelector('#stoff-meldung').textContent, ta.value.length);
    document.querySelector('#stoff-speichern').click();
    aus.push(document.querySelector('#themenliste').textContent);
    return aus;
  })()`);
}
