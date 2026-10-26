/**
 * Ručno pisani uvodi za tematske stranice.
 *
 * Zaseban modul, a ne konstanta u .astro datoteci: Astro izdvaja
 * getStaticPaths() u vlastiti chunk i konstante iz frontmattera mu nisu
 * pouzdano dostupne (pada s "UVODI is not defined"). Uvezeni moduli jesu.
 *
 * Tema bez uvoda NE DOBIVA URL, makar imala dovoljno radova. Generirana
 * kategorijska stranica bez teksta je tanak sadržaj — i to se prelije na
 * cijelu domenu, ne samo na tu stranicu.
 */

export const UVODI_TEMA = {
  sakralno: {
    naslov: 'Sakralne slike — Isus, Gospa i sveci',
    title: 'Sakralne slike — ručno slikano, po narudžbi',
    meta: 'Ručno slikane sakralne slike: Presveto Srce Isusovo, Milosrdni Isus, Gospa i sveci. Akril na platnu, po narudžbi iz Zagreba.',
    uvod: `Sakralna slika nije ukras. Ona stoji na mjestu na kojem se netko zaustavlja — iznad kreveta djeteta, u kutu gdje se moli, na zidu pokraj kojeg se svaki dan prolazi. Zato se slika drukčije nego cvijeće ili pejzaž: manje se pita kako izgleda, a više kako će s njom biti živjeti godinama.

Radovi nastaju jedan po jedan, rukom, akrilom na platnu — najčešće u impasto tehnici, gdje se boja nanosi gusto pa potezi kista ostaju vidljivi i opipljivi. Slika time dobiva reljef i mijenja se ovisno o tome kako na nju pada svjetlo: ujutro izgleda drukčije nego navečer.

Najčešći motivi su Presveto Srce Isusovo i Milosrdni Isus, s kojima je zapravo sve i počelo. Većina sakralnih radova nastaje po narudžbi i odlazi naručitelju, pa ih ovdje bude malo — ali svaki se takav motiv može naslikati ponovno, u formatu koji odgovara vašem prostoru.`,
  },

  ostalo: {
    naslov: 'Ostali radovi — cvijeće, ptice i priroda',
    title: 'Ostali radovi — cvijeće, ptice i priroda',
    meta: 'Radovi izvan sakralne tematike: cvijeće, ptice i slobodne kompozicije. Akril i kombinirana tehnika na platnu.',
    uvod: `Ovdje su radovi koji nisu sakralni — cvijeće, ptice i slobodne kompozicije. Stoje na stranici jer su stvaran dio rada, a ne zato da popune prazninu: ista ruka i ista tehnika stoje i iza sakralnih motiva.

U njima se najbolje vidi način rada — gusti nanos boje, vidljivi potezi, kontrast između mirne pozadine i motiva koji je izveden precizno. To je isto ono što sliku Presvetog Srca čini onakvom kakva jest.

Ako ste došli zbog sakralnih motiva, njih ćete naći pod sakralnim slikama, a najviše ih nastaje po narudžbi.`,
  },

  gospa: {
    naslov: 'Slike Gospe i Majke Božje',
    title: 'Slike Gospe i Majke Božje — ručno slikano',
    meta: 'Ručno slikane slike Gospe i Majke Božje — Bogorodica s Djetetom, Gospa Žalosna i marijanski motivi. Originali i narudžbe.',
    uvod: `Marijanski motivi su najtraženiji i ujedno najteži. Najteži zato što svatko tko ih naručuje već ima sliku u glavi — onu iz svoje župe, s bakine police, s hodočašća na koje se išlo svake godine. Posao slikara nije nadmašiti tu sliku, nego je ne iznevjeriti.

Plašt je gotovo uvijek plav, i to nije stilska odluka. Ultramarin se stoljećima dobivao mrvljenjem lapis lazulija i bio je skuplji od zlata; time se plaćala čast, ne ukras — najskuplji pigment išao je na Majku Božju. Tri zvijezde na plaštu, na čelu i oba ramena, znak su djevičanstva prije, za vrijeme i nakon rođenja Kristova.

Najčešće se naručuju Bogorodica s Djetetom, Gospa Žalosna i lokalni marijanski likovi — Gospa Sinjska, Bistrička, Trsatska. Kod njih se ne izmišlja — lice, položaj ruku i boje slijede prikaz koji ljudi prepoznaju.`,
  },

  'isus-krist': {
    naslov: 'Slike Isusa Krista',
    title: 'Slike Isusa Krista — ručno slikane, originali',
    meta: 'Ručno slikane slike Isusa Krista: Presveto Srce, Milosrdni Isus, Krist na križu i Kristov lik. Originalna djela i narudžbe.',
    uvod: `Kristov lik ima najstroža pravila i najmanje prostora za slikarsku slobodu — i upravo je zato mjerilo. Nekoliko milimetara razlike u razmaku očiju mijenja cijeli izraz, a gledatelj to primijeti prije nego što zna što je primijetio.

Najčešće se naručuju Presveto Srce Isusovo, Milosrdni Isus i raspelo. Svaki nosi ikonografiju koja se ne mijenja proizvoljno: rane, položaj ruku, crvena haljina i plavi plašt, zrake koje izlaze iz Srca. Ti znakovi nisu ukras nego jezik — po njima se slika čita, i ljudi ga znaju čitati i kad ne bi znali objasniti kako.

Kod Milosrdnog Isusa dvije zrake, blijeda i crvena, označavaju vodu i krv koji su potekli iz probodenog boka. Kod Presvetog Srca trnova kruna oko srca označava muku, a plamen ljubav koja ne gasne.`,
  },

  sveci: {
    naslov: 'Slike svetaca i svetaca zaštitnika',
    title: 'Slike svetaca — svetac zaštitnik po narudžbi',
    meta: 'Ručno slikane slike svetaca i svetaca zaštitnika. Slika svetog imena za imendan, krštenje ili krizmu — po narudžbi.',
    uvod: `Svetac zaštitnik je najosobniji razlog zbog kojeg netko naruči sliku: ime djeteta, ime pokojnog roditelja, zaštitnik zanata, mjesta ili župe. To su slike koje se ne kupuju s police jer ih na polici nema — svetog Vlaha, svetu Anu ili svetog Nikolu u pravom formatu i s pravim licem mora netko naslikati.

Svaki svetac ima atribute po kojima se prepoznaje: Josip stolarski alat i procvjetali štap, Ana knjigu i mladu Mariju, Antun ljiljan i Dijete, Franjo rane i pticu. Ti se znakovi ne izostavljaju ni kad bi kompozicija bila mirnija bez njih — po njima se svetac čita.

Takva slika je čest dar za imendan, krizmu ili prvu pričest, i to je dar koji ostaje. Za narudžbu je dobro javiti se nekoliko mjeseci unaprijed jer izrada traje.`,
  },

};
