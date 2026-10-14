/* ZOLLER-Währung – eine Datei für Webseite, Werkzeugraum-Planer und Messe-App
   (Quelle: zoller-webseite/assets/js/currency.js, die anderen Projekte kopieren sie beim Bauen).

   Beträge stehen in Euro im Quelltext (data-eur="15000"). Gezeigt wird die Währung des Landes, in dem die Seite
   aufgerufen wird: Zeitzone des Browsers, sonst Region der Browsersprache – kein Server, nichts verlässt den Browser.
   Der Währungs-Button (data-currency-btn) stellt um; die Wahl gilt für alle ZOLLER-Seiten derselben Domain
   (localStorage »zoller-currency«), »Automatisch« nimmt sie zurück. ?currency=USD zeigt eine Währung nur für diesen Aufruf.
   Umgerechnet zum Referenzkurs (EZB, Währungen ohne EZB-Kurs: currency-api) und aufgerundet: Preise und Ersparnisse
   (ab 10.000) auf volle Tausend, ab 1 Mio. auf drei Stellen genau; kleine Werte wie Stundensätze feiner (unter 100 auf 5,
   unter 1.000 auf 10, unter 10.000 auf 100). Euro bleibt unverändert. data-eur-base="75" rechnet einen Betrag aus einem
   anderen hoch (15.000 € = 200 h × 75 €/h -> 200 × umgerechneter Stundensatz), damit Beispielrechnungen aufgehen.
   Kurse, Länder und Zeitzonen schreibt python3 tools/fx.py in den DATA-Block. */
