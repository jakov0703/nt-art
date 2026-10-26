@echo off
rem ===================================================================
rem  ATELIER — dvoklik na ovu datoteku otvara sucelje za objavu radova.
rem
rem  Ovo je jedina datoteka koju ona ikad treba pokrenuti.
rem  Napravite precac na radnu povrsinu: desni klik -> Posalji na ->
rem  Radna povrsina (stvori precac). Preimenujte ga u "Atelier".
rem ===================================================================

rem UTF-8 kodna stranica: bez ovoga se kvacice u konzoli prikazuju kao smece.
chcp 65001 >nul 2>&1

title Atelier - objava radova
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Node.js nije pronaden na ovom racunalu.
  echo   Bez njega Atelier ne moze raditi.
  echo.
  echo   Javite se osobi koja vam je postavila stranicu.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo.
  echo   Prvo pokretanje - pripremam sve sto treba.
  echo   Ovo traje nekoliko minuta i dogada se samo jednom.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   Priprema nije uspjela. Provjerite internetsku vezu,
    echo   zatvorite ovaj prozor i pokusajte ponovno.
    echo.
    pause
    exit /b 1
  )
)

node "scripts\pokreni.mjs"

rem Ako se program srusio, prozor ostaje otvoren da se poruka moze procitati.
if errorlevel 1 (
  echo.
  echo   Atelier se zaustavio zbog greske.
  echo   Zatvorite ovaj prozor i kliknite precac ponovno.
  echo.
  pause
)
