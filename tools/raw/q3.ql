[out:json][timeout:200];
area["ISO3166-1"="CH"][admin_level=2]->.ch;
(
  way["waterway"~"river|canal"]["name"~"Zihl|Thielle|Thièle"](area.ch);
  way["waterway"="river"]["name"~"^Rein "](area.ch);
);
out geom;
