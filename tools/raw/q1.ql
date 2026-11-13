[out:json][timeout:180];
area["ISO3166-1"="CH"][admin_level=2]->.ch;
(
  rel["natural"="water"]["name"="Zugersee"](area.ch);
  way["natural"="water"]["name"="Zugersee"](area.ch);
);
out geom;
