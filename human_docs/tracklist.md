Two way to import a track list:

1. just a wall of text, do whatever you want
2. artist name, song name, time

```
type Track = {
    artist_title: string,
    song_title: string,
    start_time: number;
}
type Tracklist = Track[]
```

raw tracklist

```
1 MASTER MUSICIANS OF BUKKAKE - Theme from the Science Fiction Television Show “Bạn Bè Của Anh Ãy”

2 ANDREAS ANNER + FM EINHEIT - Radio Inferno, Canto XXVI

3 VILLAELVIN - TROFFj

4 OKI feat UMEKO ANDO - Cup Kamuy Ho

5 PAAVOHARJU - Kevätrumpu

6 ANNA HOMER + ALESSIO CAPOVILLA - Ricordo

7 VAN DYKE PARKS ORCHESTRATES VERÓNICA VALERIO - Camino a Casa

8 HEATHER TROST - La Selva Subterranea

9 DIJIT Natfo (Kinlaw remix)

10 MvvMvv VETS - O Seasons, O Châteaus!

11 JOE RAINEY - No Chants

12 GRANDMASTER MASESE - Mama n’omuya

13 PENSÉES NOCTURNES - Quel Sale Bourreau

14 GONGTRAIN - Kalke Ena Sholio

15 C CAT TRANCE - Jinniyya

16 ENDLESS BOOGIE - Kombibricka
```

UI configuration:

leading seperator: " " middle seperator: " - "

maybe a new modal -- pasting in the top, editing in the bottom

how do we store this in a database?