(function () {
  'use strict';
  /* DATA:BEGIN – erzeugt von tools/fx.py, nicht von Hand ändern */
  var D = {"date":"2026-10-14","main":["EUR","USD","CAD","MXN","BRL","GBP","CHF","SEK","PLN","CZK","HUF","TRY","RUB","CNY","JPY","KRW","INR"],"rates":{"AED":4.10406,"AFN":72.647,"ALL":91.5526,"AMD":404.709,"AOA":1020.41,"ARS":1694.93,"AUD":1.5971,"AWG":2.00035,"AZN":1.89978,"BAM":1.95583,"BBD":2.23502,"BDT":137.992,"BHD":0.420184,"BIF":3353.14,"BMD":1.11751,"BND":1.43113,"BOB":13.1398,"BRL":5.6246,"BSD":1.11751,"BTN":106.425,"BWP":15.3694,"BYN":3.37629,"BZD":2.25481,"CAD":1.5918,"CDF":2583.23,"CHF":0.933,"CLP":1091.85,"CNY":7.4925,"COP":3571.84,"CRC":508.728,"CUP":26.8679,"CVE":110.27,"CZK":24.357,"DJF":199.009,"DKK":7.4754,"DOP":68.4703,"DZD":150.497,"EGP":58.8618,"ERN":16.7627,"ETB":180.896,"EUR":1.0,"FJD":2.51635,"FKP":0.845206,"GBP":0.84385,"GEL":2.89659,"GHS":13.0917,"GIP":0.845206,"GMD":83.3125,"GNF":9845.3,"GTQ":8.54336,"GYD":233.541,"HKD":8.7859,"HNL":29.997,"HTG":148.392,"HUF":363.3,"IDR":20062.7,"ILS":3.4443,"INR":106.528,"IQD":1688.27,"IRR":1988390.0,"ISK":136.4,"JMD":176.943,"JOD":0.792316,"JPY":177.39,"KES":144.984,"KGS":97.7565,"KHR":4545.81,"KMF":491.968,"KPW":1005.67,"KRW":1496.54,"KWD":0.348141,"KYD":0.927667,"KZT":502.649,"LAK":24962.1,"LBP":100717.0,"LKR":369.83,"LRD":190.955,"LYD":7.17805,"MAD":10.8615,"MDL":19.9573,"MGA":5050.49,"MKD":61.4072,"MMK":2346.96,"MNT":4020.13,"MOP":9.03302,"MRU":45.1589,"MUR":53.3206,"MVR":17.2768,"MWK":1937.95,"MXN":20.56,"MYR":4.5704,"MZN":71.0726,"NAD":18.4583,"NGN":1484.16,"NIO":41.1041,"NOK":10.6035,"NPR":170.359,"NZD":1.9941,"OMR":0.430273,"PAB":1.11751,"PEN":3.85477,"PGK":5.06808,"PHP":70.393,"PKR":309.929,"PLN":4.3658,"PYG":6386.7,"QAR":4.06774,"RON":5.3442,"RSD":117.405,"RUB":93.7771,"RWF":1648.1,"SAR":4.19067,"SBD":8.97311,"SCR":16.3593,"SDG":670.753,"SEK":11.158,"SGD":1.4359,"SHP":0.845206,"SLE":25.5965,"SOS":639.207,"SRD":42.3537,"SSP":6409.8,"STN":24.7484,"SYP":14528.5,"SZL":18.4583,"THB":37.587,"TJS":10.3196,"TMT":3.91134,"TND":3.34818,"TOP":2.664,"TRY":55.2921,"TTD":7.5996,"TWD":35.9077,"TZS":2952.07,"UAH":50.3506,"UGX":4644.47,"USD":1.1195,"UYU":44.9619,"UZS":13296.9,"VED":977.387,"VND":28957.2,"VUV":132.973,"WST":3.10333,"XAF":655.957,"XCD":3.02781,"XCG":2.00817,"XOF":655.957,"XPF":119.332,"YER":263.833,"ZAR":18.4382,"ZMW":22.3054,"ZWG":29.9026},"cc":{"AC":"SHP","AD":"EUR","AE":"AED","AF":"AFN","AG":"XCD","AI":"XCD","AL":"ALL","AM":"AMD","AO":"AOA","AR":"ARS","AS":"USD","AT":"EUR","AU":"AUD","AW":"AWG","AX":"EUR","AZ":"AZN","BA":"BAM","BB":"BBD","BD":"BDT","BE":"EUR","BF":"XOF","BG":"EUR","BH":"BHD","BI":"BIF","BJ":"XOF","BL":"EUR","BM":"BMD","BN":"BND","BO":"BOB","BQ":"USD","BR":"BRL","BS":"BSD","BT":"BTN","BV":"NOK","BW":"BWP","BY":"BYN","BZ":"BZD","CA":"CAD","CC":"AUD","CD":"CDF","CF":"XAF","CG":"XAF","CH":"CHF","CI":"XOF","CK":"NZD","CL":"CLP","CM":"XAF","CN":"CNY","CO":"COP","CR":"CRC","CU":"CUP","CV":"CVE","CW":"XCG","CX":"AUD","CY":"EUR","CZ":"CZK","DE":"EUR","DG":"USD","DJ":"DJF","DK":"DKK","DM":"XCD","DO":"DOP","DZ":"DZD","EA":"EUR","EC":"USD","EE":"EUR","EG":"EGP","EH":"MAD","ER":"ERN","ES":"EUR","ET":"ETB","EU":"EUR","FI":"EUR","FJ":"FJD","FK":"FKP","FM":"USD","FO":"DKK","FR":"EUR","GA":"XAF","GB":"GBP","GD":"XCD","GE":"GEL","GF":"EUR","GG":"GBP","GH":"GHS","GI":"GIP","GL":"DKK","GM":"GMD","GN":"GNF","GP":"EUR","GQ":"XAF","GR":"EUR","GS":"GBP","GT":"GTQ","GU":"USD","GW":"XOF","GY":"GYD","HK":"HKD","HM":"AUD","HN":"HNL","HR":"EUR","HT":"HTG","HU":"HUF","IC":"EUR","ID":"IDR","IE":"EUR","IL":"ILS","IM":"GBP","IN":"INR","IO":"USD","IQ":"IQD","IR":"IRR","IS":"ISK","IT":"EUR","JE":"GBP","JM":"JMD","JO":"JOD","JP":"JPY","KE":"KES","KG":"KGS","KH":"KHR","KI":"AUD","KM":"KMF","KN":"XCD","KP":"KPW","KR":"KRW","KW":"KWD","KY":"KYD","KZ":"KZT","LA":"LAK","LB":"LBP","LC":"XCD","LI":"CHF","LK":"LKR","LR":"LRD","LS":"ZAR","LT":"EUR","LU":"EUR","LV":"EUR","LY":"LYD","MA":"MAD","MC":"EUR","MD":"MDL","ME":"EUR","MF":"EUR","MG":"MGA","MH":"USD","MK":"MKD","ML":"XOF","MM":"MMK","MN":"MNT","MO":"MOP","MP":"USD","MQ":"EUR","MR":"MRU","MS":"XCD","MT":"EUR","MU":"MUR","MV":"MVR","MW":"MWK","MX":"MXN","MY":"MYR","MZ":"MZN","NA":"NAD","NC":"XPF","NE":"XOF","NF":"AUD","NG":"NGN","NI":"NIO","NL":"EUR","NO":"NOK","NP":"NPR","NR":"AUD","NU":"NZD","NZ":"NZD","OM":"OMR","PA":"PAB","PE":"PEN","PF":"XPF","PG":"PGK","PH":"PHP","PK":"PKR","PL":"PLN","PM":"EUR","PN":"NZD","PR":"USD","PS":"ILS","PT":"EUR","PW":"USD","PY":"PYG","QA":"QAR","RE":"EUR","RO":"RON","RS":"RSD","RU":"RUB","RW":"RWF","SA":"SAR","SB":"SBD","SC":"SCR","SD":"SDG","SE":"SEK","SG":"SGD","SH":"SHP","SI":"EUR","SJ":"NOK","SK":"EUR","SL":"SLE","SM":"EUR","SN":"XOF","SO":"SOS","SR":"SRD","SS":"SSP","ST":"STN","SV":"USD","SX":"XCG","SY":"SYP","SZ":"SZL","TA":"GBP","TC":"USD","TD":"XAF","TF":"EUR","TG":"XOF","TH":"THB","TJ":"TJS","TK":"NZD","TL":"USD","TM":"TMT","TN":"TND","TO":"TOP","TR":"TRY","TT":"TTD","TV":"AUD","TW":"TWD","TZ":"TZS","UA":"UAH","UG":"UGX","UM":"USD","US":"USD","UY":"UYU","UZ":"UZS","VA":"EUR","VC":"XCD","VE":"VED","VG":"USD","VI":"USD","VN":"VND","VU":"VUV","WF":"XPF","WS":"WST","XK":"EUR","YE":"YER","YT":"EUR","ZA":"ZAR","ZM":"ZMW","ZW":"ZWG"},"tz":"Africa:Abidjan CI,Accra GH,Addis_Ababa ET,Algiers DZ,Asmara ER,Asmera KE,Bamako ML,Bangui CF,Banjul GM,Bissau GW,Blantyre MW,Brazzaville CG,Bujumbura BI,Cairo EG,Casablanca MA,Ceuta ES,Conakry GN,Dakar SN,Dar_es_Salaam TZ,Djibouti DJ,Douala CM,El_Aaiun EH,Freetown SL,Gaborone BW,Harare ZW,Johannesburg ZA,Juba SS,Kampala UG,Khartoum SD,Kigali RW,Kinshasa CD,Lagos NG,Libreville GA,Lome TG,Luanda AO,Lubumbashi CD,Lusaka ZM,Malabo GQ,Maputo MZ,Maseru LS,Mbabane SZ,Mogadishu SO,Monrovia LR,Nairobi KE,Ndjamena TD,Niamey NE,Nouakchott MR,Ouagadougou BF,Porto-Novo BJ,Sao_Tome ST,Timbuktu CI,Tripoli LY,Tunis TN,Windhoek NA;America:Adak US,Anchorage US,Anguilla AI,Antigua AG,Araguaina BR,Argentina/Buenos_Aires AR,Argentina/Catamarca AR,Argentina/ComodRivadavia AR,Argentina/Cordoba AR,Argentina/Jujuy AR,Argentina/La_Rioja AR,Argentina/Mendoza AR,Argentina/Rio_Gallegos AR,Argentina/Salta AR,Argentina/San_Juan AR,Argentina/San_Luis AR,Argentina/Tucuman AR,Argentina/Ushuaia AR,Aruba AW,Asuncion PY,Atikokan CA,Atka US,Bahia BR,Bahia_Banderas MX,Barbados BB,Belem BR,Belize BZ,Blanc-Sablon CA,Boa_Vista BR,Bogota CO,Boise US,Buenos_Aires AR,Cambridge_Bay CA,Campo_Grande BR,Cancun MX,Caracas VE,Catamarca AR,Cayenne GF,Cayman KY,Chicago US,Chihuahua MX,Ciudad_Juarez MX,Coral_Harbour PA,Cordoba AR,Costa_Rica CR,Coyhaique CL,Creston CA,Cuiaba BR,Curacao CW,Danmarkshavn GL,Dawson CA,Dawson_Creek CA,Denver US,Detroit US,Dominica DM,Edmonton CA,Eirunepe BR,El_Salvador SV,Ensenada MX,Fort_Nelson CA,Fort_Wayne US,Fortaleza BR,Glace_Bay CA,Godthab GL,Goose_Bay CA,Grand_Turk TC,Grenada GD,Guadeloupe GP,Guatemala GT,Guayaquil EC,Guyana GY,Halifax CA,Havana CU,Hermosillo MX,Indiana/Indianapolis US,Indiana/Knox US,Indiana/Marengo US,Indiana/Petersburg US,Indiana/Tell_City US,Indiana/Vevay US,Indiana/Vincennes US,Indiana/Winamac US,Indianapolis US,Inuvik CA,Iqaluit CA,Jamaica JM,Jujuy AR,Juneau US,Kentucky/Louisville US,Kentucky/Monticello US,Knox_IN US,Kralendijk BQ,La_Paz BO,Lima PE,Los_Angeles US,Louisville US,Lower_Princes SX,Maceio BR,Managua NI,Manaus BR,Marigot MF,Martinique MQ,Matamoros MX,Mazatlan MX,Mendoza AR,Menominee US,Merida MX,Metlakatla US,Mexico_City MX,Miquelon PM,Moncton CA,Monterrey MX,Montevideo UY,Montreal CA,Montserrat MS,Nassau BS,New_York US,Nipigon CA,Nome US,Noronha BR,North_Dakota/Beulah US,North_Dakota/Center US,North_Dakota/New_Salem US,Nuuk GL,Ojinaga MX,Panama PA,Pangnirtung CA,Paramaribo SR,Phoenix US,Port-au-Prince HT,Port_of_Spain TT,Porto_Acre BR,Porto_Velho BR,Puerto_Rico PR,Punta_Arenas CL,Rainy_River CA,Rankin_Inlet CA,Recife BR,Regina CA,Resolute CA,Rio_Branco BR,Rosario AR,Santa_Isabel MX,Santarem BR,Santiago CL,Santo_Domingo DO,Sao_Paulo BR,Scoresbysund GL,Shiprock US,Sitka US,St_Barthelemy BL,St_Johns CA,St_Kitts KN,St_Lucia LC,St_Thomas VI,St_Vincent VC,Swift_Current CA,Tegucigalpa HN,Thule GL,Thunder_Bay CA,Tijuana MX,Toronto CA,Tortola VG,Vancouver CA,Virgin PR,Whitehorse CA,Winnipeg CA,Yakutat US,Yellowknife CA;Antarctica:Casey AQ,Davis AQ,DumontDUrville AQ,Macquarie AU,Mawson AQ,McMurdo AQ,Palmer AQ,Rothera AQ,South_Pole NZ,Syowa AQ,Troll AQ,Vostok AQ;Arctic:Longyearbyen SJ;Asia:Aden YE,Almaty KZ,Amman JO,Anadyr RU,Aqtau KZ,Aqtobe KZ,Ashgabat TM,Ashkhabad TM,Atyrau KZ,Baghdad IQ,Bahrain BH,Baku AZ,Bangkok TH,Barnaul RU,Beirut LB,Bishkek KG,Brunei BN,Calcutta IN,Chita RU,Choibalsan MN,Chongqing CN,Chungking CN,Colombo LK,Dacca BD,Damascus SY,Dhaka BD,Dili TL,Dubai AE,Dushanbe TJ,Famagusta CY,Gaza PS,Harbin CN,Hebron PS,Ho_Chi_Minh VN,Hong_Kong HK,Hovd MN,Irkutsk RU,Istanbul TR,Jakarta ID,Jayapura ID,Jerusalem IL,Kabul AF,Kamchatka RU,Karachi PK,Kashgar CN,Kathmandu NP,Katmandu NP,Khandyga RU,Kolkata IN,Krasnoyarsk RU,Kuala_Lumpur MY,Kuching MY,Kuwait KW,Macao MO,Macau MO,Magadan RU,Makassar ID,Manila PH,Muscat OM,Nicosia CY,Novokuznetsk RU,Novosibirsk RU,Omsk RU,Oral KZ,Phnom_Penh KH,Pontianak ID,Pyongyang KP,Qatar QA,Qostanay KZ,Qyzylorda KZ,Rangoon MM,Riyadh SA,Saigon VN,Sakhalin RU,Samarkand UZ,Seoul KR,Shanghai CN,Singapore SG,Srednekolymsk RU,Taipei TW,Tashkent UZ,Tbilisi GE,Tehran IR,Tel_Aviv IL,Thimbu BT,Thimphu BT,Tokyo JP,Tomsk RU,Ujung_Pandang ID,Ulaanbaatar MN,Ulan_Bator MN,Urumqi CN,Ust-Nera RU,Vientiane LA,Vladivostok RU,Yakutsk RU,Yangon MM,Yekaterinburg RU,Yerevan AM;Atlantic:Azores PT,Bermuda BM,Canary ES,Cape_Verde CV,Faeroe FO,Faroe FO,Jan_Mayen DE,Madeira PT,Reykjavik IS,South_Georgia GS,St_Helena SH,Stanley FK;Australia:ACT AU,Adelaide AU,Brisbane AU,Broken_Hill AU,Canberra AU,Currie AU,Darwin AU,Eucla AU,Hobart AU,LHI AU,Lindeman AU,Lord_Howe AU,Melbourne AU,NSW AU,North AU,Perth AU,Queensland AU,South AU,Sydney AU,Tasmania AU,Victoria AU,West AU,Yancowinna AU;Brazil:Acre BR,DeNoronha BR,East BR,West BR;Canada:Atlantic CA,Central CA,Eastern CA,Mountain CA,Newfoundland CA,Pacific CA,Saskatchewan CA,Yukon CA;Chile:Continental CL,EasterIsland CL;Europe:Amsterdam NL,Andorra AD,Astrakhan RU,Athens GR,Belfast GB,Belgrade RS,Berlin DE,Bratislava SK,Brussels BE,Bucharest RO,Budapest HU,Busingen DE,Chisinau MD,Copenhagen DK,Dublin IE,Gibraltar GI,Guernsey GG,Helsinki FI,Isle_of_Man IM,Istanbul TR,Jersey JE,Kaliningrad RU,Kiev UA,Kirov RU,Kyiv UA,Lisbon PT,Ljubljana SI,London GB,Luxembourg LU,Madrid ES,Malta MT,Mariehamn AX,Minsk BY,Monaco MC,Moscow RU,Nicosia CY,Oslo NO,Paris FR,Podgorica ME,Prague CZ,Riga LV,Rome IT,Samara RU,San_Marino SM,Sarajevo BA,Saratov RU,Simferopol UA,Skopje MK,Sofia BG,Stockholm SE,Tallinn EE,Tirane AL,Tiraspol MD,Ulyanovsk RU,Uzhgorod UA,Vaduz LI,Vatican VA,Vienna AT,Vilnius LT,Volgograd RU,Warsaw PL,Zagreb HR,Zaporozhye UA,Zurich CH;Indian:Antananarivo MG,Chagos IO,Christmas CX,Cocos CC,Comoro KM,Kerguelen TF,Mahe SC,Maldives MV,Mauritius MU,Mayotte YT,Reunion RE;Mexico:BajaNorte MX,BajaSur MX,General MX;Pacific:Apia WS,Auckland NZ,Bougainville PG,Chatham NZ,Chuuk FM,Easter CL,Efate VU,Enderbury KI,Fakaofo TK,Fiji FJ,Funafuti TV,Galapagos EC,Gambier PF,Guadalcanal SB,Guam GU,Honolulu US,Johnston US,Kanton KI,Kiritimati KI,Kosrae FM,Kwajalein MH,Majuro MH,Marquesas PF,Midway UM,Nauru NR,Niue NU,Norfolk NF,Noumea NC,Pago_Pago AS,Palau PW,Pitcairn PN,Pohnpei FM,Ponape SB,Port_Moresby PG,Rarotonga CK,Saipan MP,Samoa AS,Tahiti PF,Tarawa KI,Tongatapu TO,Truk PG,Wake UM,Wallis WF,Yap PG;US:Alaska US,Aleutian US,Arizona US,Central US,East-Indiana US,Eastern US,Hawaii US,Indiana-Starke US,Michigan US,Mountain US,Pacific US,Samoa AS"};
  /* DATA:END */

  var KEY = 'zoller-currency';
  var EVT = 'zoller:currency';
  var T = {
    de: { title: 'Währung', auto: 'Automatisch', here: 'Ihr Standort: {c}', search: 'Währung suchen', none: 'Keine Währung gefunden', note: 'Umgerechnet zum Referenzkurs vom {d} und aufgerundet.', tip: '{v}, umgerechnet und aufgerundet', pick: 'Währung wählen', close: 'Schließen', common: 'Häufig', all: 'Alle Währungen' },
    en: { title: 'Currency', auto: 'Automatic', here: 'Your location: {c}', search: 'Search currency', none: 'No currency found', note: 'Converted at the reference rate of {d} and rounded up.', tip: '{v}, converted and rounded up', pick: 'Choose currency', close: 'Close', common: 'Common', all: 'All currencies' },
    fr: { title: 'Devise', auto: 'Automatique', here: 'Votre position : {c}', search: 'Rechercher une devise', none: 'Aucune devise trouvée', note: 'Converti au taux de référence du {d} et arrondi au supérieur.', tip: '{v}, converti et arrondi au supérieur', pick: 'Choisir la devise', close: 'Fermer', common: 'Fréquentes', all: 'Toutes les devises' },
    es: { title: 'Moneda', auto: 'Automática', here: 'Su ubicación: {c}', search: 'Buscar moneda', none: 'No se encontró ninguna moneda', note: 'Convertido al tipo de cambio de referencia del {d} y redondeado al alza.', tip: '{v}, convertido y redondeado al alza', pick: 'Elegir moneda', close: 'Cerrar', common: 'Frecuentes', all: 'Todas las monedas' },
    it: { title: 'Valuta', auto: 'Automatica', here: 'La sua posizione: {c}', search: 'Cerca valuta', none: 'Nessuna valuta trovata', note: 'Convertito al tasso di riferimento del {d} e arrotondato per eccesso.', tip: '{v}, convertito e arrotondato per eccesso', pick: 'Scegli la valuta', close: 'Chiudi', common: 'Frequenti', all: 'Tutte le valute' },
    pt: { title: 'Moeda', auto: 'Automática', here: 'A sua localização: {c}', search: 'Pesquisar moeda', none: 'Nenhuma moeda encontrada', note: 'Convertido à taxa de referência de {d} e arredondado para cima.', tip: '{v}, convertido e arredondado para cima', pick: 'Escolher moeda', close: 'Fechar', common: 'Frequentes', all: 'Todas as moedas' },
    'pt-BR': { here: 'Sua localização: {c}', note: 'Convertido pela taxa de referência de {d} e arredondado para cima.' },
    sv: { title: 'Valuta', auto: 'Automatiskt', here: 'Din plats: {c}', search: 'Sök valuta', none: 'Ingen valuta hittades', note: 'Omräknat till referenskursen den {d} och avrundat uppåt.', tip: '{v}, omräknat och avrundat uppåt', pick: 'Välj valuta', close: 'Stäng', common: 'Vanliga', all: 'Alla valutor' },
    pl: { title: 'Waluta', auto: 'Automatycznie', here: 'Państwa lokalizacja: {c}', search: 'Szukaj waluty', none: 'Nie znaleziono waluty', note: 'Przeliczono po kursie referencyjnym z {d} i zaokrąglono w górę.', tip: '{v}, przeliczono i zaokrąglono w górę', pick: 'Wybierz walutę', close: 'Zamknij', common: 'Najczęstsze', all: 'Wszystkie waluty' },
    sl: { title: 'Valuta', auto: 'Samodejno', here: 'Vaša lokacija: {c}', search: 'Iskanje valute', none: 'Ni najdene valute', note: 'Preračunano po referenčnem tečaju z dne {d} in zaokroženo navzgor.', tip: '{v}, preračunano in zaokroženo navzgor', pick: 'Izberite valuto', close: 'Zapri', common: 'Pogoste', all: 'Vse valute' },
    cs: { title: 'Měna', auto: 'Automaticky', here: 'Vaše poloha: {c}', search: 'Hledat měnu', none: 'Žádná měna nenalezena', note: 'Přepočteno referenčním kurzem ze dne {d} a zaokrouhleno nahoru.', tip: '{v}, přepočteno a zaokrouhleno nahoru', pick: 'Vybrat měnu', close: 'Zavřít', common: 'Časté', all: 'Všechny měny' },
    sk: { title: 'Mena', auto: 'Automaticky', here: 'Vaša poloha: {c}', search: 'Hľadať menu', none: 'Nenašla sa žiadna mena', note: 'Prepočítané referenčným kurzom z {d} a zaokrúhlené nahor.', tip: '{v}, prepočítané a zaokrúhlené nahor', pick: 'Vybrať menu', close: 'Zavrieť', common: 'Časté', all: 'Všetky meny' },
    hu: { title: 'Pénznem', auto: 'Automatikus', here: 'Az Ön helye: {c}', search: 'Pénznem keresése', none: 'Nincs ilyen pénznem', note: 'Átszámítva referencia-árfolyamon ({d}), felfelé kerekítve.', tip: '{v}, átszámítva és felfelé kerekítve', pick: 'Pénznem kiválasztása', close: 'Bezárás', common: 'Gyakori', all: 'Összes pénznem' },
    zh: { title: '货币', auto: '自动', here: '您的位置：{c}', search: '搜索货币', none: '未找到货币', note: '按 {d} 的参考汇率换算并向上取整。', tip: '{v}，已换算并向上取整', pick: '选择货币', close: '关闭', common: '常用', all: '全部货币' },
    ja: { title: '通貨', auto: '自動', here: '現在地：{c}', search: '通貨を検索', none: '該当する通貨がありません', note: '{d}の参考レートで換算し、切り上げています。', tip: '{v}（換算・切り上げ）', pick: '通貨を選択', close: '閉じる', common: 'よく使う通貨', all: 'すべての通貨' },
    ko: { title: '통화', auto: '자동', here: '현재 위치: {c}', search: '통화 검색', none: '통화를 찾을 수 없습니다', note: '{d} 기준 환율로 환산한 뒤 올림했습니다.', tip: '{v}, 환산 후 올림', pick: '통화 선택', close: '닫기', common: '자주 사용', all: '모든 통화' },
    ru: { title: 'Валюта', auto: 'Автоматически', here: 'Ваше местоположение: {c}', search: 'Поиск валюты', none: 'Валюта не найдена', note: 'Пересчитано по справочному курсу на {d} и округлено в большую сторону.', tip: '{v}, пересчитано и округлено в большую сторону', pick: 'Выбрать валюту', close: 'Закрыть', common: 'Часто используемые', all: 'Все валюты' },
    tr: { title: 'Para birimi', auto: 'Otomatik', here: 'Konumunuz: {c}', search: 'Para birimi ara', none: 'Para birimi bulunamadı', note: '{d} tarihli referans kurla çevrilip yukarı yuvarlanmıştır.', tip: '{v}, çevrilip yukarı yuvarlandı', pick: 'Para birimini seçin', close: 'Kapat', common: 'Sık kullanılanlar', all: 'Tüm para birimleri' },
  };

  var LOCALE = null;   // Format-Locale, falls <html lang> nur die Sprache nennt (Planer: »en« -> »en-CA«)
  var locale = function () { return LOCALE || document.documentElement.lang || 'de-DE'; };
  function tr(k, p) {
    var l = locale(), s = (T[l] && T[l][k]) || (T[l.split('-')[0]] || T.en)[k] || T.en[k];
    return s.replace(/\{(\w)\}/g, function (m, x) { return p && p[x] !== undefined ? p[x] : m; });
  }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var valid = function (c) { return !!(c && D.rates && D.rates[c]); };

  // ------------------------------------------------------------ Standort (nur im Browser)
  var TZ = null;
  function tzMap() {
    if (TZ) return TZ;
    TZ = {};
    (D.tz || '').split(';').forEach(function (g) {
      var i = g.indexOf(':'), area = g.slice(0, i);
      g.slice(i + 1).split(',').forEach(function (e) { var j = e.lastIndexOf(' '); TZ[area + '/' + e.slice(0, j)] = e.slice(j + 1); });
    });
    return TZ;
  }
  var _country;
  function country() {
    if (_country !== undefined) return _country;
    var c = null;
    try { c = tzMap()[Intl.DateTimeFormat().resolvedOptions().timeZone] || null; } catch (e) { /* alter Browser */ }
    if (!c) {
      var ls = navigator.languages || [navigator.language || ''];
      for (var i = 0; i < ls.length && !c; i++) {
        var m = /^[a-z]{2,3}[-_](?:[a-z]{4}[-_])?([a-z]{2})(?:$|[-_])/i.exec(ls[i] || '');
        if (m) c = m[1].toUpperCase();
      }
    }
    return (_country = c);
  }
  function auto() { var k = D.cc && D.cc[country()]; return valid(k) ? k : 'EUR'; }
  var urlCur = null;
  try { var q = new URLSearchParams(location.search).get('currency'); if (valid((q || '').toUpperCase())) urlCur = q.toUpperCase(); } catch (e) { /* ohne URLSearchParams */ }
  function stored() { try { var v = localStorage.getItem(KEY); return valid(v) ? v : null; } catch (e) { return null; } }
  function get() { return urlCur || stored() || auto(); }
  function set(code) {
    urlCur = null;
    try { if (valid(code)) localStorage.setItem(KEY, code); else localStorage.removeItem(KEY); } catch (e) { /* privates Fenster */ }
    changed();
  }

  // ------------------------------------------------------------ Umrechnen, runden, formatieren
  function roundUp(v) {
    if (!(v > 0)) return 0;
    var step = v < 100 ? 5 : v < 1000 ? 10 : v < 10000 ? 100 : Math.max(1000, Math.pow(10, Math.floor(Math.log10(v)) - 2));
    return Math.ceil(v / step - 1e-9) * step;
  }
  function amount(eur, code, base) {
    code = code || get();
    if (code === 'EUR') return eur;
    if (base > 0 && base !== eur) return amount(base, code) * (eur / base);
    return roundUp(eur * (D.rates[code] || 1));
  }
  function format(v, code, opt) {
    code = code || get();
    var o = { style: 'currency', currency: code, maximumFractionDigits: 0, minimumFractionDigits: 0 };
    for (var k in opt || {}) o[k] = opt[k];
    try { return new Intl.NumberFormat(locale(), o).format(v); } catch (e) { return Math.round(v) + ' ' + code; }
  }
  function money(eur, code, base) { code = code || get(); return format(amount(eur, code, base), code); }
  function name(code) {
    try { return new Intl.DisplayNames([locale()], { type: 'currency' }).of(code) || code; } catch (e) { return code; }
  }
  function symbol(code) {
    try {
      var p = new Intl.NumberFormat(locale(), { style: 'currency', currency: code }).formatToParts(0);
      for (var i = 0; i < p.length; i++) if (p[i].type === 'currency') return p[i].value;
    } catch (e) { /* unbekannt */ }
    return code;
  }
  function region(cc) { try { return new Intl.DisplayNames([locale()], { type: 'region' }).of(cc) || cc; } catch (e) { return cc; } }
  function rateDate() {
    try { return new Intl.DateTimeFormat(locale(), { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(D.date + 'T12:00:00Z')); } catch (e) { return D.date; }
  }

  // ------------------------------------------------------------ Seite aktualisieren
  function apply(root) {
    var code = get();
    (root || document).querySelectorAll('[data-eur]').forEach(function (el) {
      var eur = parseFloat(el.getAttribute('data-eur'));
      if (isNaN(eur) || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
      var txt = money(eur, code, parseFloat(el.getAttribute('data-eur-base')));
      if (el.textContent !== txt) el.textContent = txt;
      el.style.setProperty('--zc-len', txt.length);   // sehr große Zählerwerte (¥, ₩) passen sich in der Breite an
      if (code === 'EUR') el.removeAttribute('title'); else el.title = tr('tip', { v: format(eur, 'EUR') });
      el.setAttribute('data-cur', code);
    });
    document.querySelectorAll('[data-currency-btn]').forEach(label);
  }
  function label(btn) {
    var code = get(), out = btn.querySelector('[data-currency-code]') || btn, ttl = btn.querySelector('[data-currency-title]');
    out.textContent = code;
    if (ttl) ttl.textContent = tr('title');
    btn.setAttribute('aria-label', tr('pick') + ': ' + name(code) + ' (' + code + ')');
    btn.title = tr('title') + ': ' + name(code) + (stored() || urlCur ? '' : ' · ' + tr('auto'));
    btn.setAttribute('aria-haspopup', 'dialog');
  }
  function changed() {
    apply();
    try { window.dispatchEvent(new CustomEvent(EVT, { detail: { code: get() } })); } catch (e) { /* sehr alter Browser */ }
  }
  window.addEventListener('storage', function (e) { if (e.key === KEY) changed(); });

  // ------------------------------------------------------------ Auswahl (Popover, auf dem Handy von unten)
  var pop = null, back = null, anchor = null;
  var CSS = '.zc-back{position:fixed;inset:0;z-index:10040;background:transparent}.zc-back.zc-dim{background:rgba(0,0,0,.5)}' +
    '.zc-pop{position:fixed;z-index:10050;width:344px;max-width:calc(100vw - 16px);display:flex;flex-direction:column;background:#16181b;color:#fff;border-radius:14px;' +
    'box-shadow:0 24px 64px -16px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.1);font-family:inherit;font-size:15px;line-height:1.35;overflow:hidden;animation:zc-in .18s ease-out;text-align:left}' +
    '.zc-pop *{box-sizing:border-box}.zc-head{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 8px 18px}.zc-head strong{font-size:16px;font-weight:700}' +
    '.zc-x{width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;display:grid;place-items:center;cursor:pointer;padding:0}.zc-x:hover{background:#f0e600;color:#000}.zc-x svg{width:16px;height:16px}' +
    '.zc-q{margin:0 12px 6px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-size:16px;outline:none;-webkit-appearance:none;appearance:none}' +
    '.zc-q:focus{border-color:#f0e600}.zc-q::placeholder{color:rgba(255,255,255,.45)}' +
    '.zc-list{overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:2px 8px 8px;flex:1 1 auto;min-height:0}' +
    '.zc-sub{margin:12px 10px 4px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.5)}' +
    '.zc-opt{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;margin:0;padding:9px 10px;border:0;border-radius:9px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}' +
    '.zc-opt[hidden],.zc-sub[hidden],.zc-empty[hidden]{display:none}.zc-opt b{font-weight:700;letter-spacing:.04em}.zc-opt span{overflow:hidden;text-overflow:ellipsis}.zc-opt i{font-style:normal;color:rgba(255,255,255,.55);white-space:nowrap}' +
    '.zc-opt:hover,.zc-opt:focus-visible{background:rgba(255,255,255,.09);outline:none}.zc-opt[aria-pressed=true]{background:#f0e600;color:#000}.zc-opt[aria-pressed=true] i,.zc-opt[aria-pressed=true] small{color:rgba(0,0,0,.62)}' +
    '.zc-auto{grid-template-columns:minmax(0,1fr) auto}.zc-auto small{display:block;font-size:13px;color:rgba(255,255,255,.6)}' +
    '.zc-empty{margin:0;padding:8px 18px;color:rgba(255,255,255,.6)}.zc-note{margin:0;padding:10px 18px 14px;font-size:12px;color:rgba(255,255,255,.55);border-top:1px solid rgba(255,255,255,.08)}' +
    '.zc-sheet{left:0!important;right:0;bottom:0;top:auto!important;width:auto;max-width:none;max-height:82vh!important;border-radius:18px 18px 0 0;padding-bottom:env(safe-area-inset-bottom)}' +
    '@keyframes zc-in{from{opacity:0;transform:translateY(-6px)}}.zc-sheet{animation-name:zc-up}@keyframes zc-up{from{transform:translateY(40px);opacity:0}}' +
    '@media (prefers-reduced-motion:reduce){.zc-pop{animation:none}}';
  var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function item(code, on) {
    return '<button type="button" class="zc-opt" data-c="' + code + '" aria-pressed="' + on + '" data-k="' + esc((code + ' ' + name(code) + ' ' + symbol(code)).toLowerCase()) + '">' +
      '<b>' + code + '</b><span>' + esc(name(code)) + '</span><i>' + esc(symbol(code)) + '</i></button>';
  }
  function place() {
    if (!pop) return;
    var w = window.innerWidth, h = window.innerHeight;
    var sheet = w <= 600 || !anchor || !anchor.isConnected || !anchor.getClientRects().length;
    pop.classList.toggle('zc-sheet', sheet); back.classList.toggle('zc-dim', sheet);
    if (sheet) { pop.style.left = pop.style.top = pop.style.bottom = pop.style.maxHeight = ''; return; }
    var r = anchor.getBoundingClientRect(), pw = Math.min(344, w - 16);
    pop.style.left = Math.round(Math.min(Math.max(8, r.right - pw), w - pw - 8)) + 'px';
    var below = h - r.bottom - 16;
    if (below < 320 && r.top > below) { pop.style.top = ''; pop.style.bottom = Math.round(h - r.top + 8) + 'px'; pop.style.maxHeight = Math.round(r.top - 16) + 'px'; }
    else { pop.style.bottom = ''; pop.style.top = Math.round(r.bottom + 8) + 'px'; pop.style.maxHeight = Math.round(below) + 'px'; }
  }
  function open(btn) {
    if (pop) { close(); return; }
    if (!document.getElementById('zc-css')) {
      var st = document.createElement('style'); st.id = 'zc-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    anchor = btn || null;
    var cur = stored() || urlCur, c = country(), main = (D.main || []).filter(valid);
    var rest = Object.keys(D.rates).filter(function (x) { return main.indexOf(x) < 0; })
      .sort(function (a, b) { return name(a).localeCompare(name(b), locale()); });
    back = document.createElement('div'); back.className = 'zc-back';
    pop = document.createElement('div');
    pop.className = 'zc-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', tr('title'));
    pop.setAttribute('data-lenis-prevent', '');
    pop.innerHTML = '<div class="zc-head"><strong>' + esc(tr('title')) + '</strong><button type="button" class="zc-x" aria-label="' + esc(tr('close')) + '">' + X + '</button></div>' +
      '<input class="zc-q" type="search" autocomplete="off" spellcheck="false" placeholder="' + esc(tr('search')) + '" aria-label="' + esc(tr('search')) + '">' +
      '<div class="zc-list">' +
      '<button type="button" class="zc-opt zc-auto" data-c="" aria-pressed="' + !cur + '" data-k="' + esc(tr('auto').toLowerCase()) + '"><span>' + esc(tr('auto')) +
      '<small>' + esc((c ? tr('here', { c: region(c) }) + ' · ' : '') + name(auto())) + '</small></span><i>' + auto() + '</i></button>' +
      '<p class="zc-sub">' + esc(tr('common')) + '</p>' + main.map(function (x) { return item(x, cur === x); }).join('') +
      '<p class="zc-sub">' + esc(tr('all')) + '</p>' + rest.map(function (x) { return item(x, cur === x); }).join('') +
      '<p class="zc-empty" hidden>' + esc(tr('none')) + '</p></div>' +
      '<p class="zc-note">' + esc(tr('note', { d: rateDate() })) + '</p>';
    document.body.appendChild(back); document.body.appendChild(pop);
    if (anchor) anchor.setAttribute('aria-expanded', 'true');
    place();
    var q = pop.querySelector('.zc-q'), list = pop.querySelector('.zc-list');
    var opts = function () { return [].slice.call(list.querySelectorAll('.zc-opt:not([hidden])')); };
    q.addEventListener('input', function () {
      var s = q.value.trim().toLowerCase(), n = 0;
      list.querySelectorAll('.zc-opt').forEach(function (o) { var on = !s || o.getAttribute('data-k').indexOf(s) >= 0; o.hidden = !on; if (on) n++; });
      list.querySelectorAll('.zc-sub').forEach(function (h) { h.hidden = !!s; });
      pop.querySelector('.zc-empty').hidden = n > 0;
    });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); var f = opts()[0]; if (f) f.click(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); var g = opts()[0]; if (g) g.focus(); }
    });
    list.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      var a = opts(), i = a.indexOf(document.activeElement) + (e.key === 'ArrowDown' ? 1 : -1);
      if (i < 0) q.focus(); else if (a[i]) a[i].focus();
    });
    list.addEventListener('click', function (e) {
      var o = e.target.closest('.zc-opt'); if (!o) return;
      set(o.getAttribute('data-c') || null); close();
    });
    pop.querySelector('.zc-x').addEventListener('click', close);
    back.addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    var sel = list.querySelector('[aria-pressed=true]');
    if (sel) sel.scrollIntoView({ block: 'center' });
    // Am Rechner gleich tippen können; auf Touch-Geräten keine Tastatur aufklappen
    if (window.matchMedia && matchMedia('(pointer: fine)').matches) q.focus(); else if (sel) sel.focus({ preventScroll: true });
  }
  function onKey(e) { if (e.key === 'Escape' && pop) { e.stopPropagation(); close(); } }
  function close() {
    if (!pop) return;
    pop.remove(); back.remove(); pop = back = null;
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    if (anchor) { anchor.setAttribute('aria-expanded', 'false'); if (anchor.isConnected) anchor.focus({ preventScroll: true }); }
    anchor = null;
  }
  function bind(btn) {
    if (!btn || btn._zc) return;
    btn._zc = true; label(btn);
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', function (e) { e.preventDefault(); open(btn); });
  }
  function init() {
    document.querySelectorAll('[data-currency-btn]').forEach(bind);
    apply();
  }

  window.ZCurrency = {
    get: get, set: set, auto: auto, country: country, stored: stored, amount: amount, roundUp: roundUp, format: format, money: money,
    name: name, symbol: symbol, rates: D.rates, date: D.date, main: D.main, list: function () { return Object.keys(D.rates); },
    apply: apply, open: open, close: close, bind: bind, tr: tr, event: EVT,
    setLocale: function (l) { LOCALE = l || null; if (document.readyState !== 'loading') apply(); },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
