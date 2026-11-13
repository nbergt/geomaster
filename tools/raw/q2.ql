[out:json][timeout:300];
area["ISO3166-1"="CH"][admin_level=2]->.ch;
way["waterway"="river"]["name"~"^(Ticino|Maggia|Rhone|Rhône|Le Rhône|Rotten|Sense|Singine|Thielle|La Thielle|Zihl|Areuse|L'Areuse|Aare|Emme|Suhre|Reuss|Saane|Sarine|La Sarine|Limmat|Rhein|Vorderrhein|Hinterrhein|Alpenrhein)$"](area.ch);
out geom;
